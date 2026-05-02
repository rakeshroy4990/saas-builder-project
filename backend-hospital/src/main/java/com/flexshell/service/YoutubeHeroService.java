package com.flexshell.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.flexshell.controller.dto.YoutubeHeroVideoResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Resolves a video id within a YouTube channel using Data API v3 search.
 * API key stays server-side only.
 * <p>
 * When {@code userId} is provided, results are persisted to shared {@code rag_db.query_cache}
 * and the in-memory search cache is scoped per user.
 */
@Service
public class YoutubeHeroService {
    private static final Logger log = LoggerFactory.getLogger(YoutubeHeroService.class);
    private static final String YT_BASE = "https://www.googleapis.com/youtube/v3";

    private final ObjectMapper objectMapper;
    private final YoutubeQueryCacheService youtubeQueryCacheService;
    private final RestClient restClient = RestClient.builder().build();

    @Value("${app.youtube.api-key:}")
    private String apiKey;

    @Value("${app.youtube.channel-handle:LittleSproutsCare_DrSwati}")
    private String channelHandle;

    @Value("${app.youtube.search-cache-ttl-ms:300000}")
    private long searchCacheTtlMs;

    /** Newest N uploads considered when empty {@code q}; max 50 (YouTube search.list limit). */
    @Value("${app.youtube.hero-recent-pool-size:30}")
    private int heroRecentPoolSize;

    /**
     * How to pick the hero video when {@code q} is empty. See {@code app.youtube.hero-rank-by} in
     * {@code application.properties} for allowed values (default {@code RANDOM}).
     */
    @Value("${app.youtube.hero-rank-by:RANDOM}")
    private String heroRankBy;

    /** Resolved channel id (UC…), long-lived in-process cache. */
    private volatile String cachedChannelId;

    private final ConcurrentHashMap<String, SearchCacheEntry> searchCache = new ConcurrentHashMap<>();

    /** In-memory cache key for default hero video (empty {@code q} on hero-video API). */
    private static final String CHANNEL_HERO_DEFAULT_CACHE_KEY = "__channel_hero_default__";

    private record SearchCacheEntry(YoutubeHeroVideoResponse value, long expiresAtMs) {
    }

    public YoutubeHeroService(ObjectMapper objectMapper, YoutubeQueryCacheService youtubeQueryCacheService) {
        this.objectMapper = objectMapper;
        this.youtubeQueryCacheService = youtubeQueryCacheService;
    }

    /**
     * @param rawQuery search text from client (trimmed / bounded). When empty, returns one of the channel’s
     *                 newest uploads chosen by {@link #heroRankBy} (random slot 1–30, or best by views/likes).
     * @param userId   optional logged-in user id; when set, cache keys and Mongo shared {@code query_cache} are scoped to this user
     * @return video id + title, or null ids when disabled or no match
     */
    public YoutubeHeroVideoResponse resolveHeroVideo(String rawQuery, String userId) {
        if (apiKey == null || apiKey.isBlank()) {
            return emptyResponse();
        }
        String q = normalizeQuery(rawQuery);
        if (q.isEmpty()) {
            return resolveChannelLatestCached();
        }

        String uid = userId == null ? "" : userId.trim();
        String memoryKey = uid.isEmpty() ? q : uid + "::" + q;

        long now = System.currentTimeMillis();

        if (!uid.isEmpty()) {
            Optional<YoutubeHeroVideoResponse> fromDb =
                    youtubeQueryCacheService.findFreshCachedVideo(uid, q, searchCacheTtlMs);
            if (fromDb.isPresent()) {
                YoutubeHeroVideoResponse v = fromDb.get();
                searchCache.put(memoryKey, new SearchCacheEntry(v, now + searchCacheTtlMs));
                return v;
            }
        }

        SearchCacheEntry hit = searchCache.get(memoryKey);
        if (hit != null && hit.expiresAtMs() > now) {
            return hit.value();
        }

        String channelId = resolveChannelId();
        if (channelId == null || channelId.isBlank()) {
            return emptyResponse();
        }

        YoutubeHeroVideoResponse found = searchChannelVideos(channelId, q);
        if (!hasVideoId(found)) {
            found = searchLatestChannelVideo(channelId);
            if (hasVideoId(found)) {
                log.info("YouTube hero: keyword search had no match; using latest channel video");
            }
        }
        searchCache.put(memoryKey, new SearchCacheEntry(found, now + searchCacheTtlMs));

        if (!uid.isEmpty() && hasVideoId(found)) {
            youtubeQueryCacheService.saveUserQueryResult(uid, q, found);
        }

        return found;
    }

