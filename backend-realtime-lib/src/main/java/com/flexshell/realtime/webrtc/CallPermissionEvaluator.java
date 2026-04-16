package com.flexshell.realtime.webrtc;

/**
 * App-provided policy hook: decide who can call whom.
 *
 * Implement this in the consuming app (hospital/ecommerce) and register as a Spring bean.
 */
public interface CallPermissionEvaluator {
    boolean canInitiate(String initiatorId, String receiverId);
}

