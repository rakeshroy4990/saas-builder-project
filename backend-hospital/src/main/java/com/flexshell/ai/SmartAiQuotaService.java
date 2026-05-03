package com.flexshell.ai;

import com.flexshell.controller.dto.AiChatMessageDto;
import com.flexshell.controller.dto.AiChatRequest;
import com.flexshell.persistence.postgres.SmartAiDailyUsagePgRepository;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Enforces Smart AI limits: estimated input tokens per request and billable requests per user per UTC day.
 * Uses {@link MongoTemplate} when Mongo is enabled; otherwise an in-process counter (suitable for local dev only).
 */
@Service
public class SmartAiQuotaService {
    private static final int CHARS_PER_TOKEN_ESTIMATE = 4;

    private final int maxRequestsPerDay;
    private final int maxInputTokensPerRequest;
    private final MongoTemplate mongoTemplate;
    private final SmartAiDailyUsagePgRepository pgDailyUsage;
    private final ConcurrentHashMap<String, AtomicInteger> memoryDailyCounts = new ConcurrentHashMap<>();

    public SmartAiQuotaService(
            @Value("${app.ai.smart.max-requests-per-day:15}") int maxRequestsPerDay,
            @Value("${app.ai.smart.max-input-tokens-per-request:1200}") int maxInputTokensPerRequest,
            @Autowired(required = false) MongoTemplate mongoTemplate,
            ObjectProvider<SmartAiDailyUsagePgRepository> pgDailyUsageProvider
    ) {
        this.maxRequestsPerDay = Math.max(1, maxRequestsPerDay);
        this.maxInputTokensPerRequest = Math.max(1, maxInputTokensPerRequest);
        this.mongoTemplate = mongoTemplate;
        this.pgDailyUsage = pgDailyUsageProvider.getIfAvailable();
    }

    public void assertWithinTokenBudget(AiChatRequest request) {
        int estimated = estimateRequestInputTokens(request);
        if (estimated > maxInputTokensPerRequest) {
            throw new SmartAiQuotaExceededException(SmartAiQuotaExceededException.Kind.TOKEN);
        }
    }

    /**
     * Reserves one daily Smart AI slot for the user. Call after greeting short-circuit, before provider work.
     */
    public void consumeDailyRequestOrThrow(String userId) {
        String actor = userId == null ? "" : userId.trim();
        if (actor.isBlank()) {
            return;
        }
        String utcDay = LocalDate.now(ZoneOffset.UTC).toString();
        String compositeId = actor + "|" + utcDay;
        if (this.mongoTemplate != null) {
            consumeDailyMongo(compositeId, actor, utcDay);
        } else if (this.pgDailyUsage != null) {
            consumeDailyPostgres(compositeId, actor, utcDay);
        } else {
            consumeDailyMemory(compositeId);
        }
    }

    static int estimateTokensForText(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        return (text.length() + CHARS_PER_TOKEN_ESTIMATE - 1) / CHARS_PER_TOKEN_ESTIMATE;
    }

    int estimateRequestInputTokens(AiChatRequest request) {
        int sum = estimateTokensForText(request.message());
        List<AiChatMessageDto> history = request.history();
        if (history == null || history.isEmpty()) {
            return sum;
        }
        for (AiChatMessageDto m : history) {
            if (m == null) {
                continue;
            }
            sum += estimateTokensForText(m.role());
            sum += estimateTokensForText(m.content());
        }
        return sum;
    }

    private void consumeDailyPostgres(String compositeId, String userId, String utcDay) {
        Instant now = Instant.now();
        int newCount = pgDailyUsage.incrementAndGetCount(compositeId, userId, utcDay, now);
        if (newCount > maxRequestsPerDay) {
            pgDailyUsage.decrementCount(compositeId);
            throw new SmartAiQuotaExceededException(SmartAiQuotaExceededException.Kind.DAILY);
        }
    }

    private void consumeDailyMongo(String compositeId, String userId, String utcDay) {
        Query query = Query.query(Criteria.where("_id").is(compositeId));
        Update update = new Update()
                .inc("requestCount", 1)
                .set("userId", userId)
                .set("utcDay", utcDay)
                .set("updatedAt", Instant.now());
        FindAndModifyOptions options = FindAndModifyOptions.options().returnNew(true).upsert(true);
        SmartAiDailyUsageEntity doc = this.mongoTemplate.findAndModify(query, update, options, SmartAiDailyUsageEntity.class);
        if (doc != null && doc.getRequestCount() > maxRequestsPerDay) {
            this.mongoTemplate.updateFirst(query, new Update().inc("requestCount", -1), SmartAiDailyUsageEntity.class);
            throw new SmartAiQuotaExceededException(SmartAiQuotaExceededException.Kind.DAILY);
        }
    }

    private void consumeDailyMemory(String compositeId) {
        AtomicInteger counter = memoryDailyCounts.computeIfAbsent(compositeId, k -> new AtomicInteger(0));
        while (true) {
            int current = counter.get();
            if (current >= maxRequestsPerDay) {
                throw new SmartAiQuotaExceededException(SmartAiQuotaExceededException.Kind.DAILY);
            }
            if (counter.compareAndSet(current, current + 1)) {
                return;
            }
        }
    }
}