    /**
     * Picks a recent channel video (random among first up to 30, or best by views/likes), with a shared
     * in-process cache (no {@code query_cache} persistence).
     */
    private YoutubeHeroVideoResponse resolveChannelLatestCached() {
        long now = System.currentTimeMillis();
        SearchCacheEntry hit = searchCache.get(CHANNEL_HERO_DEFAULT_CACHE_KEY);
        if (hit != null && hit.expiresAtMs() > now) {
            return hit.value();
        }
        String channelId = resolveChannelId();
        if (channelId == null || channelId.isBlank()) {
            return emptyResponse();
        }
        YoutubeHeroVideoResponse found = searchBestRecentByEngagement(channelId);
        if (!hasVideoId(found)) {
            found = searchLatestChannelVideo(channelId);
        }
        searchCache.put(CHANNEL_HERO_DEFAULT_CACHE_KEY, new SearchCacheEntry(found, now + searchCacheTtlMs));
        return found;
    }

    /**
     * Lists recent uploads (newest first). Then either picks a random index in {@code [0, min(30, n))}
     * when {@link #heroRankBy} is {@code RANDOM}, or the top by views/likes. On failure, returns empty;
     * caller may fall back to {@link #searchLatestChannelVideo}.
     */
    private YoutubeHeroVideoResponse searchBestRecentByEngagement(String channelId) {
        int pool = heroRecentPoolSize;
        if (pool < 1) {
            pool = 1;
        }
        if (pool > 50) {
            pool = 50;
        }
        List<String> ids = listRecentChannelVideoIds(channelId, pool);
        if (ids.isEmpty()) {
            return emptyResponse();
        }

        String mode = String.valueOf(heroRankBy).trim();
        if (mode.isEmpty()) {
            mode = "RANDOM";
        }

        if ("RANDOM".equalsIgnoreCase(mode)) {
            return pickRandomRecentHero(ids);
        }
        if (!"VIEWS".equalsIgnoreCase(mode) && !"LIKES".equalsIgnoreCase(mode)) {
            log.warn("Unknown app.youtube.hero-rank-by '{}'; using RANDOM", mode);
            return pickRandomRecentHero(ids);
        }

        boolean rankByLikes = "LIKES".equalsIgnoreCase(mode);
        Map<String, YoutubeHeroVideoResponse> statsById = fetchVideoStatisticsByIds(ids);
        if (statsById.isEmpty()) {
            return emptyResponse();
        }
        YoutubeHeroVideoResponse best = null;
        long bestScore = -1L;
        int bestPos = Integer.MAX_VALUE;
        for (int i = 0; i < ids.size(); i++) {
            String id = ids.get(i);
            YoutubeHeroVideoResponse r = statsById.get(id);
            if (!hasVideoId(r)) {
                continue;
            }
            long score = rankByLikes ? r.getLikeCount() : r.getViewCount();
            if (score > bestScore || (score == bestScore && i < bestPos)) {
                bestScore = score;
                bestPos = i;
                best = r;
            }
        }
        return best != null ? best : emptyResponse();
    }

