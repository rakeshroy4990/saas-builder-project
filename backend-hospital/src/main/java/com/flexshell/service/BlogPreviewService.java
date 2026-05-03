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

    /** Drop one-line marketing blurbs; list and slug views only show substantive mini-articles. */
    private static final int MIN_ARTICLE_CHARS = 520;

    private static final int MIN_ARTICLE_WORDS = 90;

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
        int genCount = 12;
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
        int askCount = Math.min(12, Math.max(count, 10));
        String userPrompt = "Generate exactly "
                + askCount
                + " distinct blog preview objects in the JSON array format described in your system message.";
        String raw = openAiChatAdapter.completeBlogPreviews(userPrompt);
        List<BlogPreviewDto> parsed = parseJsonArray(raw);
        List<BlogPreviewDto> good = filterSubstantialPreviews(parsed);
        if (!good.isEmpty()) {
            LOG.info("blogPreviews generated count={} afterSubstantialFilter={}", parsed.size(), good.size());
            return new GenerationResult(good, SOURCE_LLM);
        }
        LOG.warn("blogPreviews LLM empty, parse failed, or no item passed length filter; trying static fallback");
        List<BlogPreviewDto> staticGood = filterSubstantialPreviews(staticFallback());
        if (!staticGood.isEmpty()) {
            return new GenerationResult(staticGood, SOURCE_STATIC);
        }
        return new GenerationResult(staticFallback(), SOURCE_STATIC);
    }

    private static List<BlogPreviewDto> filterSubstantialPreviews(List<BlogPreviewDto> items) {
        if (items == null || items.isEmpty()) {
            return List.of();
        }
        List<BlogPreviewDto> out = new ArrayList<>();
        for (BlogPreviewDto d : items) {
            if (d != null && isSubstantialPreview(d)) {
                out.add(d);
            }
        }
        return out;
    }

    private static boolean isSubstantialPreview(BlogPreviewDto d) {
        String t = d.getTeaser() == null ? "" : d.getTeaser().trim();
        if (t.length() < MIN_ARTICLE_CHARS) {
            return false;
        }
        return wordCount(t) >= MIN_ARTICLE_WORDS;
    }

    private static int wordCount(String text) {
        int n = 0;
        for (String w : text.trim().split("\\s+")) {
            if (!w.isBlank()) {
                n++;
            }
        }
        return n;
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
                String body = textOrEmpty(n, "body", "Body");
                String article = textOrEmpty(n, "article", "Article");
                if (article.length() > teaser.length()) {
                    teaser = article;
                }
                if (body.length() > teaser.length()) {
                    teaser = body;
                }
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
                String hookRaw = textOrEmpty(n, "hook", "Hook");
                List<String> cqRaw = readCuriosityQuestions(n);
                String hook = ensureHook(hookRaw, teaser);
                List<String> curiosity = ensureCuriosityQuestions(cqRaw, title);
                out.add(new BlogPreviewDto(
                        title.trim(),
                        slug.trim(),
                        teaser.trim(),
                        category.trim(),
                        read,
                        hook,
                        curiosity
                ));
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

    private static List<String> readCuriosityQuestions(JsonNode n) {
        JsonNode arr = n.path("curiosityQuestions");
        if (!arr.isArray()) {
            arr = n.path("CuriosityQuestions");
        }
        if (!arr.isArray()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (JsonNode q : arr) {
            if (q == null || !q.isTextual()) {
                continue;
            }
            String s = q.asText("").trim();
            if (!s.isBlank()) {
                out.add(clampQuestion(s));
            }
            if (out.size() >= 3) {
                break;
            }
        }
        return out;
    }

    private static String clampQuestion(String s) {
        if (s.length() <= 140) {
            return s;
        }
        return s.substring(0, 137) + "...";
    }

    private static String ensureHook(String hookRaw, String teaser) {
        String h = hookRaw == null ? "" : hookRaw.trim();
        if (h.length() > 200) {
            h = h.substring(0, 197) + "...";
        }
        if (!h.isBlank()) {
            return h;
        }
        return deriveHookFromTeaser(teaser);
    }

    private static String deriveHookFromTeaser(String teaser) {
        String t = teaser == null ? "" : teaser.trim();
        if (t.isBlank()) {
            return "";
        }
        int end = -1;
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            if (c == '.' || c == '!' || c == '?') {
                end = i;
                break;
            }
        }
        if (end >= 10 && end <= 200) {
            return t.substring(0, end + 1).trim();
        }
        if (t.length() <= 160) {
            return t;
        }
        return t.substring(0, 157) + "...";
    }

    private static List<String> ensureCuriosityQuestions(List<String> parsed, String title) {
        List<String> out = new ArrayList<>();
        if (parsed != null) {
            for (String s : parsed) {
                if (s == null) {
                    continue;
                }
                String q = s.trim();
                if (!q.isBlank()) {
                    out.add(clampQuestion(q));
                }
                if (out.size() >= 2) {
                    return List.copyOf(out);
                }
            }
        }
        while (out.size() < 2) {
            out.add(defaultCuriosityQuestion(title, out.size()));
        }
        return List.copyOf(out);
    }

    private static String defaultCuriosityQuestion(String title, int index) {
        String t = title == null ? "" : title.trim();
        if (index == 0) {
            return t.isBlank() ? "What everyday habits does this connect to?" : "What should curious readers notice first about: " + t + "?";
        }
        return "What questions could you bring to a routine visit after reading this?";
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
                        String.join(
                                "\n\n",
                                "When you stand, blood briefly pools in the legs and your body tightens vessels and "
                                        + "nudges the heart to keep blood pressure steady. For many healthy adults that feels "
                                        + "like a harmless flutter or a momentary lightheadedness that passes in seconds.",
                                "Notice what makes symptoms predictable: standing quickly from bed, hot showers, or "
                                        + "skipping breakfast can make normal shifts feel louder. Tracking timing, hydration, "
                                        + "and recent illness helps you describe patterns accurately if you ever speak with a clinician.",
                                "This article is general education only. If standing reliably causes fainting, chest pain, "
                                        + "pounding irregular heartbeats, or trouble breathing, seek urgent care. Otherwise, use "
                                        + "these ideas to prepare better questions for your next routine visit—not to self-diagnose."
                        ),
                        "Heart Health",
                        9,
                        "Standing up nudges your circulation in seconds—have you ever felt that quick catch-up?",
                        List.of(
                                "Which everyday situations make that feeling more noticeable?",
                                "What details help a clinician understand your pattern?"
                        )
                ),
                new BlogPreviewDto(
                        "Sleep and sugar cravings: what is the link?",
                        "sleep-sugar-cravings",
                        String.join(
                                "\n\n",
                                "Short sleep changes appetite hormones and makes ultra-processed snacks feel more rewarding "
                                        + "the next day. That is biology, not a lack of willpower, and it helps explain why rigid "
                                        + "rules alone rarely fix nighttime grazing.",
                                "Practical habits to experiment with: a consistent wind-down, dim screens earlier, a small "
                                        + "protein-forward breakfast, and keeping tempting sweets out of easy reach after dinner. "
                                        + "Small experiments beat sweeping rules because you learn what your own week can sustain.",
                                "Educational content only; not individualized nutrition or mental-health treatment. If "
                                        + "cravings come with bingeing, purging, or major mood changes, bring those details to a "
                                        + "qualified professional who knows your history."
                        ),
                        "Sleep",
                        10,
                        "Could one short night really change what you reach for the next day?",
                        List.of(
                                "What small evening habits change the morning craving loop?",
                                "How might you test one change for a week without an all-or-nothing plan?"
                        )
                ),
                new BlogPreviewDto(
                        "Hydration myths that quietly stick around",
                        "hydration-myths",
                        String.join(
                                "\n\n",
                                "Clear urine is not always better, and eight rigid glasses are not magic for every body. "
                                        + "Thirst, climate, activity, pregnancy, and some medications all shift what enough fluid "
                                        + "means day to day.",
                                "Useful basics: sip with meals, carry water on warm walks, and learn early signs of heat "
                                        + "illness in your region. If you have kidney or heart conditions, follow the plan your "
                                        + "clinician already gave you because public articles cannot override personal limits.",
                                "These paragraphs summarize common teaching points for curious readers. They are not "
                                        + "medical advice. Ask your care team before big fluid changes if you have edema, dialysis, "
                                        + "or other conditions where volume matters."
                        ),
                        "Nutrition",
                        8,
                        "Is crystal-clear urine always the goal—and does everyone need the same glass count?",
                        List.of(
                                "Which signals besides thirst hint you are ahead or behind on fluids?",
                                "When does a simple hydration habit stop being one-size-fits-all?"
                        )
                ),
                new BlogPreviewDto(
                        "When is a headache ‘just stress’ — and when is it worth a call?",
                        "headache-red-flags-basics",
                        String.join(
                                "\n\n",
                                "Tension-type headaches often feel like a band around the head and track with stress, "
                                        + "dehydration, or screen time. Many people improve with rest, hydration, posture breaks, "
                                        + "and gentle neck mobility, and it is still worth mentioning at routine visits if they persist.",
                                "Patterns that deserve prompt medical attention include thunderclap worst headache of life, "
                                        + "new weakness or numbness, fever with stiff neck, confusion, head injury, or a brand-new "
                                        + "headache after age fifty. Those scenarios are not for internet triage.",
                                "This page explains common educational distinctions only. It does not tell you whether "
                                        + "your headache is serious today. Use emergency services when red-flag symptoms appear, "
                                        + "and otherwise discuss frequency and triggers with your clinician."
                        ),
                        "Wellness",
                        11,
                        "Stress headaches are common—but which patterns deserve a same-day conversation?",
                        List.of(
                                "What separates a nagging tension headache from a thunderclap emergency?",
                                "Which timeline changes (new after 50, new weakness) are worth writing down before a visit?"
                        )
                )
        );
    }

    private record CacheEntry(Instant expiresAt, List<BlogPreviewDto> items, String contentSource) {
    }
}
