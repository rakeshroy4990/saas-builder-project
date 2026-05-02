package com.flexshell.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.ai.OpenAiChatAdapter;
import com.flexshell.controller.dto.BlogPreviewDto;
import com.flexshell.controller.dto.BlogPreviewsPayloadDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;

@Service
public class BlogPreviewService {
    private static final Logger LOG = LoggerFactory.getLogger(BlogPreviewService.class);

    private final OpenAiChatAdapter openAiChatAdapter;
    private final ObjectMapper objectMapper;
    private final long cacheTtlSeconds;

    private volatile CacheEntry cache;

    private static final String SOURCE_LLM = "llm";
    private static final String SOURCE_STATIC = "static_fallback";

    public BlogPreviewService(
            OpenAiChatAdapter openAiChatAdapter,
            ObjectMapper objectMapper,
            @Value("${app.ai.blog.cache-ttl-hours:12}") double cacheTtlHours
    ) {
        this.openAiChatAdapter = openAiChatAdapter;
        this.objectMapper = objectMapper;
        this.cacheTtlSeconds = Math.max(600L, (long) (cacheTtlHours * 3600.0));
    }

    public BlogPreviewsPayloadDto getPreviews(int requestedLimit) {
        int limit = Math.min(12, Math.max(1, requestedLimit));
        CacheResolution res = resolveCache(requestedLimit);
        List<BlogPreviewDto> items = slice(res.entry().items(), limit);
        return buildPayload(items, res.entry().contentSource(), res.servedFromCache());
    }

    /**
     * Resolves a teaser by slug against the same in-memory list as the list endpoint (after cache warm).
     */
    public Optional<BlogPreviewDto> findPreviewBySlug(String rawSlug) {
        String want = normalizeSlug(rawSlug);
        if (want.isBlank()) {
            return Optional.empty();
        }
        CacheResolution res = resolveCache(12);
        for (BlogPreviewDto dto : res.entry().items()) {
            if (normalizeSlug(dto.getSlug()).equals(want)) {
                return Optional.of(dto);
            }
        }
        return Optional.empty();
    }

    private record CacheResolution(CacheEntry entry, boolean servedFromCache) {
    }

    /**
     * Fills or reuses the preview cache; {@code servedFromCache} is false only when this thread generated a new batch.
     */
    private CacheResolution resolveCache(int requestedLimit) {
        int limit = Math.min(12, Math.max(1, requestedLimit));
        int genCount = Math.min(12, Math.max(limit, 8));
        CacheEntry snap = cache;
        if (snap != null && snap.expiresAt.isAfter(Instant.now()) && !snap.items.isEmpty()) {
            return new CacheResolution(snap, true);
        }
        synchronized (this) {
            snap = cache;
            if (snap != null && snap.expiresAt.isAfter(Instant.now()) && !snap.items.isEmpty()) {
                return new CacheResolution(snap, true);
            }
            GenerationResult generated = generateFromLlmOrFallback(genCount);
            cache = new CacheEntry(
                    Instant.now().plusSeconds(cacheTtlSeconds),
                    List.copyOf(generated.items()),
                    generated.contentSource()
            );
            return new CacheResolution(cache, false);
        }
    }

    private static String normalizeSlug(String raw) {
        return raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
    }

    private BlogPreviewsPayloadDto buildPayload(List<BlogPreviewDto> items, String contentSource, boolean servedFromCache) {
        String detail = buildContentSourceDetail(contentSource, servedFromCache);
        return new BlogPreviewsPayloadDto(items, contentSource, servedFromCache, detail);
    }

    private static String buildContentSourceDetail(String contentSource, boolean servedFromCache) {
        boolean llm = SOURCE_LLM.equals(contentSource);
        String base = llm
                ? "Teasers produced by an AI model for general education; not personalized medical advice."
                : "Showing curated static teasers (used when AI output was empty or could not be parsed).";
        String suffix = servedFromCache
                ? " Reusing a recent server result so the page loads faster—this is normal."
                : " Just generated on the server for this request.";
        return base + suffix;
    }

    private List<BlogPreviewDto> slice(List<BlogPreviewDto> items, int limit) {
        if (items.size() <= limit) {
            return items;
        }
        return new ArrayList<>(items.subList(0, limit));
    }

