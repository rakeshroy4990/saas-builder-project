package com.flexshell.persistence;

import com.flexshell.auth.RefreshTokenEntity;
import com.flexshell.persistence.postgres.model.RefreshTokenJpaEntity;

public final class RefreshTokenEntityMapper {

    private RefreshTokenEntityMapper() {
    }

    public static RefreshTokenEntity fromJpa(RefreshTokenJpaEntity row) {
        RefreshTokenEntity e = new RefreshTokenEntity();
        e.setId(row.getId());
        e.setToken(row.getToken());
        e.setUserId(row.getUserId());
        e.setExpiry(row.getExpiry());
        e.setDeviceId(row.getDeviceId());
        e.setCreatedAt(row.getCreatedAt());
        return e;
    }

    public static RefreshTokenJpaEntity toJpa(RefreshTokenEntity entity) {
        RefreshTokenJpaEntity row = new RefreshTokenJpaEntity();
        row.setId(entity.getId());
        row.setToken(entity.getToken());
        row.setUserId(entity.getUserId());
        row.setExpiry(entity.getExpiry());
        row.setDeviceId(entity.getDeviceId());
        row.setCreatedAt(entity.getCreatedAt());
        row.setDeleted(false);
        return row;
    }
}
