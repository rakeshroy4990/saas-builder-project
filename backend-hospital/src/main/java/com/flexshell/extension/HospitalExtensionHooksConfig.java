package com.flexshell.extension;

import com.flexshell.extension.hooks.HospitalExtensionHooks;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;

@Configuration
public class HospitalExtensionHooksConfig {
    private final HookRegistry hookRegistry;
    private final HospitalExtensionHooks hospitalHooks;

    public HospitalExtensionHooksConfig(HookRegistry hookRegistry, HospitalExtensionHooks hospitalHooks) {
        this.hookRegistry = hookRegistry;
        this.hospitalHooks = hospitalHooks;
    }

    @PostConstruct
    void registerHooks() {
        hospitalHooks.registerAll(hookRegistry);
    }
}
