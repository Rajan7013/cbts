"""
Cloudflare R2 Storage Client for ExamPulse-AI
All credentials and secrets are loaded securely from the .env file.
NEVER hardcode API keys or secrets in source files.
"""

import os
from pathlib import Path
from typing import Optional
import boto3
from botocore.config import Config
from dotenv import load_dotenv

# Automatically locate and load .env from the project root
PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = PROJECT_ROOT / ".env"
load_dotenv(dotenv_path=ENV_PATH)

# Fetch configuration from environment
ACCOUNT_ID = os.getenv("CLOUDFLARE_R2_ACCOUNT_ID")
ACCESS_KEY_ID = os.getenv("CLOUDFLARE_R2_ACCESS_KEY_ID")
SECRET_ACCESS_KEY = os.getenv("CLOUDFLARE_R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.getenv("CLOUDFLARE_R2_BUCKET_NAME", "tests")
ENDPOINT_URL = os.getenv("CLOUDFLARE_R2_ENDPOINT") or (
    f"https://{ACCOUNT_ID}.r2.cloudflarestorage.com" if ACCOUNT_ID else None
)
PUBLIC_URL_BASE = os.getenv(
    "CLOUDFLARE_R2_PUBLIC_URL", "https://pub-3c0f2e75cc644f25a52b78864c2e6f5e.r2.dev"
).rstrip("/")


def get_s3_client():
    """Initializes and returns an S3 client configured for Cloudflare R2."""
    if not ACCESS_KEY_ID or not SECRET_ACCESS_KEY or not ENDPOINT_URL:
        raise ValueError(
            "Missing Cloudflare R2 credentials in .env! "
            "Please ensure CLOUDFLARE_R2_ACCESS_KEY_ID, CLOUDFLARE_R2_SECRET_ACCESS_KEY, "
            "and CLOUDFLARE_R2_ENDPOINT (or ACCOUNT_ID) are defined."
        )

    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT_URL,
        aws_access_key_id=ACCESS_KEY_ID,
        aws_secret_access_key=SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )


def get_public_url(remote_key: str) -> str:
    """Returns the full public CDN URL for a given stored object key."""
    clean_key = remote_key.lstrip("/")
    return f"{PUBLIC_URL_BASE}/{clean_key}"


def upload_file(
    local_path: str,
    remote_key: str,
    content_type: Optional[str] = None,
    cache_control: str = "public, max-age=31536000, immutable",
) -> str:
    """
    Uploads a local file to Cloudflare R2 and returns its public URL.
    """
    s3 = get_s3_client()
    extra_args = {"CacheControl": cache_control}

    # Infer content type if not provided
    if not content_type:
        ext = Path(local_path).suffix.lower()
        content_type_map = {
            ".webp": "image/webp",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".txt": "text/plain",
        }
        content_type = content_type_map.get(ext, "application/octet-stream")

    extra_args["ContentType"] = content_type

    s3.upload_file(local_path, BUCKET_NAME, remote_key.lstrip("/"), ExtraArgs=extra_args)
    return get_public_url(remote_key)


def upload_bytes(
    data: bytes,
    remote_key: str,
    content_type: str = "image/webp",
    cache_control: str = "public, max-age=31536000, immutable",
) -> str:
    """
    Uploads raw bytes to Cloudflare R2 and returns its public URL.
    """
    s3 = get_s3_client()
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=remote_key.lstrip("/"),
        Body=data,
        ContentType=content_type,
        CacheControl=cache_control,
    )
    return get_public_url(remote_key)


if __name__ == "__main__":
    # Self-test: Verifies credentials strictly loaded from .env
    print(f"Loaded credentials from: {ENV_PATH}")
    print(f"Bucket: {BUCKET_NAME}")
    print(f"Endpoint: {ENDPOINT_URL}")
    print(f"Public Base URL: {PUBLIC_URL_BASE}")
    try:
        client = get_s3_client()
        res = client.list_objects_v2(Bucket=BUCKET_NAME, MaxKeys=5)
        print("Success! R2 connected securely via .env. Objects in bucket:", res.get("KeyCount", 0))
    except Exception as e:
        print("Error connecting to R2:", e)
