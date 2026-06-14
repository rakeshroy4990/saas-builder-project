package com.flexshell.telemetry;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionFlowDeriverTest {

    @Test
    void derive_buildsOrderedFlowAndCountsErrors() {
        List<SessionSummaryEntryDocument> summary = List.of(
                entry("navigate", "home", null, null, null, null),
                entry("navigate", "login", null, null, null, null),
                apiEntry("api_call", "/api/auth/login", 200),
                apiEntry("api_call", "/api/v1/notifications/unread-count", 200),
                apiEntry("api_call", "/api/v1/notifications", 200),
                apiEntry("api_call", "/api/youtube-queries", 200),
                buttonEntry("Book Now"),
                popupEntry("appointment-booking-popup"),
                apiEntry("api_error", "/api/appointment/booking/form-context", 500)
        );

        SessionFlowDeriver.FlowDerivation flow = SessionFlowDeriver.derive(summary);

        assertEquals(
                List.of(
                        "Home (page)",
                        "Login (page)",
                        "/auth/login (server 200)",
                        "/unread-count (server 200)",
                        "/notifications (server 200)",
                        "/youtube-queries (server 200)",
                        "Book Now (Button clicked)",
                        "Appointment (popup)",
                        "/booking/form-context (server 500)"
                ),
                flow.steps()
        );
        assertEquals(1, flow.errorCount());
    }

    @Test
    void derive_skipsDuplicateConsecutiveSteps() {
        List<SessionSummaryEntryDocument> summary = List.of(
                entry("navigate", "home", null, null, null, null),
                entry("navigate", "home", null, null, null, null),
                apiEntry("api_call", "/api/auth/login", 200)
        );

        SessionFlowDeriver.FlowDerivation flow = SessionFlowDeriver.derive(summary);

        assertEquals(2, flow.steps().size());
        assertEquals("Home (page)", flow.steps().get(0));
    }

    @Test
    void isFlowError_treats4xxApiCallAsError() {
        SessionSummaryEntryDocument entry = apiEntry("api_call", "/api/user", 401);
        assertTrue(SessionFlowDeriver.isFlowError(entry));
    }

    private static SessionSummaryEntryDocument entry(
            String kind,
            String pageId,
            String popupPageId,
            String actionAlias,
            String apiPath,
            Integer httpStatus
    ) {
        SessionSummaryEntryDocument doc = new SessionSummaryEntryDocument();
        doc.setEntryId("e-" + kind + "-" + pageId);
        doc.setKind(kind);
        doc.setPageId(pageId);
        doc.setPopupPageId(popupPageId);
        doc.setActionAlias(actionAlias);
        doc.setApiPath(apiPath);
        doc.setHttpStatus(httpStatus);
        return doc;
    }

    private static SessionSummaryEntryDocument apiEntry(String kind, String apiPath, int status) {
        return entry(kind, null, null, null, apiPath, status);
    }

    private static SessionSummaryEntryDocument buttonEntry(String actionAlias) {
        SessionSummaryEntryDocument doc = entry("button_click", "home", null, actionAlias, null, null);
        doc.setComponentId("book-now-btn");
        return doc;
    }

    private static SessionSummaryEntryDocument popupEntry(String popupPageId) {
        SessionSummaryEntryDocument doc = entry("popup_open", null, popupPageId, null, null, null);
        doc.setAttributes(Map.of("title", "Appointment"));
        return doc;
    }
}
