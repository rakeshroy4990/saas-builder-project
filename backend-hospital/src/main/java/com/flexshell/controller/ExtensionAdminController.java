package com.flexshell.controller;

import com.flexshell.i18n.LocalizedApiMessages;
import com.flexshell.controller.dto.StandardApiResponse;
import com.flexshell.extension.EndpointMapDocument;
import com.flexshell.extension.HookRegistry;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * L3 extension admin (hooks, endpoint map). L1/L2 UI config uses {@code POST /api/uiMetdata/save} only.
 */
@RestController
@RequestMapping("/api/v1/admin/extensions")
public class ExtensionAdminController {
    private final LocalizedApiMessages messages;

    private final HookRegistry hookRegistry;

    public ExtensionAdminController(HookRegistry hookRegistry,
            LocalizedApiMessages messages) {
        this.messages = messages;

        this.hookRegistry = hookRegistry;
    }

    @PostMapping("/reload")
    public ResponseEntity<StandardApiResponse<Map<String, String>>> reload() {
        hookRegistry.reload();
        Map<String, String> body = Map.of("message", "Extension config reloaded");
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.extension.reloaded"), body));
    }

    @GetMapping("/map")
    public ResponseEntity<StandardApiResponse<EndpointMapDocument>> map() {
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.extension.endpoint.map"), hookRegistry.getEndpointMap()));
    }

    @GetMapping("/hooks")
    public ResponseEntity<StandardApiResponse<Map<String, String>>> hooks() {
        return ResponseEntity.ok(StandardApiResponse.success(messages.success("success.extension.registered.hooks"), hookRegistry.registeredHookNames()));
    }
}