    /**
     * Uniform random choice among the first {@code min(30, ids.size())} slots (newest-first list).
     * Loads statistics for the chosen id only.
     */
    private YoutubeHeroVideoResponse pickRandomRecentHero(List<String> ids) {
        int window = Math.min(30, ids.size());
        if (window <= 0) {
            return emptyResponse();
        }
        int idx = ThreadLocalRandom.current().nextInt(window);
        String pick = ids.get(idx);
        Map<String, YoutubeHeroVideoResponse> one = new LinkedHashMap<>();
        mergeVideosListChunk(List.of(pick), one);
        YoutubeHeroVideoResponse r = one.get(pick);
        return hasVideoId(r) ? r : emptyResponse();
    }

    /** Batches {@code videos.list} (max 50 ids per request). */
    private Map<String, YoutubeHeroVideoResponse> fetchVideoStatisticsByIds(List<String> ids) {
        Map<String, YoutubeHeroVideoResponse> out = new LinkedHashMap<>();
        for (int start = 0; start < ids.size(); start += 50) {
            int end = Math.min(start + 50, ids.size());
            List<String> chunk = ids.subList(start, end);
            mergeVideosListChunk(chunk, out);
        }
        return out;
    }

    private void mergeVideosListChunk(List<String> ids, Map<String, YoutubeHeroVideoResponse> sink) {
        if (ids == null || ids.isEmpty()) {
            return;
        }
        String joined = String.join(",", ids);
        URI uri = UriComponentsBuilder.fromUriString(YT_BASE + "/videos")
                .queryParam("part", "snippet,statistics")
                .queryParam("id", joined)
                .queryParam("key", apiKey)
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUri();
        try {
            String body = restClient.get().uri(uri).retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(body);
            JsonNode items = root.path("items");
            if (!items.isArray()) {
                return;
            }
            for (JsonNode item : items) {
                String videoId = item.path("id").asText(null);
                if (videoId == null || videoId.isBlank()) {
                    continue;
                }
                JsonNode stats = item.path("statistics");
                long views = parseStatLong(stats, "viewCount");
                long likes = parseStatLong(stats, "likeCount");
                String title = item.path("snippet").path("title").asText(null);
                sink.put(videoId, new YoutubeHeroVideoResponse(videoId, title, views, likes));
            }
        } catch (RestClientException | java.io.IOException ex) {
            log.warn("YouTube videos.list (statistics) failed: {}", ex.getMessage());
        }
    }

    private List<String> listRecentChannelVideoIds(String channelId, int maxResults) {
        URI uri = UriComponentsBuilder.fromUriString(YT_BASE + "/search")
                .queryParam("part", "snippet")
                .queryParam("type", "video")
                .queryParam("channelId", channelId)
                .queryParam("order", "date")
                .queryParam("maxResults", maxResults)
                .queryParam("key", apiKey)
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUri();
        try {
            String body = restClient.get().uri(uri).retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(body);
            JsonNode items = root.path("items");
            if (!items.isArray() || items.size() == 0) {
                return List.of();
            }
            List<String> out = new ArrayList<>(items.size());
            for (JsonNode item : items) {
                String videoId = item.path("id").path("videoId").asText(null);
                if (videoId != null && !videoId.isBlank()) {
                    out.add(videoId);
                }
            }
            return out;
        } catch (RestClientException | java.io.IOException ex) {
            log.warn("YouTube search.list (recent pool) failed: {}", ex.getMessage());
            return List.of();
        }
    }

