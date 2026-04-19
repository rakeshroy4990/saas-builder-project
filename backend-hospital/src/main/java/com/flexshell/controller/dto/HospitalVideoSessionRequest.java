package com.flexshell.controller.dto;

/**
 * Body for {@code POST /api/hospital/video/session}. Provide either an appointment id (preferred) or an explicit peer user id.
 */
public record HospitalVideoSessionRequest(String appointmentId, String peerUserId) {
}
