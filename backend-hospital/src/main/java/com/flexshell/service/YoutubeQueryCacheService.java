package com.flexshell.service;

import com.flexshell.controller.dto.YoutubeQueryCacheEntryDto;
import com.flexshell.controller.dto.YoutubeHeroVideoResponse;
import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.model.Filters;
import com.mongodb.client.model.ReplaceOptions;
import com.mongodb.client.model.Sorts;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.bson.Document;
import org.bson.conversions.Bson;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class YoutubeQueryCacheService {
    private static final String COLLECTION = "query_cache";

    private final ObjectProvider<MongoTemplate> mongoTemplateProvider;
    private final ObjectProvider<JdbcTemplate> jdbcTemplateProvider;
    private final String queryCacheDatabase;

    public YoutubeQueryCacheService(
            ObjectProvider<MongoTemplate> mongoTemplateProvider,
            ObjectProvider<JdbcTemplate> jdbcTemplateProvider,
            @Value("${app.youtube.query-cache.database:${APP_YOUTUBE_QUERY_CACHE_DATABASE:rag_db}}") String queryCacheDatabase
    ) {
        this.mongoTemplateProvider = mongoTemplateProvider;
        this.jdbcTemplateProvider = jdbcTemplateProvider;
        this.queryCacheDatabase = queryCacheDatabase == null ? "rag_db" : queryCacheDatabase.trim();
    }

    public List<YoutubeQueryCacheEntryDto> listRecentForUser(String userId, int limit) {
        MongoTemplate template = mongoTemplateProvider.getIfAvailable();
        if (userId == null || userId.isBlank()) {
            return List.of();
        }
        if (template == null) {
            return listRecentForUserPostgres(userId, limit);
        }
        int cap = Math.min(Math.max(limit, 1), 200);
        String uid = userId.trim();
        MongoCollection<Document> collection = queryCacheCollection(template);
        Bson byUser = Filters.or(
                Filters.eq("UserId", uid),
                Filters.eq("user_id", uid),
                Filters.eq("LoggedInUserId", uid),
                Filters.eq("logged_in_user_id", uid));
        FindIterable<Document> docs = collection.find(byUser)
                .sort(Sorts.orderBy(Sorts.descending("UpdatedAt"), Sorts.descending("updated_at")))
                .limit(cap);
        List<YoutubeQueryCacheEntryDto> out = new ArrayList<>(cap);
        for (Document doc : docs) {
            out.add(toDto(doc));
        }
        return out;
    }

    public Optional<YoutubeHeroVideoResponse> findFreshCachedVideo(
            String userId,
            String normalizedQuery,
            long ttlMs
    ) {
        MongoTemplate template = mongoTemplateProvider.getIfAvailable();
        if (userId == null || userId.isBlank() || normalizedQuery.isEmpty()) {
            return Optional.empty();
        }
        if (template == null) {
            return findFreshCachedVideoPostgres(userId, normalizedQuery, ttlMs);
        }
        String uid = userId.trim();
        MongoCollection<Document> collection = queryCacheCollection(template);
        Bson byUser = Filters.or(
                Filters.eq("UserId", uid),
                Filters.eq("user_id", uid),
                Filters.eq("LoggedInUserId", uid),
                Filters.eq("logged_in_user_id", uid));
        Bson byQuery = Filters.or(
                Filters.eq("Query", normalizedQuery),
                Filters.eq("query", normalizedQuery));
        Document doc = collection.find(Filters.and(byUser, byQuery))
                .sort(Sorts.orderBy(Sorts.descending("UpdatedAt"), Sorts.descending("updated_at")))
                .first();
        if (doc == null) {
            return Optional.empty();
        }
        String videoId = asString(doc.get("VideoId"), doc.get("video_id"));
        if (videoId.isBlank()) {
            return Optional.empty();
        }
        Instant updatedAt = asInstant(doc.get("UpdatedAt"), doc.get("updated_at"));
        if (updatedAt == null) {
            return Optional.empty();
        }
        long ageMs = Instant.now().toEpochMilli() - updatedAt.toEpochMilli();
        if (ageMs > ttlMs) {
            return Optional.empty();
        }
        String videoTitle = asString(doc.get("VideoTitle"), doc.get("video_title"));
        return Optional.of(new YoutubeHeroVideoResponse(videoId, videoTitle));
    }

    public void saveUserQueryResult(String userId, String normalizedQuery, YoutubeHeroVideoResponse result) {
        MongoTemplate template = mongoTemplateProvider.getIfAvailable();
        if (userId == null || userId.isBlank() || normalizedQuery.isEmpty()) {
            return;
        }
        if (template == null) {
            saveUserQueryResultPostgres(userId, normalizedQuery, result);
            return;
        }
        if (result == null || result.getVideoId() == null || result.getVideoId().isBlank()) {
            return;
        }
        String uid = userId.trim();
        String id = buildDocumentId(uid, normalizedQuery);
        Document doc = new Document();
        doc.put("_id", id);
        // Keep both styles so existing readers in other services can filter reliably.
        doc.put("UserId", uid);
        doc.put("user_id", uid);
        doc.put("LoggedInUserId", uid);
        doc.put("logged_in_user_id", uid);
        doc.put("Query", normalizedQuery);
        doc.put("query", normalizedQuery);
        doc.put("VideoId", result.getVideoId());
        doc.put("video_id", result.getVideoId());
        doc.put("VideoTitle", result.getVideoTitle());
        doc.put("video_title", result.getVideoTitle());
        doc.put("UpdatedAt", Instant.now());
        doc.put("updated_at", Instant.now().toString());
        queryCacheCollection(template)
                .replaceOne(Filters.eq("_id", id), doc, new ReplaceOptions().upsert(true));
    }

    public static String buildDocumentId(String userId, String normalizedQuery) {
        return "youtube::" + userId.trim() + "::" + normalizedQuery;
    }

    private List<YoutubeQueryCacheEntryDto> listRecentForUserPostgres(String userId, int limit) {
        JdbcTemplate jdbc = jdbcTemplateProvider.getIfAvailable();
        if (jdbc == null) {
            return List.of();
        }
        int cap = Math.min(Math.max(limit, 1), 200);
        String uid = userId.trim();
        return jdbc.query(
                """
                        SELECT user_id, normalized_query, video_id, video_title, updated_at
                        FROM youtube_query_cache
                        WHERE deleted = false AND user_id = ?
                        ORDER BY updated_at DESC
                        LIMIT ?
                        """,
                (rs, rowNum) -> new YoutubeQueryCacheEntryDto(
                        rs.getString("user_id"),
                        rs.getString("normalized_query"),
                        rs.getString("video_id"),
                        rs.getString("video_title"),
                        rs.getTimestamp("updated_at") == null ? "" : rs.getTimestamp("updated_at").toInstant().toString()
                ),
                uid,
                cap
        );
    }

    private Optional<YoutubeHeroVideoResponse> findFreshCachedVideoPostgres(
            String userId,
            String normalizedQuery,
            long ttlMs
    ) {
        JdbcTemplate jdbc = jdbcTemplateProvider.getIfAvailable();
        if (jdbc == null) {
            return Optional.empty();
        }
        String uid = userId.trim();
        return jdbc.query(
                """
                        SELECT video_id, video_title, updated_at
                        FROM youtube_query_cache
                        WHERE deleted = false AND user_id = ? AND normalized_query = ?
                        LIMIT 1
                        """,
                (rs, rowNum) -> {
                    String vid = rs.getString("video_id");
                    String title = rs.getString("video_title");
                    java.sql.Timestamp ts = rs.getTimestamp("updated_at");
                    Instant updatedAt = ts == null ? null : ts.toInstant();
                    if (vid == null || vid.isBlank() || updatedAt == null) {
                        return null;
                    }
                    long ageMs = Instant.now().toEpochMilli() - updatedAt.toEpochMilli();
                    if (ageMs > ttlMs) {
                        return null;
                    }
                    return new YoutubeHeroVideoResponse(vid, title);
                },
                uid,
                normalizedQuery
        ).stream().filter(Objects::nonNull).findFirst();
    }

    private void saveUserQueryResultPostgres(String userId, String normalizedQuery, YoutubeHeroVideoResponse result) {
        JdbcTemplate jdbc = jdbcTemplateProvider.getIfAvailable();
        if (jdbc == null || result == null || result.getVideoId() == null || result.getVideoId().isBlank()) {
            return;
        }
        String id = buildDocumentId(userId, normalizedQuery);
        Instant now = Instant.now();
        jdbc.update(
                """
                        INSERT INTO youtube_query_cache (id, user_id, normalized_query, video_id, video_title, updated_at, deleted)
                        VALUES (?, ?, ?, ?, ?, ?, false)
                        ON CONFLICT (user_id, normalized_query) DO UPDATE SET
                            id = EXCLUDED.id,
                            video_id = EXCLUDED.video_id,
                            video_title = EXCLUDED.video_title,
                            updated_at = EXCLUDED.updated_at,
                            deleted = false
                        """,
                id,
                userId.trim(),
                normalizedQuery,
                result.getVideoId(),
                result.getVideoTitle(),
                java.sql.Timestamp.from(now)
        );
    }

    private YoutubeQueryCacheEntryDto toDto(Document doc) {
        Instant updatedAt = asInstant(doc.get("UpdatedAt"), doc.get("updated_at"));
        String updated = updatedAt != null ? updatedAt.toString() : "";
        String owner = asString(
                doc.get("LoggedInUserId"),
                doc.get("logged_in_user_id"),
                doc.get("UserId"),
                doc.get("user_id"));
        String query = asString(doc.get("Query"), doc.get("query"));
        String videoId = asString(doc.get("VideoId"), doc.get("video_id"));
        String videoTitle = asString(doc.get("VideoTitle"), doc.get("video_title"));
        return new YoutubeQueryCacheEntryDto(owner, query, videoId, videoTitle, updated);
    }

    private MongoCollection<Document> queryCacheCollection(MongoTemplate template) {
        String db = queryCacheDatabase == null || queryCacheDatabase.isBlank() ? "rag_db" : queryCacheDatabase;
        return template.getMongoDatabaseFactory().getMongoDatabase(db).getCollection(COLLECTION);
    }

    private static String asString(Object... values) {
        for (Object value : values) {
            if (value == null) continue;
            String s = String.valueOf(value).trim();
            if (!s.isBlank()) return s;
        }
        return "";
    }

    private static Instant asInstant(Object... values) {
        for (Object value : values) {
            if (value == null) continue;
            if (value instanceof Instant i) return i;
            if (value instanceof java.util.Date d) return d.toInstant();
            String raw = String.valueOf(value).trim();
            if (raw.isBlank()) continue;
            try {
                return Instant.parse(raw);
            } catch (DateTimeParseException ignored) {
                // try next
            }
        }
        return null;
    }
}
