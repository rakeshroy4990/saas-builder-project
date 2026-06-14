package com.flexshell.config;

import com.flexshell.storage.LocalPrescriptionFileStorage;
import com.flexshell.storage.PrescriptionFileStorage;
import com.flexshell.storage.S3PrescriptionFileStorage;
import com.flexshell.storage.SupabaseStorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class PrescriptionStorageConfiguration {

    private static final Logger LOG = LoggerFactory.getLogger(PrescriptionStorageConfiguration.class);

    @Bean
    @Primary
    PrescriptionFileStorage prescriptionFileStorage(
            ObjectProvider<S3PrescriptionFileStorage> s3Storage,
            ObjectProvider<SupabaseStorageService> supabaseStorage,
            ObjectProvider<LocalPrescriptionFileStorage> localStorage,
            @Value("${app.prescription.storage.local-fallback:false}") boolean localFallback
    ) {
        S3PrescriptionFileStorage s3 = s3Storage.getIfAvailable();
        if (s3 != null && s3.isEnabled()) {
            LOG.info("patient_prescription_storage_selected backend=s3 {}", s3.describeConfiguration());
            return s3;
        }
        if (s3 != null) {
            LOG.warn("patient_prescription_storage_s3_not_ready {}", s3.describeConfiguration());
        } else {
            LOG.warn("patient_prescription_storage_s3_bean_missing (APP_PRESCRIPTION_STORAGE_PROVIDER may not be s3)");
        }
        SupabaseStorageService supabase = supabaseStorage.getIfAvailable();
        if (supabase != null && supabase.isEnabled()) {
            LOG.info("patient_prescription_storage_selected backend=supabase_rest enabled=true");
            return supabase;
        }
        if (supabase != null) {
            LOG.warn("patient_prescription_storage_supabase_rest_not_ready enabled=false");
        }
        if (localFallback) {
            LocalPrescriptionFileStorage local = localStorage.getIfAvailable();
            if (local != null) {
                LOG.warn(
                        "patient_prescription_storage_selected backend=local_fallback dir={} "
                                + "(S3 credentials missing or disabled)",
                        local.baseDir()
                );
                return local;
            }
            LOG.warn("patient_prescription_storage_local_fallback_requested but LocalPrescriptionFileStorage bean missing");
        } else {
            LOG.warn(
                    "patient_prescription_storage_local_fallback=false; uploads will fail until S3 or Supabase REST is configured"
            );
        }
        if (s3 != null) {
            LOG.error(
                    "patient_prescription_storage_unavailable returning_disabled_s3_bean. "
                            + "Set SUPABASE_S3_ACCESS_KEY/SECRET, or APP_PRESCRIPTION_STORAGE_LOCAL_FALLBACK=true"
            );
            return s3;
        }
        throw new IllegalStateException("No PrescriptionFileStorage implementation available");
    }
}
