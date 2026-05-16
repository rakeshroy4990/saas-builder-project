package com.flexshell.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Mirrors {@code pdf-rag-pipeline/db/image_store.py} {@code ensure_bucket_exists()}:
 * head bucket, create on 404 / NoSuchBucket.
 */
final class SupabaseS3BucketSupport {

    private static final Logger LOG = LoggerFactory.getLogger(SupabaseS3BucketSupport.class);

    private SupabaseS3BucketSupport() {
    }

    static void ensureBucketExists(S3Client s3Client, String bucket) {
        if (s3Client == null || bucket == null || bucket.isBlank()) {
            return;
        }
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
            LOG.info("patient_prescription_s3_bucket_exists bucket={}", bucket);
        } catch (NoSuchBucketException ex) {
            createBucket(s3Client, bucket);
        } catch (S3Exception ex) {
            String code = ex.awsErrorDetails() != null ? ex.awsErrorDetails().errorCode() : "";
            if (ex.statusCode() == 404 || "NoSuchBucket".equalsIgnoreCase(code) || "404".equals(code)) {
                createBucket(s3Client, bucket);
            } else {
                LOG.warn(
                        "patient_prescription_s3_bucket_head_failed bucket={} httpStatus={} awsErrorCode={} message={}",
                        bucket,
                        ex.statusCode(),
                        code,
                        ex.getMessage()
                );
            }
        }
    }

    private static void createBucket(S3Client s3Client, String bucket) {
        try {
            s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
            LOG.info("patient_prescription_s3_bucket_created bucket={}", bucket);
        } catch (S3Exception ex) {
            LOG.warn(
                    "patient_prescription_s3_bucket_create_failed bucket={} httpStatus={} awsErrorCode={} message={}",
                    bucket,
                    ex.statusCode(),
                    ex.awsErrorDetails() != null ? ex.awsErrorDetails().errorCode() : "",
                    ex.getMessage(),
                    ex
            );
        } catch (Exception ex) {
            LOG.warn("patient_prescription_s3_bucket_create_failed bucket={} message={}", bucket, ex.getMessage(), ex);
        }
    }
}
