package com.flexshell.ai;

public class AiProviderException extends RuntimeException {
    public enum Kind {
        CONFIG_MISSING,
        PROVIDER_FAILED
    }

    private final Kind kind;
    private final String provider;
    private final Integer providerHttpStatus;
    private final String providerStatus;

    public AiProviderException(Kind kind, String message) {
        super(message);
        this.kind = kind;
        this.provider = "";
        this.providerHttpStatus = null;
        this.providerStatus = "";
    }

    public AiProviderException(Kind kind, String message, String provider, Integer providerHttpStatus, String providerStatus) {
        super(message);
        this.kind = kind;
        this.provider = provider == null ? "" : provider;
        this.providerHttpStatus = providerHttpStatus;
        this.providerStatus = providerStatus == null ? "" : providerStatus;
    }

    public Kind kind() {
        return kind;
    }

    public String provider() {
        return provider;
    }

    public Integer providerHttpStatus() {
        return providerHttpStatus;
    }

    public String providerStatus() {
        return providerStatus;
    }
}
