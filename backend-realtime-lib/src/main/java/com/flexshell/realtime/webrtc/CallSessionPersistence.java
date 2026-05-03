package com.flexshell.realtime.webrtc;

import java.util.Optional;

/**
 * Storage for WebRTC call sessions (Mongo or Postgres, depending on deployment).
 */
public interface CallSessionPersistence {

    CallSessionEntity save(CallSessionEntity entity);

    Optional<CallSessionEntity> findById(String callId);
}
