package com.flexshell.video;

import com.flexshell.controller.dto.HospitalVideoSessionRequest;
import com.flexshell.controller.dto.HospitalVideoSessionResponse;
import com.flexshell.controller.dto.StandardApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Objects;

/**
 * Legacy session mint for peer-only flows. For Agora production, prefer
 * {@code POST /api/appointment/{id}/join-call} so the channel is the appointment id and status/slot are validated.
 */
@RestController
@RequestMapping("/api/hospital/video")
public class HospitalVideoSessionController {
    private final HospitalVideoSessionService hospitalVideoSessionService;

    public HospitalVideoSessionController(HospitalVideoSessionService hospitalVideoSessionService) {
        this.hospitalVideoSessionService = hospitalVideoSessionService;
    }

    @PostMapping(value = "/session", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<HospitalVideoSessionResponse>> createSession(
            @RequestBody HospitalVideoSessionRequest request,
            Authentication authentication
    ) {
        try {
            String userId = authentication == null ? "" : Objects.toString(authentication.getName(), "").trim();
            HospitalVideoSessionResponse data = hospitalVideoSessionService.create(userId, request);
            return ResponseEntity.ok(StandardApiResponse.success("Video session", data));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(StandardApiResponse.error(ex.getMessage(), "HOSPITAL_VIDEO_SESSION_INVALID"));
        } catch (SecurityException ex) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(StandardApiResponse.error(ex.getMessage(), "HOSPITAL_VIDEO_SESSION_FORBIDDEN"));
        } catch (IllegalStateException ex) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(StandardApiResponse.error(ex.getMessage(), "HOSPITAL_VIDEO_SESSION_CONFIG"));
        }
    }
}
