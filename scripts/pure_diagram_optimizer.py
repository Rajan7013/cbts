"""
Pure Diagram Optimizer for MECEE BL:
1. Strips out 187 redundant solution images where solutions are pure text/equations.
2. For the 13 genuine solution diagrams, isolates the PURE drawing (removing all text borders).
3. For Question and Option diagrams, isolates the pure graphical figures.
4. Uploads only the pure diagrams to Cloudflare R2.
5. Re-generates clean, professional data/mecee_bl_200_r2.json and .csv.
"""

import json
import os
import sys
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

sys.path.append(str(Path(__file__).resolve().parent.parent))
from scripts.image_processor import optimize_image
from scripts.r2_storage import upload_bytes, PUBLIC_URL_BASE

BASE_DIR = Path(r"C:\Users\rajan\Documents\Codex\2026-11-14\make-x20")
IMAGES_DIR = BASE_DIR / "outputs" / "images"
DATA_FILE = BASE_DIR / "work" / "final-data.json"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"

OUTPUT_JSON = OUTPUT_DIR / "mecee_bl_200_r2.json"
OUTPUT_CSV = OUTPUT_DIR / "mecee_bl_200_r2.csv"

# The only 13 questions where solutions contain an actual graphic diagram/drawing
GENUINE_SOLUTION_DIAGRAMS = {
    114: "solution-114.png",
    115: "solution-115.png",
    126: "solution-126.png",
    127: "solution-127.png",
    128: "solution-128.png",
    137: "solution-137.png",
    138: "solution-138.png",
    139: "solution-139.png",
    144: "solution-144.png",
    155: "solution-155.png",
    157: "solution-157.png",
    188: "solution-188.png",
    200: "solution-200.png",
}


def extract_pure_drawing(img_path: Path, min_w=40, min_h=35, pad=16):
    """
    Extracts strictly the graphic diagram/drawing, eliminating surrounding
    scanned text lines and border noise.
    """
    img = cv2.imread(str(img_path))
    if img is None:
        return None
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY_INV)

    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    graphic_boxes = []
    for c in contours:
        x, y, w, h = cv2.boundingRect(c)
        if w >= min_w and h >= min_h:
            graphic_boxes.append((x, y, w, h))

    if not graphic_boxes:
        return img  # fallback to original if no large components found

    min_x = min(b[0] for b in graphic_boxes)
    min_y = min(b[1] for b in graphic_boxes)
    max_x = max(b[0] + b[2] for b in graphic_boxes)
    max_y = max(b[1] + b[3] for b in graphic_boxes)

    h_img, w_img = img.shape[:2]
    crop_x1 = max(0, min_x - pad)
    crop_y1 = max(0, min_y - pad)
    crop_x2 = min(w_img, max_x + pad)
    crop_y2 = min(h_img, max_y + pad)

    return img[crop_y1:crop_y2, crop_x1:crop_x2]


def run_pure_optimizer():
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = data.get("rows", [])
    print(f"Loaded {len(rows)} rows.")

    uploaded_cache = {}
    pure_sol_count = 0
    pure_q_count = 0
    pure_opt_count = 0

    for idx, row in enumerate(rows, 1):
        q_num = idx

        # 1. QUESTION IMAGES: Only keep if genuinely present
        q_img_rel = row.get("QuestionImageUrl", "").strip()
        if q_img_rel:
            fname = Path(q_img_rel).name
            local_p = IMAGES_DIR / fname
            if local_p.exists():
                pure_mat = extract_pure_drawing(local_p, min_w=45, min_h=40, pad=18)
                is_success, buffer = cv2.imencode(".png", pure_mat)
                webp_bytes, meta = optimize_image(buffer.tobytes(), profile="question")
                remote_key = f"mecee_bl_01/pure_q/{Path(fname).stem}.webp"
                cdn_url = upload_bytes(webp_bytes, remote_key, "image/webp")
                row["QuestionImageUrl"] = cdn_url
                pure_q_count += 1
            else:
                row["QuestionImageUrl"] = ""
        else:
            row["QuestionImageUrl"] = ""

        # 2. OPTION IMAGES: Only keep if genuinely present
        for opt_key in ["OptionAImageUrl", "OptionBImageUrl", "OptionCImageUrl", "OptionDImageUrl"]:
            opt_rel = row.get(opt_key, "").strip()
            if opt_rel:
                fname = Path(opt_rel).name
                local_p = IMAGES_DIR / fname
                if local_p.exists():
                    pure_mat = extract_pure_drawing(local_p, min_w=30, min_h=30, pad=12)
                    is_success, buffer = cv2.imencode(".png", pure_mat)
                    webp_bytes, meta = optimize_image(buffer.tobytes(), profile="option")
                    remote_key = f"mecee_bl_01/pure_options/{Path(fname).stem}.webp"
                    cdn_url = upload_bytes(webp_bytes, remote_key, "image/webp")
                    row[opt_key] = cdn_url
                    pure_opt_count += 1
                else:
                    row[opt_key] = ""
            else:
                row[opt_key] = ""

        # 3. SOLUTION IMAGES: STRIP OUT the 187 non-diagram questions!
        if q_num in GENUINE_SOLUTION_DIAGRAMS:
            fname = GENUINE_SOLUTION_DIAGRAMS[q_num]
            local_p = IMAGES_DIR / fname
            if local_p.exists():
                pure_mat = extract_pure_drawing(local_p, min_w=45, min_h=35, pad=16)
                is_success, buffer = cv2.imencode(".png", pure_mat)
                webp_bytes, meta = optimize_image(buffer.tobytes(), profile="question")
                remote_key = f"mecee_bl_01/pure_solutions/{Path(fname).stem}.webp"
                cdn_url = upload_bytes(webp_bytes, remote_key, "image/webp")
                row["SolutionImageUrl"] = cdn_url
                pure_sol_count += 1
            else:
                row["SolutionImageUrl"] = ""
        else:
            # PURE TEXT / MATH: No image needed!
            row["SolutionImageUrl"] = ""

    print(f"\n--- Optimization Complete ---")
    print(f"Question Images Kept: {pure_q_count}")
    print(f"Option Images Kept: {pure_opt_count}")
    print(f"Solution Images Kept: {pure_sol_count} (187 redundant scanned text images removed!)")

    # Save cleaned JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    print(f"Saved optimized JSON to: {OUTPUT_JSON}")

    # Save cleaned CSV
    import csv
    fieldnames = [
        "Section",
        "Question",
        "QuestionImageUrl",
        "OptionA",
        "OptionAImageUrl",
        "OptionB",
        "OptionBImageUrl",
        "OptionC",
        "OptionCImageUrl",
        "OptionD",
        "OptionDImageUrl",
        "CorrectOption",
        "Explanation",
        "SolutionImageUrl",
        "StepByStepSolution",
    ]
    with open(OUTPUT_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            row_dict = {k: r.get(k, "") for k in fieldnames}
            writer.writerow(row_dict)
    print(f"Saved optimized CSV to: {OUTPUT_CSV}")


if __name__ == "__main__":
    run_pure_optimizer()
