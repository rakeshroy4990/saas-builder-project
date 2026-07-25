package com.flexshell.controller;

import com.flexshell.ai.AiProviderException;
import com.flexshell.audio.LocalConsultationAudioStorage;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.audio.AudioConversationResponse;
import com.flexshell.controller.dto.audio.AudioSaveRequest;
import com.flexshell.controller.dto.audio.AudioSessionRequest;
import com.flexshell.controller.dto.audio.AudioStartRequest;
import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.service.AiConversationService;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Objects;

@RestController
@RequestMapping("/api/audio")
@PreAuthorize("hasRole('DOCTOR')")
public class AiConversationController {

    private final AiConversationService aiConversationService;
    private final LocalizedApiMessages messages;
    private final LocalConsultationAudioStorage localStorage;

    public AiConversationController(
            AiConversationService aiConversationService,
            LocalizedApiMessages messages,
            LocalConsultationAudioStorage localStorage
    ) {
        this.aiConversationService = aiConversationService;
        this.messages = messages;
        this.localStorage = localStorage;
    }

    @PostMapping(value = "/start", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> start(
            @RequestBody AudioStartRequest request,
            Authentication authentication
    ) {
        return handle(() -> aiConversationService.start(actorId(authentication), request), "success.audio.started");
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> upload(
            @RequestParam("SessionId") String sessionId,
            @RequestParam(value = "DurationSeconds", required = false) Integer durationSeconds,
            @RequestParam(value = "ChunkIndex", required = false) Integer chunkIndex,
            @RequestPart("file") MultipartFile file,
            Authentication authentication
    ) {
        return handle(
                () -> aiConversationService.upload(
                        actorId(authentication),
                        sessionId,
                        durationSeconds,
                        chunkIndex,
                        file
                ),
                "success.audio.uploaded"
        );
    }

    @PostMapping(value = "/transcribe", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> transcribe(
            @RequestBody AudioSessionRequest request,
            Authentication authentication
    ) {
        boolean swap = request != null && Boolean.TRUE.equals(request.swapSpeakers());
        String sessionId = request == null ? null : request.sessionId();
        return handle(
                () -> aiConversationService.transcribe(actorId(authentication), sessionId, swap),
                "success.audio.transcribed"
        );
    }

    @PostMapping(value = "/analyze", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> analyze(
            @RequestBody AudioSessionRequest request,
            Authentication authentication
    ) {
        String sessionId = request == null ? null : request.sessionId();
        return handle(
                () -> aiConversationService.analyze(actorId(authentication), sessionId),
                "success.audio.analyzed"
        );
    }

    @PostMapping(value = "/generate-summary", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> generateSummary(
            @RequestBody AudioSessionRequest request,
            Authentication authentication
    ) {
        String sessionId = request == null ? null : request.sessionId();
        return handle(
                () -> aiConversationService.generateSummary(actorId(authentication), sessionId),
                "success.audio.summary"
        );
    }

    @PostMapping(value = "/save", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> save(
            @RequestBody AudioSaveRequest request,
            Authentication authentication
    ) {
        return handle(() -> aiConversationService.save(actorId(authentication), request), "success.audio.saved");
    }

    @GetMapping(value = "/{appointmentId}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<AudioConversationResponse>> getByAppointment(
            @PathVariable("appointmentId") String appointmentId,
            Authentication authentication
    ) {
        return handle(
                () -> aiConversationService.getByAppointment(actorId(authentication), appointmentId),
                "success.audio.fetched"
        );
    }

    @GetMapping(value = "/storage-file")
    public ResponseEntity<Resource> storageFile(
            @RequestParam("path") String path,
            Authentication authentication
    ) {
        if (!isDoctor(authentication)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        try {
            Path file = localStorage.resolveLocalPath(path);
            if (!Files.isRegularFile(file)) {
                return ResponseEntity.notFound().build();
            }
            // Ownership is enforced at session APIs; storage path embeds doctor id.
            String doctorId = actorId(authentication);
            String normalized = LocalConsultationAudioStorage.normalizeKey(path);
            if (!normalized.startsWith("consultation-audio/" + doctorId + "/")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
            }
            Resource resource = new FileSystemResource(file);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"consultation-audio\"")
                    .contentType(MediaType.parseMediaType(guessMime(normalized)))
                    .body(resource);
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        } catch (Exception ex) {
            return ResponseEntity.notFound().build();
        }
    }

    private ResponseEntity<StandardApiResponse<AudioConversationResponse>> handle(
            ThrowingSupplier<AudioConversationResponse> supplier,
            String successKey
    ) {
        try {
            AudioConversationResponse data = supplier.get();
            return ResponseEntity.ok(StandardApiResponse.success(messages.success(successKey), data));
        } catch (IllegalArgumentException ex) {
            String code = Objects.toString(ex.getMessage(), "AUDIO_INVALID");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(messages.forErrorCode(code), code));
        } catch (SecurityException ex) {
            String code = Objects.toString(ex.getMessage(), "AUDIO_FORBIDDEN");
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(messages.forErrorCode(code), code));
        } catch (AiProviderException ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body(StandardApiResponse.error(
                            messages.forErrorCode("AUDIO_PROVIDER_FAILED"),
                            "AUDIO_PROVIDER_FAILED"
                    ));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(StandardApiResponse.error(
                            messages.forErrorCode("AUDIO_INTERNAL_ERROR"),
                            "AUDIO_INTERNAL_ERROR"
                    ));
        }
    }

    private static String actorId(Authentication authentication) {
        return authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
    }

    private static boolean isDoctor(Authentication authentication) {
        if (authentication == null) {
            return false;
        }
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            if (authority != null && Objects.toString(authority.getAuthority(), "").toUpperCase(Locale.ROOT).contains("DOCTOR")) {
                return true;
            }
        }
        return false;
    }

    private static String guessMime(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        return "audio/webm";
    }

    @FunctionalInterface
    private interface ThrowingSupplier<T> {
        T get() throws Exception;
    }
}
