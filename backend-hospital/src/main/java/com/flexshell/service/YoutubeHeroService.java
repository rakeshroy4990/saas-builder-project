package com.flexshell.service;

import com.flexshell.controller.dto.YoutubeHeroVideoResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class YoutubeHeroService {
    /** Returns a random curated hero video from {@link YoutubeCuratedVideos#ALL}. */
    public YoutubeHeroVideoResponse resolveHeroVideo(String rawQuery, String userId) {
        List<YoutubeCuratedVideos.VideoMeta> curated = YoutubeCuratedVideos.ALL;
        if (curated.isEmpty()) {
            return new YoutubeHeroVideoResponse(null, null);
        }
        YoutubeCuratedVideos.VideoMeta pick = curated.get(ThreadLocalRandom.current().nextInt(curated.size()));
        return new YoutubeHeroVideoResponse(pick.videoId(), pick.title(), pick.description());
    }
}
