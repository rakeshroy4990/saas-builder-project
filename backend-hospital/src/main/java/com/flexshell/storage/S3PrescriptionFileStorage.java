package com.flexshell.storage;

import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.retry.RetryMode;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

import java.net.URI;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/**
 * Supabase Storage S3-compatible API for prescription uploads (same env contract as
 * {@code pdf-rag-pipeline/db/image_store.py}: {@code SUPABASE_S3_ENDPOINT}, {@code SUPABASE_S3_ACCESS_KEY},
 * {@code SUPABASE_S3_SECRET_KEY}, {@code SUPABASE_S3_REGION}, and bucket
 * {@code PRESCRIPTION_STORAGE_BUCKET} (default {@code prescription}).
 * On startup calls {@link SupabaseS3BucketSupport#ensureBucketExists} like pdf-rag {@code ensure_bucket_exists()}.
 */
@Service
@ConditionalOnProperty(name = "app.prescription.storage.provider", havingValue = "s3", matchIfMissing = true)
public class S3PrescriptionFileStorage implements PrescriptionFileStorage {

    /** Default Supabase storage bucket for patient prescriptions (object keys: {userId}/{fileId}.ext). */
    public static final String DEFAULT_PRESCRIPTION_BUCKET = "prescription";

    private static final Logger LOG = LoggerFactory.getLogger(S3PrescriptionFileStorage.class);

    private final String bucket;
    private final String endpointForLog;
    private final String signingRegionForLog;
    private final boolean bucketSet;
    private final boolean endpointSet;
    private final boolean accessKeySet;
    private final boolean secretKeySet;
    private final int signedUrlTtlSeconds;
    private final boolean enabled;
    private final S3Client s3Client;
    private final S3Presigner presigner;

