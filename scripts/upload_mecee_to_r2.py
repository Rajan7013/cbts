"""
Automated Pipeline Script:
1. Reads all question, option, and solution images for MECEE BL (200 Questions).
2. Converts PNGs to ultra-compact, high-clarity WebP with auto-trimmed margins.
3. Uploads them to Cloudflare R2 bucket 'tests' under 'mecee_bl_01/' prefix.
4. Updates final-data.json so all image references point to permanent Cloudflare R2 CDN URLs.
5. Saves 'mecee_bl_final_r2.json' and 'mecee_bl_final_r2.csv'.
"""

import json
import os
import sys
from pathlib import Path
from PIL import Image

# Import R2 and Image Processor from scripts
sys.path.append(str(Path(__file__).resolve().parent.parent))
from scripts.image_processor import optimize_image
from scripts.r2_storage import upload_bytes, BUCKET_NAME, PUBLIC_URL_BASE

BASE_DIR = Path(r"C:\Users\rajan\Documents\Codex\2026-11-14\make-x20")
IMAGES_DIR = BASE_DIR / "outputs" / "images"
DATA_FILE = BASE_DIR / "work" / "final-data.json"
OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

OUTPUT_JSON = OUTPUT_DIR / "mecee_bl_200_r2.json"
OUTPUT_CSV = OUTPUT_DIR / "mecee_bl_200_r2.csv"


def run_pipeline():
    print(f"Starting MECEE BL Cloudflare R2 Pipeline...")
    print(f"Reading from: {DATA_FILE}")
    print(f"Images from: {IMAGES_DIR}")
    print(f"Cloudflare Bucket: {BUCKET_NAME}")
    print(f"Public CDN Base: {PUBLIC_URL_BASE}")

    if not DATA_FILE.exists():
        print(f"Error: Data file not found at {DATA_FILE}")
        return

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    rows = data.get("rows", [])
    print(f"Loaded {len(rows)} question rows.")

    # Cache uploaded local image filenames to avoid re-uploading duplicates
    url_cache = {}
    total_original_bytes = 0
    total_optimized_bytes = 0
    upload_count = 0

    image_fields = [
        "QuestionImageUrl",
        "OptionAImageUrl",
        "OptionBImageUrl",
        "OptionCImageUrl",
        "OptionDImageUrl",
        "SolutionImageUrl",
    ]

    for idx, row in enumerate(rows, 1):
        for field in image_fields:
            local_rel_path = row.get(field, "").strip()
            if not local_rel_path:
                continue

            # Strip "images/" prefix if present to find file in IMAGES_DIR
            filename = Path(local_rel_path).name
            local_file = IMAGES_DIR / filename

            if not local_file.exists():
                print(f"[Warning] Image not found: {local_file}")
                continue

            # If already processed and uploaded
            if filename in url_cache:
                row[field] = url_cache[filename]
                continue

            # Determine profile
            profile = "solution" if "solution" in filename.lower() else "option" if "option" in filename.lower() else "question"

            # Read and measure original
            orig_size = local_file.stat().st_size
            total_original_bytes += orig_size

            # Optimize to WebP
            webp_bytes, meta = optimize_image(local_file, profile=profile)
            opt_size = len(webp_bytes)
            total_optimized_bytes += opt_size

            # Upload to Cloudflare R2
            remote_key = f"mecee_bl_01/{Path(filename).stem}.webp"
            cdn_url = upload_bytes(
                data=webp_bytes,
                remote_key=remote_key,
                content_type="image/webp",
                cache_control="public, max-age=31536000, immutable"
            )

            url_cache[filename] = cdn_url
            row[field] = cdn_url
            upload_count += 1

            if upload_count % 25 == 0 or upload_count == 1:
                print(f"[{upload_count} uploaded] {filename} -> {meta['size_kb']} KB ({cdn_url})")

    print("\n--- Upload Complete ---")
    print(f"Total Images Uploaded: {upload_count}")
    print(f"Original Size: {total_original_bytes / (1024*1024):.2f} MB")
    print(f"Optimized WebP Size: {total_optimized_bytes / (1024*1024):.2f} MB")
    savings = (1 - (total_optimized_bytes / total_original_bytes)) * 100 if total_original_bytes > 0 else 0
    print(f"Bandwidth / Storage Saved: {savings:.1f}%\n")

    # Save finalized JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2, ensure_ascii=False)
    print(f"Saved full JSON to: {OUTPUT_JSON}")

    # Save finalized CSV
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
            # Clean dictionary to only known fields
            row_dict = {k: r.get(k, "") for k in fieldnames}
            writer.writerow(row_dict)
    print(f"Saved full CSV to: {OUTPUT_CSV}")


if __name__ == "__main__":
    run_pipeline()
