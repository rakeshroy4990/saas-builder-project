package com.flexshell.auth.api;

public class RefreshTokenResponse {
    private String accessToken;
    private long accessTokenExpiresInSeconds;
    private String refreshToken;
    private long refreshTokenExpiresInSeconds;
    private String tokenType = "Bearer";

    public RefreshTokenResponse() {
    }

    public RefreshTokenResponse(
            String accessToken,
            long accessTokenExpiresInSeconds,
            String refreshToken,
            long refreshTokenExpiresInSeconds
    ) {
        this.accessToken = accessToken;
        this.accessTokenExpiresInSeconds = accessTokenExpiresInSeconds;
        this.refreshToken = refreshToken;
        this.refreshTokenExpiresInSeconds = refreshTokenExpiresInSeconds;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public void setAccessToken(String accessToken) {
        this.accessToken = accessToken;
    }

    public long getAccessTokenExpiresInSeconds() {
        return accessTokenExpiresInSeconds;
    }

    public void setAccessTokenExpiresInSeconds(long accessTokenExpiresInSeconds) {
        this.accessTokenExpiresInSeconds = accessTokenExpiresInSeconds;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public void setRefreshToken(String refreshToken) {
        this.refreshToken = refreshToken;
    }

    public long getRefreshTokenExpiresInSeconds() {
        return refreshTokenExpiresInSeconds;
    }

    public void setRefreshTokenExpiresInSeconds(long refreshTokenExpiresInSeconds) {
        this.refreshTokenExpiresInSeconds = refreshTokenExpiresInSeconds;
    }

    public String getTokenType() {
        return tokenType;
    }

    public void setTokenType(String tokenType) {
        this.tokenType = tokenType;
    }
}
