package com.flexshell.controller.dto;

public record AiChatFigureDto(
        Integer imgIndex,
        Integer page,
        String ext,
        String caption,
        String imageData,
        String url,
        String sourceFile
) {
}
