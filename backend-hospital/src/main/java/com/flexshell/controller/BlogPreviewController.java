package com.flexshell.controller;

import com.flexshell.controller.dto.BlogPreviewDto;
import com.flexshell.controller.dto.BlogPreviewsPayloadDto;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.service.BlogPreviewService;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/hospital/blog")
public class BlogPreviewController {
    private final BlogPreviewService blogPreviewService;

    public BlogPreviewController(BlogPreviewService blogPreviewService) {
        this.blogPreviewService = blogPreviewService;
    }

    @GetMapping(value = "/previews", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<BlogPreviewsPayloadDto>> previews(
            @RequestParam(name = "limit", defaultValue = "6") int limit
    ) {
        BlogPreviewsPayloadDto data = blogPreviewService.getPreviews(limit);
        return ResponseEntity.ok(StandardApiResponse.success("Blog previews", data));
    }

    @GetMapping(value = "/previews/slug/{slug}", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<StandardApiResponse<BlogPreviewDto>> previewBySlug(@PathVariable String slug) {
        return blogPreviewService
                .findPreviewBySlug(slug)
                .map(dto -> ResponseEntity.ok(StandardApiResponse.success("Blog preview", dto)))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(StandardApiResponse.error("No preview for this slug", "BLOG_NOT_FOUND")));
    }
}
