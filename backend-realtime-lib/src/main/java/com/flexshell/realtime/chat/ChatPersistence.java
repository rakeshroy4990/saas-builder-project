package com.flexshell.realtime.chat;

import java.util.List;
import java.util.Optional;

/**
 * Storage for direct chat rooms, messages, and read acks (Mongo or Postgres).
 */
public interface ChatPersistence {

    ChatRoomEntity saveRoom(ChatRoomEntity room);

    Optional<ChatRoomEntity> findRoomById(String roomId);

    List<ChatRoomEntity> findRoomsByParticipant(String userId);

    long incrementRoomSequence(String roomId);

    ChatMessageEntity saveMessage(ChatMessageEntity message);

    Optional<ChatMessageEntity> findMessageByRoomAndClientMessageId(String roomId, String clientMessageId);

    List<ChatMessageEntity> findRecentMessages(String roomId, int limit);

    ChatAckEntity saveAck(ChatAckEntity ack);

    Optional<ChatAckEntity> findAck(String roomId, String userId);
}
