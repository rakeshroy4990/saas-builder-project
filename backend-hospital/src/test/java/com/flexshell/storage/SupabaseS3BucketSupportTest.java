package com.flexshell.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SupabaseS3BucketSupportTest {

    @Mock
    private S3Client s3Client;

    @Test
    void createsBucketWhenHeadReturnsNoSuchBucket() {
        when(s3Client.headBucket(any(HeadBucketRequest.class)))
                .thenThrow(NoSuchBucketException.builder().message("not found").build());

        SupabaseS3BucketSupport.ensureBucketExists(s3Client, "prescriptions");

        ArgumentCaptor<CreateBucketRequest> captor = ArgumentCaptor.forClass(CreateBucketRequest.class);
        verify(s3Client).createBucket(captor.capture());
        assertEquals("prescriptions", captor.getValue().bucket());
    }

    @Test
    void doesNotCreateWhenBucketExists() {
        SupabaseS3BucketSupport.ensureBucketExists(s3Client, "prescriptions");
        verify(s3Client).headBucket(any(HeadBucketRequest.class));
        verify(s3Client, never()).createBucket(any(CreateBucketRequest.class));
    }
}
