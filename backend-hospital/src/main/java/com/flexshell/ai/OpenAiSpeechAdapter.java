package com.flexshell.ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * OpenAI Whisper / audio transcriptions adapter. Isolated from chat/vision logic.
 */
@Component
public class OpenAiSpeechAdapter {

    private static final Logger LOG = LoggerFactory.getLogger(OpenAiSpeechAdapter.class);

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final String apiKey;
    private final String baseUrl;
    private final String transcriptionPath;
    private final String model;
    private final int timeoutMs;

    public OpenAiSpeechAdapter(
            ObjectMapper objectMapper,
            @Value("${app.ai.openai.api-key:}") String apiKey,
            @Value("${app.ai.openai.base-url:https://api.openai.com}") String baseUrl,
            @Value("${app.ai.openai.transcription-path:/v1/audio/transcriptions}") String transcriptionPath,
            @Value("${app.ai.openai.speech-model:whisper-1}") String model,
            @Value("${app.ai.conversation.stt-timeout-ms:180000}") int timeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = Objects.toString(apiKey, "").trim();
        this.baseUrl = Objects.toString(baseUrl, "https://api.openai.com").trim();
        this.transcriptionPath = Objects.toString(transcriptionPath, "/v1/audio/transcriptions").trim();
        this.model = Objects.toString(model, "whisper-1").trim();
        this.timeoutMs = Math.max(30_000, timeoutMs);
        this.httpClient = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(20)).build();
    }

    public record TranscriptionResult(String text, String language) {}

    public TranscriptionResult transcribe(byte[] audioBytes, String filename, String mimeType, String languageHint) {
        if (apiKey.isBlank()) {
            throw new AiProviderException(
                    AiProviderException.Kind.CONFIG_MISSING,
                    "OpenAI API key is not configured for speech transcription."
            );
        }
        if (audioBytes == null || audioBytes.length == 0) {
            throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, "Empty audio payload.");
        }
        String boundary = "----FlexShellAudio" + UUID.randomUUID().toString().replace("-", "");
        String safeName = Objects.toString(filename, "consultation.webm").trim();
        if (safeName.isBlank()) {
            safeName = "consultation.webm";
        }
        String contentType = Objects.toString(mimeType, "audio/webm").trim();
        if (contentType.isBlank()) {
            contentType = "audio/webm";
        }

        byte[] body = buildMultipartBody(boundary, audioBytes, safeName, contentType, languageHint);
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(joinUrl(baseUrl, transcriptionPath)))
                    .timeout(Duration.ofMillis(timeoutMs))
                    .header("Authorization", "Bearer " + apiKey)
                    .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                    .POST(HttpRequest.BodyPublishers.ofByteArray(body))
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                LOG.warn("openai_speech_transcribe_http status={}", response.statusCode());
                throw new AiProviderException(
                        AiProviderException.Kind.PROVIDER_FAILED,
                        "Speech transcription failed.",
                        "openai",
                        response.statusCode(),
                        ""
                );
            }
            JsonNode root = objectMapper.readTree(response.body());
            String text = root.path("text").asText("").trim();
            String language = root.path("language").asText("").trim();
            if (text.isBlank()) {
                throw new AiProviderException(AiProviderException.Kind.PROVIDER_FAILED, "Empty transcription.");
            }
            return new TranscriptionResult(text, language);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Speech transcription interrupted."
            );
        } catch (IOException ex) {
            throw new AiProviderException(
                    AiProviderException.Kind.PROVIDER_FAILED,
                    "Speech transcription unavailable."
            );
        }
    }

    private byte[] buildMultipartBody(
            String boundary,
            byte[] audioBytes,
            String filename,
            String contentType,
            String languageHint
    ) {
        StringBuilder preamble = new StringBuilder();
        preamble.append("--").append(boundary).append("\r\n");
        preamble.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n");
        preamble.append(model).append("\r\n");

        preamble.append("--").append(boundary).append("\r\n");
        preamble.append("Content-Disposition: form-data; name=\"response_format\"\r\n\r\n");
        preamble.append("verbose_json").append("\r\n");

        // Mixed-language: omit language when hint is mixed/blank so Whisper auto-detects.
        String hint = Objects.toString(languageHint, "").trim().toLowerCase(Locale.ROOT);
        if (!hint.isBlank() && !"mixed".equals(hint) && !"auto".equals(hint)) {
            String lang = switch (hint) {
                case "hi", "hindi" -> "hi";
                case "kn", "kannada" -> "kn";
                case "en", "english" -> "en";
                default -> hint.length() == 2 ? hint : "";
            };
            if (!lang.isBlank()) {
                preamble.append("--").append(boundary).append("\r\n");
                preamble.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n");
                preamble.append(lang).append("\r\n");
            }
        }

        preamble.append("--").append(boundary).append("\r\n");
        preamble.append("Content-Disposition: form-data; name=\"prompt\"\r\n\r\n");
        preamble.append(
                "Medical consultation in English, Hindi, and/or Kannada. Preserve original language words."
        ).append("\r\n");

        preamble.append("--").append(boundary).append("\r\n");
        preamble.append("Content-Disposition: form-data; name=\"file\"; filename=\"")
                .append(filename.replace("\"", ""))
                .append("\"\r\n");
        preamble.append("Content-Type: ").append(contentType).append("\r\n\r\n");

        byte[] head = preamble.toString().getBytes(StandardCharsets.UTF_8);
        byte[] tail = ("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8);
        byte[] out = new byte[head.length + audioBytes.length + tail.length];
        System.arraycopy(head, 0, out, 0, head.length);
        System.arraycopy(audioBytes, 0, out, head.length, audioBytes.length);
        System.arraycopy(tail, 0, out, head.length + audioBytes.length, tail.length);
        return out;
    }

    private static String joinUrl(String base, String path) {
        String b = Objects.toString(base, "").trim();
        String p = Objects.toString(path, "").trim();
        if (b.endsWith("/") && p.startsWith("/")) {
            return b.substring(0, b.length() - 1) + p;
        }
        if (!b.endsWith("/") && !p.startsWith("/")) {
            return b + "/" + p;
        }
        return b + p;
    }
}
