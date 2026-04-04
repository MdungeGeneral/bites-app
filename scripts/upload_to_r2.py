"""
Bites — R2 Upload Script
=========================
Uploads one video file or an entire folder of videos to your Cloudflare R2
bucket so the Bites webapp picks them up automatically.

Usage (single file):
    python scripts/upload_to_r2.py <topic-name> <path/to/video.mp4> [--w]

Usage (whole folder — topic name is taken from the folder name):
    python scripts/upload_to_r2.py <path/to/folder> [--w]

Examples:
    python scripts/upload_to_r2.py Reinsurance "downloads/my-video.mp4"
    python scripts/upload_to_r2.py Reinsurance "downloads/my-video.mp4" --w
    python scripts/upload_to_r2.py "public/videos/Reinsurance"
    python scripts/upload_to_r2.py "public/videos/Reinsurance" --w

Flags:
    --w   Overwrite files that already exist in R2 (re-upload even if key is present)

Supported formats: .mp4, .webm, .mov

Requirements:
    pip install boto3

Credentials — set in .env.local:
    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
"""

import os
import sys
from pathlib import Path

SUPPORTED_EXT = {".mp4", ".webm", ".mov"}

# ── Load .env.local automatically if present ─────────────────────────────────

REPO_ROOT = Path(__file__).resolve().parent.parent
_env_local = REPO_ROOT / ".env.local"

if _env_local.exists():
    with open(_env_local) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


def make_s3_client():
    try:
        import boto3  # type: ignore
    except ImportError:
        print("ERROR: boto3 not installed. Run: pip install boto3")
        sys.exit(1)

    account_id = os.environ.get("R2_ACCOUNT_ID")
    access_key = os.environ.get("R2_ACCESS_KEY_ID")
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY")

    if not all([account_id, access_key, secret_key]):
        print(
            "ERROR: R2 credentials missing. Set these in .env.local:\n"
            "  R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY"
        )
        sys.exit(1)

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="auto",
    )


def get_existing_keys(s3, bucket: str, topic: str) -> set:
    """Return the set of R2 keys already in this topic folder."""
    from botocore.exceptions import ClientError  # type: ignore
    keys = set()
    try:
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=f"{topic}/"):
            for obj in page.get("Contents", []):
                keys.add(obj["Key"])
    except ClientError:
        pass
    return keys


def upload_file(s3, bucket: str, topic: str, video_path: Path, existing_keys: set, overwrite: bool = False, r2_key: str | None = None) -> str:
    """Upload a file. Returns 'uploaded', 'skipped', or 'error'."""
    if video_path.suffix.lower() not in SUPPORTED_EXT:
        return "skipped"

    if r2_key is None:
        r2_key = f"{topic}/{video_path.name}"

    # Check if file already exists in R2
    if r2_key in existing_keys:
        if not overwrite:
            size_mb = video_path.stat().st_size / (1024 * 1024)
            print(f"  SKIP (exists in R2, {size_mb:.1f} MB): {video_path.name}")
            return "skipped"
        else:
            # Overwrite mode: still upload but indicate it's being replaced
            print(f"  Overwriting in R2: {r2_key} …", end=" ", flush=True)
    else:
        print(f"  Uploading to R2: {r2_key} …", end=" ", flush=True)

    s3.upload_file(
        str(video_path),
        bucket,
        r2_key,
        ExtraArgs={"ContentType": "video/mp4"},
    )
    print("✓")
    return "uploaded"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--w"]
    overwrite = "--w" in sys.argv[1:]

    if len(args) == 1:
        # Folder sync mode: python upload_to_r2.py <folder>
        folder = Path(args[0]).expanduser().resolve()
        if not folder.is_dir():
            print(f"ERROR: '{folder}' is not a folder.")
            print("Usage: python scripts/upload_to_r2.py \"path/to/folder\"")
            print("       python scripts/upload_to_r2.py <topic-name> <video-file>")
            sys.exit(1)
        topic = folder.name
        files = sorted(f for f in folder.rglob("*") if f.suffix.lower() in SUPPORTED_EXT)
        if not files:
            print(f"No supported video files found in {folder} (searched recursively)")
            sys.exit(0)
        bucket = os.environ.get("R2_BUCKET_NAME")
        if not bucket:
            print("ERROR: R2_BUCKET_NAME missing from .env.local")
            sys.exit(1)
        s3 = make_s3_client()
        print(f"Syncing {len(files)} file(s) → topic '{topic}' {'(overwrite on)' if overwrite else ''}…")
        existing = get_existing_keys(s3, bucket, topic)
        results = [
            upload_file(
                s3, bucket, topic, f, existing, overwrite,
                r2_key=f"{topic}/{f.relative_to(folder).as_posix()}",
            )
            for f in files
        ]
        uploaded = results.count("uploaded")
        skipped = results.count("skipped")
        print(f"\n✓ {uploaded} uploaded, {skipped} already up-to-date.")

    elif len(args) == 2:
        # Single file mode: python upload_to_r2.py <topic> <file>
        topic = args[0]
        video_path = Path(args[1]).expanduser().resolve()
        if not video_path.exists():
            print(f"ERROR: File not found: {video_path}")
            sys.exit(1)
        bucket = os.environ.get("R2_BUCKET_NAME")
        if not bucket:
            print("ERROR: R2_BUCKET_NAME missing from .env.local")
            sys.exit(1)
        s3 = make_s3_client()
        existing = get_existing_keys(s3, bucket, topic)
        result = upload_file(s3, bucket, topic, video_path, existing, overwrite)
        if result == "uploaded":
            print("✓ Done — the video will appear in Bites on next page load.")
        else:
            print("Already up-to-date.")

    else:
        print("Usage:")
        print('  Sync folder:  python scripts/upload_to_r2.py "public/videos/My topic" [--w]')
        print("  Single file:  python scripts/upload_to_r2.py <topic-name> <video-file> [--w]")
        sys.exit(1)
