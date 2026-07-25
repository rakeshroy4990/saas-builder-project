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
 * OpenAI speech transcription adapter (Whisper / GPT-4o Transcribe). Isolated from chat/vision logic.
 */
@Component
public class OpenAiSpeechAdapter {

    private static final Logger LOG = LoggerFactory.getLogger(OpenAiSpeechAdapter.class);

    private static final String PROMPT_HI = "\u092f\u0939 \u090f\u0915 \u0921\u0949\u0915\u094d\u091f\u0930-\u0930\u094b\u0917\u0940 \u091a\u093f\u0915\u093f\u0924\u094d\u0938\u093e \u092a\u0930\u093e\u092e\u0930\u094d\u0936 \u0915\u0940 \u0911\u0921\u093f\u092f\u094b \u0939\u0948\u0964 \u0915\u0947\u0935\u0932 \u092c\u094b\u0932\u0947 \u0917\u090f \u0936\u092c\u094d\u0926\u094b\u0902 \u0915\u094b \u0926\u0947\u0935\u0928\u093e\u0917\u0930\u0940 \u0939\u093f\u0902\u0926\u0940 \u092e\u0947\u0902 \u0932\u093f\u0916\u0947\u0902\u0964 \u0915\u094b\u0908 \u0936\u092c\u094d\u0926 \u0928 \u091b\u094b\u0921\u093c\u0947\u0902, \u0938\u0902\u0915\u094d\u0937\u0947\u092a \u0928 \u092c\u0928\u093e\u090f\u0901, \u0905\u0902\u0917\u094d\u0930\u0947\u091c\u093c\u0940 \u092e\u0947\u0902 \u0905\u0928\u0941\u0935\u093e\u0926 \u0928 \u0915\u0930\u0947\u0902\u0964 \u0905\u0902\u0917\u094d\u0930\u0947\u091c\u093c\u0940 \u0926\u0935\u093e/\u0932\u0948\u092c \u0928\u093e\u092e (\u091c\u0948\u0938\u0947 Paracetamol, CBC) \u0909\u0938\u0940 \u0930\u0942\u092a \u092e\u0947\u0902 \u0930\u0916\u0947\u0902 \u091c\u0948\u0938\u093e \u092c\u094b\u0932\u093e \u0917\u092f\u093e\u0964 \u0935\u093f\u0930\u093e\u092e \u091a\u093f\u0939\u094d\u0928 \u0920\u0940\u0915 \u0938\u0947 \u0932\u0917\u093e\u090f\u0901\u0964 \u0916\u093e\u0902\u0938\u0940/\u0936\u094b\u0930 \u0906\u0926\u093f \u0928 \u0932\u093f\u0916\u0947\u0902\u0964 \u0909\u0926\u093e\u0939\u0930\u0923 \u0936\u092c\u094d\u0926\u093e\u0935\u0932\u0940: \u092c\u0941\u0916\u093e\u0930, \u0916\u093e\u0902\u0938\u0940, \u0938\u093e\u0902\u0938 \u092b\u0942\u0932\u0928\u093e, \u092a\u0947\u091f \u0926\u0930\u094d\u0926, \u0926\u0938\u094d\u0924, \u0909\u0932\u094d\u091f\u0940, \u0938\u093f\u0930\u0926\u0930\u094d\u0926, \u0915\u092e\u091c\u094b\u0930\u0940, \u092c\u094d\u0932\u0921 \u092a\u094d\u0930\u0947\u0936\u0930, \u0936\u0941\u0917\u0930, \u090f\u0932\u0930\u094d\u091c\u0940, \u090f\u0902\u091f\u0940\u092c\u093e\u092f\u094b\u091f\u093f\u0915, \u0938\u093f\u0930\u092a, \u091f\u0947\u092c\u0932\u0947\u091f, \u0916\u0941\u0930\u093e\u0915, \u0926\u093f\u0928 \u092e\u0947\u0902 \u0924\u0940\u0928 \u092c\u093e\u0930\u0964";

    private static final String PROMPT_KN = "This is a doctor-patient medical consultation in Kannada. Transcribe every spoken word in Kannada script. Do not omit, summarize, or translate to English. Keep drug/lab names as spoken. Do not write coughs/noises.";

