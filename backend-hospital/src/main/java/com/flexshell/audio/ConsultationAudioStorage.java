package com.flexshell.audio;

import java.nio.file.Path;

/**
 * Object/local storage for consultation audio. Independently replaceable.
 */
public interface ConsultationAudioStorage {

    boolean isEnabled();

    void upload(String storagePath, byte[] bytes, String mimeType);

    /** Short-lived download URL when supported; otherwise authenticated API path. */
    String createAccessUrl(String storagePath);

    Path resolveLocalPath(String storagePath);

    byte[] readBytes(String storagePath);
}
