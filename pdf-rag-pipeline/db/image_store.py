import os
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