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
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

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

    /** Resolved channel id (UC…), long-lived in-process cache. */
    private volatile String cachedChannelId;

    private final ConcurrentHashMap<String, SearchCacheEntry> searchCache = new ConcurrentHashMap<>();

    private record SearchCacheEntry(YoutubeHeroVideoResponse value, long expiresAtMs) {
    }

    public YoutubeHeroService(ObjectMapper objectMapper, YoutubeQueryCacheService youtubeQueryCacheService) {
        this.objectMapper = objectMapper;
        this.youtubeQueryCacheService = youtubeQueryCacheService;
    }

    /**
     * @param rawQuery search text from client (trimmed / bounded)
     * @param userId   optional logged-in user id; when set, cache keys and Mongo shared {@code query_cache} are scoped to this user
     * @return video id + title, or null ids when disabled, empty query, or no match
     */
    public YoutubeHeroVideoResponse resolveHeroVideo(String rawQuery, String userId) {
        if (apiKey == null || apiKey.isBlank()) {
            return emptyResponse();
        }
        String q = normalizeQuery(rawQuery);
        if (q.isEmpty()) {
            return emptyResponse();
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
