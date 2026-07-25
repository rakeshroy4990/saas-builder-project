package com.flexshell.audio.pipeline;

import com.flexshell.ai.OpenAiSpeechAdapter;
import org.springframework.stereotype.Service;

@Service
public class SpeechRecognitionService {

    private final OpenAiSpeechAdapter speechAdapter;

    public SpeechRecognitionService(OpenAiSpeechAdapter speechAdapter) {
        this.speechAdapter = speechAdapter;
    }

    public OpenAiSpeechAdapter.TranscriptionResult transcribe(
            byte[] audioBytes,
            String filename,
            String mimeType,
            String languageHint
    ) {
        return speechAdapter.transcribe(audioBytes, filename, mimeType, languageHint);
    }
}
