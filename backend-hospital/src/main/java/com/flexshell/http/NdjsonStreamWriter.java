package com.flexshell.http;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Writes newline-delimited JSON events ({@code ready}, {@code status}, {@code error}, {@code complete}, custom types).
 * Envelope keys are always lowercase {@code type}/{@code data} so clients are not affected by global PascalCase naming.
 */
public final class NdjsonStreamWriter {

    private NdjsonStreamWriter() {
    }

    public static void writeLine(OutputStream out, ObjectMapper mapper, String type, Object data) throws IOException {
        writeRawLine(out, mapper, type, data == null ? "null" : mapper.writeValueAsString(data));
    }

    public static void writeTextDelta(OutputStream out, String text) throws IOException {
        if (text == null || text.isBlank()) {
            return;
        }
        String escaped = text
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
        byte[] line = ("{\"type\":\"delta\",\"text\":\"" + escaped + "\"}\n").getBytes(StandardCharsets.UTF_8);
        out.write(line);
        out.flush();
    }

    private static void writeRawLine(OutputStream out, ObjectMapper mapper, String type, String dataJson) throws IOException {
        String escapedType = type == null ? "" : type.replace("\\", "\\\\").replace("\"", "\\\"");
        byte[] line = ("{\"type\":\"" + escapedType + "\",\"data\":" + dataJson + "}\n").getBytes(StandardCharsets.UTF_8);
        out.write(line);
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

    public static void writePing(OutputStream out, ObjectMapper mapper, String phase) throws IOException {
        writeLine(out, mapper, "ping", Map.of("phase", phase == null || phase.isBlank() ? "processing" : phase));
    }

    public static void writeComplete(OutputStream out, ObjectMapper mapper, int hitCount) throws IOException {
        writeLine(out, mapper, "complete", Map.of("hitCount", hitCount));
    }
}
