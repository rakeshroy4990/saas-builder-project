package com.flexshell.persistence.postgres;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

/**
 * Atomic increment for Smart AI daily usage counters on PostgreSQL (replaces Mongo {@code findAndModify} upsert).
 */
@Repository
@ConditionalOnProperty(name = "app.persistence.provider", havingValue = "postgres")
public class SmartAiDailyUsagePgRepository {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Upserts the row and returns the new {@code request_count} after increment.
     */
    @Transactional
    public int incrementAndGetCount(String id, String userId, String utcDay, Instant updatedAt) {
        Object single = entityManager.createNativeQuery("""
                        INSERT INTO smart_ai_daily_usage (id, request_count, user_id, utc_day, updated_at, deleted)
                        VALUES (?1, 1, ?2, ?3, ?4, false)
                        ON CONFLICT (id) DO UPDATE SET
                            request_count = smart_ai_daily_usage.request_count + 1,
                            updated_at = EXCLUDED.updated_at
                        RETURNING request_count
                        """)
                .setParameter(1, id)
                .setParameter(2, userId)
                .setParameter(3, utcDay)
                .setParameter(4, updatedAt)
                .getSingleResult();
        return ((Number) single).intValue();
    }

    @Transactional
    public void decrementCount(String id) {
        entityManager.createNativeQuery("""
                        UPDATE smart_ai_daily_usage SET request_count = GREATEST(request_count - 1, 0)
                        WHERE id = ?1
                        """)
                .setParameter(1, id)
                .executeUpdate();
    }
}
