package com.flexshell.storage;

/**
 * Object storage for patient-uploaded prescription files (S3 or Supabase).
 * DB stores the object key/path only; clients receive short-lived signed URLs at download time.
 */
public interface PrescriptionFileStorage {

    boolean isEnabled();

    void upload(String storagePath, byte[] bytes, String mimeType);

    String createSignedUrl(String storagePath);
}
