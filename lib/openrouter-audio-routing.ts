/**
 * OpenRouter exposes TTS via either chat completions + streaming audio chunks,
 * or a dedicated OpenAI-compatible `POST /v1/audio/speech` endpoint.
 * Use the dedicated path for TTS-only model IDs so requests match provider expectations.
 */
export function modelUsesDedicatedSpeechApi(modelId: string): boolean {
  const m = modelId.toLowerCase();
  if (!m) return false;
  if (m.includes("whisper")) return false;
  if (m.includes("transcribe") && !m.includes("tts")) return false;
  return (
    m.includes("-tts-") ||
    m.includes("/tts-") ||
    (m.includes("voxtral") && m.includes("tts"))
  );
}
