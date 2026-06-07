package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.controller.dto.YoutubeHeroVideoResponse;
import com.flexshell.service.YoutubeHeroService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/youtube")
public class YoutubeHeroController {
    private final LocalizedApiMessages messages;

    private final YoutubeHeroService youtubeHeroService;

    public YoutubeHeroController(YoutubeHeroService youtubeHeroService,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.youtubeHeroService = youtubeHeroService;
    }

    /** Public endpoint: returns a random curated hero video from backend constants. */
    @GetMapping(value = "/hero-video", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<YoutubeHeroVideoResponse>> heroVideo(
            @RequestParam(value = "q", required = false, defaultValue = "") String q,
            @RequestParam(value = "user_id", required = false, defaultValue = "") String userId
    ) {
        String uid = userId == null ? "" : userId.trim();
        YoutubeHeroVideoResponse data = youtubeHeroService.resolveHeroVideo(q, uid.isEmpty() ? null : uid);
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.youtube.hero.ok"), data));
    }
}
