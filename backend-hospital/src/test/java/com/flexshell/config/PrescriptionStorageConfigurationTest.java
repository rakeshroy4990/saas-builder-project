package com.flexshell.config;

import com.flexshell.storage.LocalPrescriptionFileStorage;
import com.flexshell.storage.PrescriptionFileStorage;
import com.flexshell.storage.S3PrescriptionFileStorage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.ObjectProvider;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PrescriptionStorageConfigurationTest {

    @TempDir
    Path tempDir;

    @Test
    void prefersS3WhenEnabled() {
        S3PrescriptionFileStorage s3 = mock(S3PrescriptionFileStorage.class);
        when(s3.isEnabled()).thenReturn(true);
        PrescriptionStorageConfiguration config = new PrescriptionStorageConfiguration();
        PrescriptionFileStorage chosen = config.prescriptionFileStorage(
                providerOf(s3),
                providerOf(null),
                providerOf(null),
                true
        );
        assertSame(s3, chosen);
    }

    @Test
    void usesLocalWhenS3DisabledAndFallbackEnabled() {
        S3PrescriptionFileStorage s3 = mock(S3PrescriptionFileStorage.class);
        when(s3.isEnabled()).thenReturn(false);
        LocalPrescriptionFileStorage local = new LocalPrescriptionFileStorage(
                tempDir.toString(),
                "http://localhost:8080"
        );
        PrescriptionStorageConfiguration config = new PrescriptionStorageConfiguration();
        PrescriptionFileStorage chosen = config.prescriptionFileStorage(
                providerOf(s3),
                providerOf(null),
                providerOf(local),
                true
        );
        assertInstanceOf(LocalPrescriptionFileStorage.class, chosen);
    }

    private static <T> ObjectProvider<T> providerOf(T value) {
        @SuppressWarnings("unchecked")
        ObjectProvider<T> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(value);
        return provider;
    }
}
