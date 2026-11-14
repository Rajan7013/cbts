"""
High-Precision Image & Option Text Refiner:
1. Q196: Crops out 'Problem Figures' text and bottom numbering, keeping strictly the 5 problem figure boxes.
2. Q197: Crops out the stray artifact 'v' at the bottom, keeping strictly Figure (X).
3. Q198: Removes placeholder text 'See OptionAImageUrl.', replacing with clean labels.
4. Q120: Removes placeholder text 'See structural formula in OptionBImageUrl.'.
5. Re-uploads refined images to Cloudflare R2 and updates data/mecee_bl_200_r2.json & .csv.
"""

import json
import sys
from pathlib import Path
import cv2
import numpy as np

sys.path.append(str(Path(__file__).resolve().parent.parent))
from scripts.image_processor import optimize_image
from scripts.r2_storage import upload_bytes

BASE_DIR = Path(r"C:\Users\rajan\Documents\Codex\2026-11-14\make-x20")
IMAGES_DIR = BASE_DIR / "outputs" / "images"
DATA_JSON = Path("data/mecee_bl_200_r2.json")
DATA_CSV = Path("data/mecee_bl_200_r2.csv")


def refine_images_and_data():
    # 1. Refine Q196 Question Image
    p196 = IMAGES_DIR / "196-QuestionImageUrl.png"
    if p196.exists():
        img196 = cv2.imread(str(p196))
        # Top 'Problem Figures' text is from y=0 to y=20
        # Bottom numbers '(1) (2)...' are below y=97
        # Main figure boxes are y=20 to y=96, x=5 to x=370
        cropped196 = img196[20:97, 5:372]
        is_success, buf = cv2.imencode(".png", cropped196)
        webp_bytes, _ = optimize_image(buf.tobytes(), profile="question")
        url196 = upload_bytes(webp_bytes, "mecee_bl_01/pure_q/196-QuestionImageUrl.webp", "image/webp")
        print("Q196 pure question image uploaded:", url196)

    # 2. Refine Q197 Question Image (Remove bottom stray mark)
    p197 = IMAGES_DIR / "197-QuestionImageUrl.png"
    if p197.exists():
        img197 = cv2.imread(str(p197))
        # Main box is y=4 to y=94, x=3 to x=96. Bottom mark is at y > 98
        cropped197 = img197[3:95, 2:97]
        is_success, buf = cv2.imencode(".png", cropped197)
        webp_bytes, _ = optimize_image(buf.tobytes(), profile="question")
        url197 = upload_bytes(webp_bytes, "mecee_bl_01/pure_q/197-QuestionImageUrl.webp", "image/webp")
        print("Q197 pure question image uploaded:", url197)

    # 3. Clean placeholder text in JSON and CSV
    with open(DATA_JSON, "r", encoding="utf-8") as f:
        rows = json.load(f)

    for r in rows:
        # Check all options for placeholder strings
        for opt in ["OptionA", "OptionB", "OptionC", "OptionD"]:
            val = r.get(opt, "")
            if "see" in val.lower() and "image" in val.lower():
                r[opt] = ""

        # Update Q196 & Q197 URLs if re-uploaded
        if "196." in r["Question"] and 'url196' in locals():
            r["QuestionImageUrl"] = url196
        if "197." in r["Question"] and 'url197' in locals():
            r["QuestionImageUrl"] = url197

    # Save cleaned JSON
    with open(DATA_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    print("Saved refined JSON:", DATA_JSON)

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
    with open(DATA_CSV, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in rows:
            writer.writerow({k: r.get(k, "") for k in fieldnames})
    print("Saved refined CSV:", DATA_CSV)


if __name__ == "__main__":
    refine_images_and_data()