    private record GenerationResult(List<BlogPreviewDto> items, String contentSource) {
    }

    private GenerationResult generateFromLlmOrFallback(int count) {
        String userPrompt = "Generate exactly "
                + count
                + " distinct blog preview objects in the JSON array format described in your system message.";
        String raw = openAiChatAdapter.completeBlogPreviews(userPrompt);
        List<BlogPreviewDto> parsed = parseJsonArray(raw);
        if (!parsed.isEmpty()) {
            LOG.info("blogPreviews generated count={}", parsed.size());
            return new GenerationResult(parsed, SOURCE_LLM);
        }
        LOG.warn("blogPreviews LLM empty or parse failed; using static fallback");
        return new GenerationResult(staticFallback(), SOURCE_STATIC);
    }

    List<BlogPreviewDto> parseJsonArray(String raw) {
        String text = stripCodeFence(Objects.toString(raw, "").trim());
        if (text.isBlank()) {
            return List.of();
        }
        try {
            JsonNode root = objectMapper.readTree(text);
            if (!root.isArray()) {
                return List.of();
            }
            List<BlogPreviewDto> out = new ArrayList<>();
            for (JsonNode n : root) {
                if (n == null || !n.isObject()) continue;
                String title = textOrEmpty(n, "title", "Title");
                String slug = textOrEmpty(n, "slug", "Slug");
                String teaser = textOrEmpty(n, "teaser", "Teaser");
                String category = textOrEmpty(n, "category", "Category");
                int read = n.path("readTimeMinutes").asInt(0);
                if (read <= 0) {
                    read = n.path("ReadTimeMinutes").asInt(5);
                }
                if (read <= 0) read = 5;
                if (read > 30) read = 30;
                if (title.isBlank() || teaser.isBlank()) continue;
                if (slug.isBlank()) {
                    slug = slugify(title);
                }
                out.add(new BlogPreviewDto(title.trim(), slug.trim(), teaser.trim(), category.trim(), read));
            }
            return out;
        } catch (Exception ex) {
            LOG.debug("blogPreviews parse error: {}", ex.getMessage());
            return List.of();
        }
    }

    private static String textOrEmpty(JsonNode n, String camel, String pascal) {
        String a = n.path(camel).asText("").trim();
        if (!a.isBlank()) return a;
        return n.path(pascal).asText("").trim();
    }

    private static String stripCodeFence(String s) {
        String t = s.trim();
        if (t.startsWith("```")) {
            int firstNl = t.indexOf('\n');
            if (firstNl > 0) {
                t = t.substring(firstNl + 1);
            }
            int end = t.lastIndexOf("```");
            if (end > 0) {
                t = t.substring(0, end);
            }
        }
        return t.trim();
    }

    private static String slugify(String title) {
        String base = title.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-");
        base = base.replaceAll("^-+|+-+$", "");
        if (base.isBlank()) {
            return "article";
        }
        return base;
    }

    private static List<BlogPreviewDto> staticFallback() {
        return List.of(
                new BlogPreviewDto(
                        "Why does your heart rate change when you stand up?",
                        "heart-rate-standing",
                        "A quick look at circulation and what is normal — and when to ask your clinician.",
                        "Heart Health",
                        4
                ),
                new BlogPreviewDto(
                        "Sleep and sugar cravings: what is the link?",
                        "sleep-sugar-cravings",
                        "Explore how rest affects appetite signals — without fad-diet promises.",
                        "Sleep",
                        5
                ),
                new BlogPreviewDto(
                        "Hydration myths that quietly stick around",
                        "hydration-myths",
                        "Separating common beliefs from practical hydration habits for everyday life.",
                        "Nutrition",
                        3
                ),
                new BlogPreviewDto(
                        "When is a headache ‘just stress’ — and when is it worth a call?",
                        "headache-red-flags-basics",
                        "A calm, educational framing of patterns worth discussing with a professional.",
                        "Wellness",
                        6
                )
        );
    }

    private record CacheEntry(Instant expiresAt, List<BlogPreviewDto> items, String contentSource) {
    }
}
