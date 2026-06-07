package com.flexshell.controller.support;

import com.flexshell.controller.dto.StandardApiResponse;
import org.springframework.http.ResponseEntity;

import java.util.List;

/**
 * Builds entity list responses: row array in envelope {@code Data}; {@code Page}, {@code Size},
 * {@code TotalCount} on the envelope (see entity-crud-endpoints.mdc).
 */
public final class EntityListResponseSupport {

    private EntityListResponseSupport() {
    }

    public static <T> ResponseEntity<StandardApiResponse<List<T>>> ok(
            String message,
            List<T> items,
            int page,
            int size,
            long totalCount
    ) {
        return ResponseEntity.ok(StandardApiResponse.successPagedList(message, items, page, size, totalCount));
    }
}