    private static final String PROMPT_EN = "Medical doctor-patient consultation. Transcribe every spoken word exactly. Do not omit, summarize, translate, or clean up speech. Keep medical terms as spoken. Ignore non-speech noises (coughs, clicks). Use correct punctuation.";

    private static final String PROMPT_MIXED = "Doctor-patient consultation that may mix Hindi (\u0926\u0947\u0935\u0928\u093e\u0917\u0930\u0940), Kannada, and English (Hinglish). Transcribe EVERY spoken word. Do not omit, summarize, or translate. Write Hindi in Devanagari. Write Kannada in Kannada script. Keep English medical terms in English. Example terms: \u092c\u0941\u0916\u093e\u0930, \u0916\u093e\u0902\u0938\u0940, \u0938\u093e\u0902\u0938, \u0926\u0930\u094d\u0926, \u0926\u0935\u093e\u0908, \u091f\u0947\u092c\u0932\u0947\u091f, Paracetamol, BP, sugar, allergy. Ignore non-speech noises.";

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
            @Value("${app.ai.openai.speech-model:gpt-4o-transcribe}") String model,
            @Value("${app.ai.conversation.stt-timeout-ms:180000}") int timeoutMs
    ) {
        this.objectMapper = objectMapper;
        this.apiKey = Objects.toString(apiKey, "").trim();
        this.baseUrl = Objects.toString(baseUrl, "https://api.openai.com").trim();
        this.transcriptionPath = Objects.toString(transcriptionPath, "/v1/audio/transcriptions").trim();
        this.model = Objects.toString(model, "gpt-4o-transcribe").trim();
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

        String normalizedHint = normalizeHint(languageHint);
        byte[] body = buildMultipartBody(boundary, audioBytes, safeName, contentType, normalizedHint);
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
                LOG.warn("openai_speech_transcribe_http status={} model={}", response.statusCode(), model);
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
            if (language.isBlank()) {
                language = "mixed".equals(normalizedHint) ? "mixed" : normalizedHint;
            }
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
        } catch (AiProviderException ex) {
            throw ex;
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
            String normalizedHint
    ) {
        StringBuilder preamble = new StringBuilder();
        appendField(preamble, boundary, "model", model);

        // gpt-4o-transcribe supports json|text only; whisper-1 supports verbose_json (language field).
        String responseFormat = isGpt4oTranscribeModel(model) ? "json" : "verbose_json";
        appendField(preamble, boundary, "response_format", responseFormat);

        // Lower temperature -> fewer random substitutions / dropped phrases.
        appendField(preamble, boundary, "temperature", "0");

        String langCode = languageCodeForApi(normalizedHint);
        if (!langCode.isBlank()) {
            appendField(preamble, boundary, "language", langCode);
        }

        appendField(preamble, boundary, "prompt", promptForHint(normalizedHint).trim());

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

    private static void appendField(StringBuilder sb, String boundary, String name, String value) {
        sb.append("--").append(boundary).append("\r\n");
        sb.append("Content-Disposition: form-data; name=\"").append(name).append("\"\r\n\r\n");
        sb.append(value).append("\r\n");
    }

    static String normalizeHint(String languageHint) {
        String hint = Objects.toString(languageHint, "").trim().toLowerCase(Locale.ROOT);
        return switch (hint) {
            case "hi", "hindi", "hin" -> "hi";
            case "kn", "kannada", "kan" -> "kn";
            case "en", "english", "eng" -> "en";
            case "mixed", "auto", "multi", "" -> "mixed";
            default -> hint.length() == 2 ? hint : "mixed";
        };
    }

    /** ISO language for OpenAI; blank = auto-detect (used for mixed). */
    static String languageCodeForApi(String normalizedHint) {
        return switch (normalizedHint) {
            case "hi", "kn", "en" -> normalizedHint;
            default -> "";
        };
    }

    static String promptForHint(String normalizedHint) {
        return switch (normalizedHint) {
            case "hi" -> PROMPT_HI;
            case "kn" -> PROMPT_KN;
            case "en" -> PROMPT_EN;
            default -> PROMPT_MIXED;
        };
    }

    private static boolean isGpt4oTranscribeModel(String modelName) {
        String m = Objects.toString(modelName, "").toLowerCase(Locale.ROOT);
        return m.startsWith("gpt-4o-transcribe") || m.startsWith("gpt-4o-mini-transcribe");
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