    public S3PrescriptionFileStorage(
            @Value("${app.prescription.storage.bucket:prescription}") String bucket,
            @Value("${SUPABASE_S3_ENDPOINT:}") String supabaseS3Endpoint,
            @Value("${SUPABASE_S3_REGION:auto}") String supabaseS3Region,
            @Value("${SUPABASE_S3_ACCESS_KEY:}") String supabaseS3AccessKey,
            @Value("${SUPABASE_S3_SECRET_KEY:}") String supabaseS3SecretKey,
            @Value("${app.prescription.storage.signed-url-ttl-seconds:900}") int signedUrlTtlSeconds
    ) {
        this.bucket = Objects.toString(bucket, "").trim();
        this.signedUrlTtlSeconds = Math.max(60, Math.min(3600, signedUrlTtlSeconds));
        String endpoint = Objects.toString(supabaseS3Endpoint, "").trim();
        String accessKey = Objects.toString(supabaseS3AccessKey, "").trim();
        String secretKey = Objects.toString(supabaseS3SecretKey, "").trim();
        this.bucketSet = !this.bucket.isBlank();
        this.endpointSet = !endpoint.isBlank();
        this.accessKeySet = !accessKey.isBlank();
        this.secretKeySet = !secretKey.isBlank();
        this.enabled = bucketSet && endpointSet && accessKeySet && secretKeySet;
        this.endpointForLog = endpointHost(endpoint);
        if (this.enabled) {
            Region awsRegion = resolveSupabaseS3Region(supabaseS3Region);
            this.signingRegionForLog = awsRegion.id();
            var credentials = StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey));
            S3Configuration serviceConfiguration = S3Configuration.builder()
                    .pathStyleAccessEnabled(true)
                    .build();
            ClientOverrideConfiguration clientConfig = ClientOverrideConfiguration.builder()
                    .retryStrategy(RetryMode.STANDARD)
                    .build();
            URI endpointUri = URI.create(endpoint);
            this.s3Client = S3Client.builder()
                    .region(awsRegion)
                    .endpointOverride(endpointUri)
                    .credentialsProvider(credentials)
                    .serviceConfiguration(serviceConfiguration)
                    .overrideConfiguration(clientConfig)
                    .build();
            this.presigner = S3Presigner.builder()
                    .region(awsRegion)
                    .endpointOverride(endpointUri)
                    .credentialsProvider(credentials)
                    .serviceConfiguration(serviceConfiguration)
                    .build();
            SupabaseS3BucketSupport.ensureBucketExists(this.s3Client, this.bucket);
        } else {
            this.signingRegionForLog = "";
            this.s3Client = null;
            this.presigner = null;
        }
        LOG.info(
                "patient_prescription_s3_init enabled={} bucketSet={} endpointSet={} accessKeySet={} secretKeySet={} "
                        + "bucket={} endpointHost={} signingRegion={}",
                enabled,
                bucketSet,
                endpointSet,
                accessKeySet,
                secretKeySet,
                bucketSet ? bucket : "(unset)",
                endpointSet ? endpointForLog : "(unset)",
                enabled ? signingRegionForLog : "n/a"
        );
        if (!enabled) {
            LOG.warn(
                    "patient_prescription_s3_disabled missing={}",
                    String.join(
                            ",",
                            missingConfigLabels(bucketSet, endpointSet, accessKeySet, secretKeySet)
                    )
            );
        }
    }

    /** Safe summary for startup / troubleshooting (no secrets). */
    public String describeConfiguration() {
        return "enabled="
                + enabled
                + " bucketSet="
                + bucketSet
                + " endpointSet="
                + endpointSet
                + " accessKeySet="
                + accessKeySet
                + " secretKeySet="
                + secretKeySet
                + " bucket="
                + (bucketSet ? bucket : "(unset)")
                + " endpointHost="
                + (endpointSet ? endpointForLog : "(unset)")
                + " signingRegion="
                + (enabled ? signingRegionForLog : "n/a");
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public void upload(String storagePath, byte[] bytes, String mimeType) {
        requireEnabled();
        String key = normalizeKey(storagePath);
        String contentType = mimeType == null || mimeType.isBlank() ? "application/octet-stream" : mimeType;
        int size = bytes == null ? 0 : bytes.length;
        LOG.info(
                "patient_prescription_s3_upload_start bucket={} key={} bytes={} contentType={}",
                bucket,
                key,
                size,
                contentType
        );
        PutObjectRequest request = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType)
                .contentLength((long) size)
                .build();
        try {
            s3Client.putObject(request, RequestBody.fromBytes(bytes));
            LOG.info("patient_prescription_s3_upload_ok bucket={} key={} bytes={}", bucket, key, size);
        } catch (S3Exception ex) {
            if (isNoSuchBucket(ex)) {
                LOG.warn("patient_prescription_s3_upload_no_such_bucket bucket={} — attempting create then retry", bucket);
                SupabaseS3BucketSupport.ensureBucketExists(s3Client, bucket);
                try {
                    s3Client.putObject(request, RequestBody.fromBytes(bytes));
                    LOG.info("patient_prescription_s3_upload_ok bucket={} key={} bytes={} (after bucket ensure)", bucket, key, size);
                    return;
                } catch (S3Exception retryEx) {
                    ex = retryEx;
                }
            }
            LOG.error(
                    "patient_prescription_s3_upload_failed type=S3Exception bucket={} key={} httpStatus={} "
                            + "awsErrorCode={} awsErrorMessage={} requestId={}",
                    bucket,
                    key,
                    ex.statusCode(),
                    ex.awsErrorDetails() != null ? ex.awsErrorDetails().errorCode() : "unknown",
                    ex.awsErrorDetails() != null ? ex.awsErrorDetails().errorMessage() : ex.getMessage(),
                    ex.requestId(),
                    ex
            );
            throw storageFailure("S3 upload rejected", ex);
        } catch (SdkClientException ex) {
            LOG.error(
                    "patient_prescription_s3_upload_failed type=SdkClientException bucket={} key={} message={}",
                    bucket,
                    key,
                    ex.getMessage(),
                    ex
            );
            throw storageFailure("S3 client error during upload", ex);
        }
    }

    @Override
    public String createSignedUrl(String storagePath) {
        requireEnabled();
        String key = normalizeKey(storagePath);
        LOG.debug("patient_prescription_s3_presign_start bucket={} key={} ttlSeconds={}", bucket, key, signedUrlTtlSeconds);
        try {
            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofSeconds(signedUrlTtlSeconds))
                    .getObjectRequest(builder -> builder.bucket(bucket).key(key))
                    .build();
            PresignedGetObjectRequest presigned = presigner.presignGetObject(presignRequest);
            return presigned.url().toExternalForm();
        } catch (S3Exception | SdkClientException ex) {
            LOG.error(
                    "patient_prescription_s3_presign_failed bucket={} key={} message={}",
                    bucket,
                    key,
                    ex.getMessage(),
                    ex
            );
            throw storageFailure("S3 presign failed", ex);
        }
    }

    @PreDestroy
    void closeClients() {
        if (s3Client != null) {
            s3Client.close();
        }
        if (presigner != null) {
            presigner.close();
        }
    }

    private void requireEnabled() {
        if (!enabled) {
            throw new IllegalStateException(
                    "Supabase S3 prescription storage is not configured "
                            + "(set PRESCRIPTION_STORAGE_BUCKET, SUPABASE_S3_ENDPOINT, "
                            + "SUPABASE_S3_ACCESS_KEY, SUPABASE_S3_SECRET_KEY)"
            );
        }
    }

    private static boolean isNoSuchBucket(S3Exception ex) {
        if (ex instanceof NoSuchBucketException) {
            return true;
        }
        String code = ex.awsErrorDetails() != null ? ex.awsErrorDetails().errorCode() : "";
        return ex.statusCode() == 404 || "NoSuchBucket".equalsIgnoreCase(code);
    }

    /**
     * Supabase uses {@code region_name=auto} in boto3; the Java SDK needs a concrete signing region.
     */
    static Region resolveSupabaseS3Region(String configured) {
        String region = Objects.toString(configured, "").trim();
        if (region.isBlank() || "auto".equalsIgnoreCase(region)) {
            return Region.US_EAST_1;
        }
        return Region.of(region);
    }

    static String normalizeKey(String storagePath) {
        String normalized = Objects.toString(storagePath, "").trim().replace("\\", "/");
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        return normalized;
    }

    private static IllegalStateException storageFailure(String summary, Exception cause) {
        String detail = cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage();
        return new IllegalStateException(summary + ": " + detail, cause);
    }

    private static String endpointHost(String endpoint) {
        if (endpoint.isBlank()) {
            return "(unset)";
        }
        try {
            return URI.create(endpoint).getHost();
        } catch (Exception ex) {
            return "(invalid-uri)";
        }
    }

    private static String[] missingConfigLabels(boolean bucketSet, boolean endpointSet, boolean accessKeySet, boolean secretKeySet) {
        List<String> missing = new ArrayList<>();
        if (!bucketSet) {
            missing.add("PRESCRIPTION_STORAGE_BUCKET");
        }
        if (!endpointSet) {
            missing.add("SUPABASE_S3_ENDPOINT");
        }
        if (!accessKeySet) {
            missing.add("SUPABASE_S3_ACCESS_KEY");
        }
        if (!secretKeySet) {
            missing.add("SUPABASE_S3_SECRET_KEY");
        }
        return missing.toArray(String[]::new);
    }
}
