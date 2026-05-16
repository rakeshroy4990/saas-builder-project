package com.flexshell.storage;

import org.junit.jupiter.api.Test;
import software.amazon.awssdk.regions.Region;

import static org.junit.jupiter.api.Assertions.assertEquals;

class S3PrescriptionFileStorageTest {

    @Test
    void normalizeKey_stripsLeadingSlashes() {
        assertEquals("prescriptions/user-1/abc.jpg", S3PrescriptionFileStorage.normalizeKey("/prescriptions/user-1/abc.jpg"));
    }

    @Test
    void resolveSupabaseS3Region_mapsAutoToUsEast1() {
        assertEquals(Region.US_EAST_1, S3PrescriptionFileStorage.resolveSupabaseS3Region("auto"));
    }

    @Test
    void resolveSupabaseS3Region_preservesExplicitRegion() {
        assertEquals(Region.AP_SOUTH_1, S3PrescriptionFileStorage.resolveSupabaseS3Region("ap-south-1"));
    }

    @Test
    void defaultPrescriptionBucketName() {
        assertEquals("prescriptions", S3PrescriptionFileStorage.DEFAULT_PRESCRIPTION_BUCKET);
    }
}
