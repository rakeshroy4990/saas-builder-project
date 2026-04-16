package com.flexshell.realtime.ws;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;

@Component
public class TrackingWebSocketHandlerDecoratorFactory implements WebSocketHandlerDecoratorFactory {
    private final WebSocketSessionTracker tracker;

    public TrackingWebSocketHandlerDecoratorFactory(WebSocketSessionTracker tracker) {
        this.tracker = tracker;
    }

    @Override
    public WebSocketHandler decorate(WebSocketHandler handler) {
        return new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                tracker.put(session);
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
                tracker.remove(session.getId());
                super.afterConnectionClosed(session, closeStatus);
            }
        };
    }
}

