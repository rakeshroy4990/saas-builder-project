package com.flexshell.audio.pipeline;

import com.flexshell.audio.ConsultationAudioStorage;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

@Service
public class AudioUploadService {

    private static final long MAX_BYTES = 40L * 1024L * 1024L;
    private static final long MAX_CHUNK_BYTES = 8L * 1024L * 1024L;

    private final ConsultationAudioStorage storage;

    public AudioUploadService(ConsultationAudioStorage storage) {
        this.storage = storage;
    }

    public String sessionDir(String doctorUserId, UUID sessionId) {
        return "consultation-audio/"
                + Objects.toString(doctorUserId, "unknown").trim()
                + "/"
                + sessionId
                + "/";
    }

    public String chunkPath(String doctorUserId, UUID sessionId, int chunkIndex, String ext) {
        return sessionDir(doctorUserId, sessionId) + String.format(Locale.ROOT, "chunk-%05d%s", chunkIndex, ext);
    }

    public String storeChunk(String doctorUserId, UUID sessionId, int chunkIndex, MultipartFile file) {
        if (!storage.isEnabled()) {
            throw new IllegalStateException("AUDIO_STORAGE_UNAVAILABLE");
        }
        if (chunkIndex < 0 || chunkIndex > 10_000) {
            throw new IllegalArgumentException("AUDIO_CHUNK_INVALID");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("AUDIO_FILE_REQUIRED");
        }
        if (file.getSize() > MAX_CHUNK_BYTES) {
            throw new IllegalArgumentException("AUDIO_FILE_TOO_LARGE");
        }
        String original = Objects.toString(file.getOriginalFilename(), "chunk.webm");
        String ext = extensionOf(original, file.getContentType());
        String path = chunkPath(doctorUserId, sessionId, chunkIndex, ext);
        try {
            byte[] bytes = file.getBytes();
            storage.upload(path, bytes, Objects.toString(file.getContentType(), "audio/webm"));
            return path;
        } catch (IOException ex) {
            throw new IllegalStateException("AUDIO_UPLOAD_FAILED", ex);
        }
    }

    /** Legacy single-blob upload (full recording). */
    public String store(String doctorUserId, UUID sessionId, MultipartFile file) {
        if (!storage.isEnabled()) {
            throw new IllegalStateException("AUDIO_STORAGE_UNAVAILABLE");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("AUDIO_FILE_REQUIRED");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new IllegalArgumentException("AUDIO_FILE_TOO_LARGE");
        }
        String original = Objects.toString(file.getOriginalFilename(), "consultation.webm");
        String ext = extensionOf(original, file.getContentType());
        String path = "consultation-audio/"
                + Objects.toString(doctorUserId, "unknown").trim()
                + "/"
                + sessionId
                + ext;
        try {
            byte[] bytes = file.getBytes();
            storage.upload(path, bytes, Objects.toString(file.getContentType(), "audio/webm"));
            return path;
        } catch (IOException ex) {
            throw new IllegalStateException("AUDIO_UPLOAD_FAILED", ex);
        }
    }

    /**
     * Concatenate MediaRecorder timeslice parts (same session) for Whisper.
     * Tries {@code .webm} then {@code .m4a} per index.
     */
    public byte[] readAssembledChunks(String doctorUserId, UUID sessionId, int chunkCount) {
        if (chunkCount <= 0) {
            throw new IllegalArgumentException("AUDIO_NOT_UPLOADED");
        }
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (int i = 0; i < chunkCount; i++) {
            byte[] part = readChunkBytes(doctorUserId, sessionId, i);
            if (part == null || part.length == 0) {
                throw new IllegalArgumentException("AUDIO_CHUNK_MISSING");
            }
            out.writeBytes(part);
        }
        byte[] assembled = out.toByteArray();
        if (assembled.length > MAX_BYTES) {
            throw new IllegalArgumentException("AUDIO_FILE_TOO_LARGE");
        }
        return assembled;
    }

    private byte[] readChunkBytes(String doctorUserId, UUID sessionId, int chunkIndex) {
        for (String ext : new String[] {".webm", ".m4a", ".mp4", ".ogg", ".wav"}) {
            String path = chunkPath(doctorUserId, sessionId, chunkIndex, ext);
            try {
                return storage.readBytes(path);
            } catch (RuntimeException ignored) {
                // try next extension
            }
        }
        return null;
    }

    public byte[] read(String storagePath) {
        return storage.readBytes(storagePath);
    }

    public String accessUrl(String storagePath) {
        if (storagePath == null || storagePath.isBlank()) {
            return null;
        }
        // Prefer first chunk when path is a session directory.
        if (storagePath.endsWith("/")) {
            try {
                return storage.createAccessUrl(storagePath + "chunk-00000.webm");
            } catch (RuntimeException ex) {
                return storage.createAccessUrl(storagePath + "chunk-00000.m4a");
            }
        }
        return storage.createAccessUrl(storagePath);
    }

    private static String extensionOf(String filename, String contentType) {
        String lower = Objects.toString(filename, "").toLowerCase(Locale.ROOT);
        if (lower.endsWith(".webm")) return ".webm";
        if (lower.endsWith(".wav")) return ".wav";
        if (lower.endsWith(".mp3")) return ".mp3";
        if (lower.endsWith(".m4a")) return ".m4a";
        if (lower.endsWith(".ogg")) return ".ogg";
        String ct = Objects.toString(contentType, "").toLowerCase(Locale.ROOT);
        if (ct.contains("wav")) return ".wav";
        if (ct.contains("mpeg") || ct.contains("mp3")) return ".mp3";
        if (ct.contains("mp4") || ct.contains("m4a")) return ".m4a";
        return ".webm";
    }
}
