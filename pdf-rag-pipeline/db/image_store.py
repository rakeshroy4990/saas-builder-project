import os
import re
import logging
import boto3
from botocore.exceptions import ClientError
from botocore.config import Config


logger = logging.getLogger(__name__)

BUCKET = "chunk-images"

_s3 = None

def _get_s3():
    global _s3
    if _s3 is None:
        _s3 = boto3.client(
            "s3",
            endpoint_url=os.environ["SUPABASE_S3_ENDPOINT"],
            aws_access_key_id=os.environ["SUPABASE_S3_ACCESS_KEY"],
            aws_secret_access_key=os.environ["SUPABASE_S3_SECRET_KEY"],
            region_name=os.environ.get("SUPABASE_S3_REGION", "auto"),
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},
            ),
        )
    return _s3


def ensure_bucket_exists() -> None:
    s3 = _get_s3()
    try:
        s3.head_bucket(Bucket=BUCKET)
        logger.info(f"[ImageStore] Bucket '{BUCKET}' already exists")
    except ClientError as e:
        error_code = e.response["Error"]["Code"]
        if error_code in ("404", "NoSuchBucket"):
            try:
                s3.create_bucket(Bucket=BUCKET)
                logger.info(f"[ImageStore] Created bucket '{BUCKET}'")
            except Exception as create_err:
                logger.warning(f"[ImageStore] Could not create bucket: {create_err}")
        else:
            logger.warning(f"[ImageStore] Could not check bucket: {e}")


def upload_image(
    file_hash: str,
    page_num: int,
    chunk_index: int,
    img_index: int,
    img_bytes: bytes,
    ext: str = "png",
) -> str | None:
    s3  = _get_s3()
    key = f"{file_hash}/p{page_num}_c{chunk_index}_img{img_index}.{ext}"

    try:
        s3.put_object(
            Bucket=BUCKET,
            Key=key,
            Body=img_bytes,
            ContentType=f"image/{ext}",
        )
        return build_public_image_url(file_hash, page_num, chunk_index, img_index, ext)
    except Exception as e:
        logger.warning(f"[ImageStore] Upload failed for {key}: {e}")
        return None


def build_public_image_url(
    file_hash: str,
    page_num: int,
    chunk_index: int,
    img_index: int,
    ext: str = "png",
) -> str:
    key = f"{file_hash}/p{page_num}_c{chunk_index}_img{img_index}.{ext}"
    base = os.environ["SUPABASE_URL"].rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/{key}"


def delete_images_for_file(file_hash: str) -> None:
    s3 = _get_s3()
    try:
        objects = s3.list_objects_v2(Bucket=BUCKET, Prefix=f"{file_hash}/")
        keys = [o["Key"] for o in objects.get("Contents", [])]
        if keys:
            s3.delete_objects(
                Bucket=BUCKET,
                Delete={"Objects": [{"Key": k} for k in keys]},
            )
            logger.info(f"[ImageStore] Deleted {len(keys)} images for {file_hash}")
    except Exception as e:
        logger.warning(f"[ImageStore] Delete failed for {file_hash}: {e}")


_MARKER_PAGE_RE = re.compile(r"marker/p(\d+)_b\d+_img\d+\.")


def _marker_object_key(
    file_hash: str,
    batch_index: int,
    seq_img: int,
    page_hint: int,
    ext: str,
) -> str:
    ext = (ext or "png").lower()
    if ext == "jpeg":
        ext = "jpg"
    if ext not in {"png", "jpg", "webp", "gif"}:
        ext = "png"
    return f"{file_hash}/marker/p{page_hint}_b{batch_index}_img{seq_img}.{ext}"


def build_marker_image_url(
    file_hash: str,
    batch_index: int,
    seq_img: int,
    page_hint: int,
    ext: str = "png",
) -> str:
    key = _marker_object_key(file_hash, batch_index, seq_img, page_hint, ext)
    base = os.environ["SUPABASE_URL"].rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/{key}"


def upload_marker_image(
    file_hash: str,
    batch_index: int,
    seq_img: int,
    page_hint: int,
    img_bytes: bytes,
    ext: str = "png",
) -> str | None:
    ext = (ext or "png").lower()
    if ext == "jpeg":
        ext = "jpg"
    if ext not in {"png", "jpg", "webp", "gif"}:
        ext = "png"
    key = _marker_object_key(file_hash, batch_index, seq_img, page_hint, ext)
    ctype = "image/jpeg" if ext == "jpg" else f"image/{ext}"
    s3 = _get_s3()
    try:
        s3.put_object(Bucket=BUCKET, Key=key, Body=img_bytes, ContentType=ctype)
        return build_marker_image_url(file_hash, batch_index, seq_img, page_hint, ext)
    except Exception as e:
        logger.warning("[ImageStore] Marker upload failed for %s: %s", key, e)
        return None


def delete_marker_images_for_page_range(file_hash: str, p0: int, p1: int) -> None:
    """Delete Marker pipeline figures whose key encodes PDF page_hint in [p0, p1] (0-based)."""
    s3 = _get_s3()
    prefix = f"{file_hash}/marker/"
    try:
        paginator = s3.get_paginator("list_objects_v2")
        to_delete: list[str] = []
        for page in paginator.paginate(Bucket=BUCKET, Prefix=prefix):
            for o in page.get("Contents", []) or []:
                key = o.get("Key") or ""
                m = _MARKER_PAGE_RE.search(key)
                if not m:
                    continue
                ph = int(m.group(1))
                if p0 <= ph <= p1:
                    to_delete.append(key)
        if not to_delete:
            return
        for i in range(0, len(to_delete), 900):
            batch = to_delete[i : i + 900]
            s3.delete_objects(Bucket=BUCKET, Delete={"Objects": [{"Key": k} for k in batch]})
        logger.info("[ImageStore] Deleted %s marker images for %s pages %s–%s", len(to_delete), file_hash, p0, p1)
    except Exception as e:
        logger.warning("[ImageStore] Marker delete failed for %s: %s", file_hash, e)