    private static long parseStatLong(JsonNode statistics, String field) {
        if (statistics == null || statistics.isMissingNode() || !statistics.isObject()) {
            return 0L;
        }
        String s = statistics.path(field).asText("0");
        try {
            return Long.parseLong(s.trim());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static boolean hasVideoId(YoutubeHeroVideoResponse r) {
        return r != null && r.getVideoId() != null && !r.getVideoId().isBlank();
    }

    private static YoutubeHeroVideoResponse emptyResponse() {
        return new YoutubeHeroVideoResponse(null, null);
    }

    private static String normalizeQuery(String raw) {
        if (raw == null) {
            return "";
        }
        String t = raw.trim().replaceAll("\\s+", " ");
        if (t.length() > 120) {
            t = t.substring(0, 120);
        }
        return t;
    }

    private String resolveChannelId() {
        if (cachedChannelId != null && !cachedChannelId.isBlank()) {
            return cachedChannelId;
        }
        synchronized (this) {
            if (cachedChannelId != null && !cachedChannelId.isBlank()) {
                return cachedChannelId;
            }
            String handle = channelHandle == null ? "" : channelHandle.trim();
            if (handle.startsWith("@")) {
                handle = handle.substring(1);
            }
            if (handle.isEmpty()) {
                return null;
            }
            URI uri = UriComponentsBuilder.fromUriString(YT_BASE + "/channels")
                    .queryParam("part", "id")
                    .queryParam("forHandle", handle)
                    .queryParam("key", apiKey)
                    .encode(StandardCharsets.UTF_8)
                    .build()
                    .toUri();
            try {
                String body = restClient.get().uri(uri).retrieve().body(String.class);
                JsonNode root = objectMapper.readTree(body);
                JsonNode items = root.path("items");
                if (items.isArray() && items.size() > 0) {
                    String id = items.get(0).path("id").asText(null);
                    if (id != null && !id.isBlank()) {
                        cachedChannelId = id;
                        return id;
                    }
                }
                log.warn("YouTube channels.list returned no channel for handle {}", handle);
            } catch (RestClientException | java.io.IOException ex) {
                log.warn("YouTube channels.list failed: {}", ex.getMessage());
            }
            return null;
        }
    }

    private YoutubeHeroVideoResponse searchChannelVideos(String channelId, String q) {
        URI uri = UriComponentsBuilder.fromUriString(YT_BASE + "/search")
                .queryParam("part", "snippet")
                .queryParam("type", "video")
                .queryParam("channelId", channelId)
                .queryParam("q", q)
                .queryParam("maxResults", 1)
                .queryParam("key", apiKey)
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUri();
        try {
            String body = restClient.get().uri(uri).retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(body);
            JsonNode items = root.path("items");
            if (!items.isArray() || items.size() == 0) {
                return emptyResponse();
            }
            JsonNode first = items.get(0);
            String videoId = first.path("id").path("videoId").asText(null);
            String title = first.path("snippet").path("title").asText(null);
            if (videoId == null || videoId.isBlank()) {
                return emptyResponse();
            }
            return new YoutubeHeroVideoResponse(videoId, title);
        } catch (RestClientException | java.io.IOException ex) {
            log.warn("YouTube search.list failed: {}", ex.getMessage());
            return emptyResponse();
        }
    }

    /** When keyword search returns nothing, newest upload in the channel (same quota unit as search). */
    private YoutubeHeroVideoResponse searchLatestChannelVideo(String channelId) {
        URI uri = UriComponentsBuilder.fromUriString(YT_BASE + "/search")
                .queryParam("part", "snippet")
                .queryParam("type", "video")
                .queryParam("channelId", channelId)
                .queryParam("order", "date")
                .queryParam("maxResults", 1)
                .queryParam("key", apiKey)
                .encode(StandardCharsets.UTF_8)
                .build()
                .toUri();
        try {
            String body = restClient.get().uri(uri).retrieve().body(String.class);
            JsonNode root = objectMapper.readTree(body);
            JsonNode items = root.path("items");
            if (!items.isArray() || items.size() == 0) {
                return emptyResponse();
            }
            JsonNode first = items.get(0);
            String videoId = first.path("id").path("videoId").asText(null);
            String title = first.path("snippet").path("title").asText(null);
            if (videoId == null || videoId.isBlank()) {
                return emptyResponse();
            }
            return new YoutubeHeroVideoResponse(videoId, title);
        } catch (RestClientException | java.io.IOException ex) {
            log.warn("YouTube latest-channel search failed: {}", ex.getMessage());
            return emptyResponse();
        }
    }
}
