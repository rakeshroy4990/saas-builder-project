package com.flexshell.auth.api;

import com.fasterxml.jackson.annotation.JsonAlias;

public class LogoutRequest {
    @JsonAlias({"RefreshToken"})
    private String refreshToken;

    @JsonAlias({"DeviceId"})
    private String deviceId;

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }
}
