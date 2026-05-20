package com.flexshell.http;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Writes newline-delimited JSON events ({@code ready}, {@code status}, {@code error}, {@code complete}, custom types).
 * Matches the contract used by {@code POST /api/hospital/ai/chat} with {@code Accept: application/x-ndjson}.
 */
public final class NdjsonStreamWriter {

    private NdjsonStreamWriter() {
    }

    public static void writeLine(OutputStream out, ObjectMapper mapper, String type, Object data) throws IOException {
        Map<String, Object> wrapper = new LinkedHashMap<>();
        wrapper.put("type", type);
        if (data != null) {
            wrapper.put("data", data);
        }
        mapper.writeValue(out, wrapper);
        out.write('\n');
        out.flush();
    }

    public static void writeReady(OutputStream out, ObjectMapper mapper) throws IOException {
        writeLine(out, mapper, "ready", Map.of());
    }

    public static void writeStatus(OutputStream out, ObjectMapper mapper, String phase) throws IOException {
        writeLine(out, mapper, "status", Map.of("phase", phase));
    }

    public static void writeError(OutputStream out, ObjectMapper mapper, String message, String errorCode) throws IOException {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("message", message == null || message.isBlank() ? "Request failed" : message);
        if (errorCode != null && !errorCode.isBlank()) {
            data.put("errorCode", errorCode);
        }
        writeLine(out, mapper, "error", data);
    }

    public static void writeComplete(OutputStream out, ObjectMapper mapper, int hitCount) throws IOException {
        writeLine(out, mapper, "complete", Map.of("hitCount", hitCount));
    }
}
