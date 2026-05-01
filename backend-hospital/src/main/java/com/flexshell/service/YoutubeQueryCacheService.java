package com.flexshell.service;

import com.flexshell.controller.dto.YoutubeQueryCacheEntryDto;
import com.flexshell.controller.dto.YoutubeHeroVideoResponse;
import com.flexshell.youtube.QueryCacheEntity;
import com.flexshell.youtube.QueryCacheRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class YoutubeQueryCacheService {
    private static final int DEFAULT_LIST_LIMIT = 50;

    private final ObjectProvider<QueryCacheRepository> queryCacheRepositoryProvider;

    public YoutubeQueryCacheService(ObjectProvider<QueryCacheRepository> queryCacheRepositoryProvider) {
        this.queryCacheRepositoryProvider = queryCacheRepositoryProvider;
    }

    public List<YoutubeQueryCacheEntryDto> listRecentForUser(String userId, int limit) {
        QueryCacheRepository repository = queryCacheRepositoryProvider.getIfAvailable();
        if (repository == null || userId == null || userId.isBlank()) {
            return List.of();
        }
        int cap = Math.min(Math.max(limit, 1), 200);
        return repository
                .findByUserIdOrderByUpdatedAtDesc(userId.trim(), PageRequest.of(0, cap))
                .getContent()
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public Optional<YoutubeHeroVideoResponse> findFreshCachedVideo(
            String userId,
            String normalizedQuery,
            long ttlMs
    ) {
        QueryCacheRepository repository = queryCacheRepositoryProvider.getIfAvailable();
        if (repository == null || userId == null || userId.isBlank() || normalizedQuery.isEmpty()) {
            return Optional.empty();
        }
        Optional<QueryCacheEntity> row = repository.findByUserIdAndQuery(userId.trim(), normalizedQuery);
        if (row.isEmpty()) {
            return Optional.empty();
        }
        QueryCacheEntity doc = row.get();
        if (doc.getVideoId() == null || doc.getVideoId().isBlank()) {
            return Optional.empty();
        }
        if (doc.getUpdatedAt() == null) {
            return Optional.empty();
        }
        long ageMs = Instant.now().toEpochMilli() - doc.getUpdatedAt().toEpochMilli();
        if (ageMs > ttlMs) {
            return Optional.empty();
        }
        return Optional.of(new YoutubeHeroVideoResponse(doc.getVideoId(), doc.getVideoTitle()));
    }

    public void saveUserQueryResult(String userId, String normalizedQuery, YoutubeHeroVideoResponse result) {
        QueryCacheRepository repository = queryCacheRepositoryProvider.getIfAvailable();
        if (repository == null || userId == null || userId.isBlank() || normalizedQuery.isEmpty()) {
            return;
        }
        if (result == null || result.getVideoId() == null || result.getVideoId().isBlank()) {
            return;
        }
        String uid = userId.trim();
        String id = buildDocumentId(uid, normalizedQuery);
        QueryCacheEntity doc = repository.findById(id).orElseGet(QueryCacheEntity::new);
        doc.setId(id);
        doc.setUserId(uid);
        doc.setLoggedInUserId(uid);
        doc.setQuery(normalizedQuery);
        doc.setVideoId(result.getVideoId());
        doc.setVideoTitle(result.getVideoTitle());
        doc.setUpdatedAt(Instant.now());
        repository.save(doc);
    }

    public static String buildDocumentId(String userId, String normalizedQuery) {
        return userId.trim() + "::" + normalizedQuery;
    }

    private YoutubeQueryCacheEntryDto toDto(QueryCacheEntity doc) {
        String updated = doc.getUpdatedAt() != null ? doc.getUpdatedAt().toString() : "";
        String owner =
                doc.getLoggedInUserId() != null && !doc.getLoggedInUserId().isBlank()
                        ? doc.getLoggedInUserId()
                        : doc.getUserId();
        return new YoutubeQueryCacheEntryDto(owner, doc.getQuery(), doc.getVideoId(), doc.getVideoTitle(), updated);
    }
}
