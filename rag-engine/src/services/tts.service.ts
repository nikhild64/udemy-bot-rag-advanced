import { logger } from '@/shared/logger';

export interface PodcastLineInput {
  speaker: 'Alex' | 'Jamie';
  text: string;
  startTime?: number;
  endTime?: number;
}

export interface TTSVoiceOptions {
  speaker: 'Alex' | 'Jamie';
  gender: 'male' | 'female';
  text: string;
}

export interface TTSSynthesisResult {
  audioBuffer: Buffer;
  lines: PodcastLineInput[];
}

export interface TTSService {
  generateAudio(options: TTSVoiceOptions): Promise<Buffer | null>;
  generateFullPodcastAudio(lines: PodcastLineInput[]): Promise<TTSSynthesisResult | null>;
}

/**
 * Calculates audio duration (in seconds) from MP3 or WAV audio buffer.
 */
function getAudioBufferDuration(buffer: Buffer): number {
  if (!buffer || buffer.length < 44) return 0;

  // Check if WAV header ("RIFF")
  if (buffer.toString('ascii', 0, 4) === 'RIFF') {
    const byteRate = buffer.readUInt32LE(28);
    const subchunk2Size = buffer.readUInt32LE(40);
    if (byteRate > 0) {
      return subchunk2Size / byteRate;
    }
  }

  // MP3 Frame Header Parser
  const bitratesV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const bitratesV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  const sampleRatesV1 = [44100, 48000, 32000];
  const sampleRatesV2 = [22050, 24000, 16000];
  const sampleRatesV25 = [11025, 12000, 8000];

  let totalDuration = 0;
  let offset = 0;

  // Skip ID3v2 header if present
  if (buffer.length > 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
    const id3Size =
      ((buffer[6]! & 0x7f) << 21) |
      ((buffer[7]! & 0x7f) << 14) |
      ((buffer[8]! & 0x7f) << 7) |
      (buffer[9]! & 0x7f);
    offset = 10 + id3Size;
  }

  while (offset < buffer.length - 4) {
    if (buffer[offset] === 0xff && (buffer[offset + 1]! & 0xe0) === 0xe0) {
      const header = buffer.readUInt32BE(offset);
      const mpegVersion = (header >> 19) & 0x03; // 3 = v1, 2 = v2, 0 = v2.5
      const bitrateIdx = (header >> 12) & 0x0f;
      const sampleRateIdx = (header >> 10) & 0x03;
      const padding = (header >> 9) & 0x01;

      let sampleRate = 44100;
      let bitrate = 128000;
      let samplesPerFrame = 1152;

      if (mpegVersion === 3) {
        // MPEG 1
        sampleRate = sampleRatesV1[sampleRateIdx] || 44100;
        bitrate = (bitratesV1[bitrateIdx] || 128) * 1000;
        samplesPerFrame = 1152;
      } else if (mpegVersion === 2) {
        // MPEG 2
        sampleRate = sampleRatesV2[sampleRateIdx] || 22050;
        bitrate = (bitratesV2[bitrateIdx] || 64) * 1000;
        samplesPerFrame = 576;
      } else if (mpegVersion === 0) {
        // MPEG 2.5
        sampleRate = sampleRatesV25[sampleRateIdx] || 11025;
        bitrate = (bitratesV2[bitrateIdx] || 32) * 1000;
        samplesPerFrame = 576;
      }

      const frameSize = Math.floor((samplesPerFrame * bitrate) / (8 * sampleRate)) + padding;
      if (frameSize <= 0 || offset + frameSize > buffer.length) break;

      totalDuration += samplesPerFrame / sampleRate;
      offset += frameSize;
    } else {
      offset++;
    }
  }

  if (totalDuration > 0) return totalDuration;

  // Fallback estimation (128kbps CBR MP3)
  return (buffer.length * 8) / 128000;
}

/**
 * Web Speech / Browser-Native TTS Service Stub
 * Returns null as speech synthesis is executed client-side in the browser.
 */
export class WebSpeechTTSService implements TTSService {
  async generateAudio(_options: TTSVoiceOptions): Promise<Buffer | null> {
    return null;
  }

  async generateFullPodcastAudio(_lines: PodcastLineInput[]): Promise<TTSSynthesisResult | null> {
    return null;
  }
}

/**
 * Shared helper to synthesize line audio and compute timestamp markers
 */
async function buildPodcastAudioWithTimestamps(
  lines: PodcastLineInput[],
  synthesizeFn: (options: TTSVoiceOptions) => Promise<Buffer | null>,
  batchSize = 5,
): Promise<TTSSynthesisResult | null> {
  const synthesizedResults: (Buffer | null)[] = [];

  // Process TTS requests in parallel batches of size = batchSize (default 5)
  for (let i = 0; i < lines.length; i += batchSize) {
    const chunk = lines.slice(i, i + batchSize);
    const chunkBuffers = await Promise.all(
      chunk.map((line) =>
        synthesizeFn({
          speaker: line.speaker,
          gender: line.speaker === 'Alex' ? 'male' : 'female',
          text: line.text,
        }),
      ),
    );
    synthesizedResults.push(...chunkBuffers);
  }

  // Pass over ordered results to compute accurate timestamps and build final concatenated audio
  const audioBuffers: Buffer[] = [];
  const linesWithTimestamps: PodcastLineInput[] = [];
  let currentTimeOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const buf = synthesizedResults[i];

    if (buf) {
      audioBuffers.push(buf);
      const duration = getAudioBufferDuration(buf);
      const startTime = Number(currentTimeOffset.toFixed(2));
      currentTimeOffset += duration;
      const endTime = Number(currentTimeOffset.toFixed(2));

      linesWithTimestamps.push({
        ...line,
        startTime,
        endTime,
      });
    } else {
      linesWithTimestamps.push(line);
    }
  }

  if (audioBuffers.length === 0) return null;

  return {
    audioBuffer: Buffer.concat(audioBuffers),
    lines: linesWithTimestamps,
  };
}

/**
 * NVIDIA Riva TTS NIM Service
 */
export class NvidiaRivaTTSService implements TTSService {
  private ttsBaseUrl: string;

  constructor() {
    this.ttsBaseUrl = process.env.NVIDIA_TTS_BASE_URL || '';
  }

  async generateAudio(options: TTSVoiceOptions): Promise<Buffer | null> {
    if (!this.ttsBaseUrl) {
      logger.warn(
        '[NvidiaRivaTTS] NVIDIA_TTS_BASE_URL not configured. ' +
        'NVIDIA TTS NIMs require a self-hosted NIM container (gRPC). ' +
        'Set NVIDIA_TTS_BASE_URL=http://your-nim-host:9000 or switch to TTS_PROVIDER=mistral for REST-based TTS.',
      );
      return null;
    }

    try {
      logger.info({ speaker: options.speaker }, '[NvidiaRivaTTS] Synthesizing speech via self-hosted NVIDIA Riva NIM');
      const voice = options.speaker === 'Alex' ? 'English-US.Male-1' : 'English-US.Female-1';

      const response = await fetch(`${this.ttsBaseUrl}/v1/audio/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'audio/wav',
        },
        body: JSON.stringify({
          text: options.text,
          voice: { name: voice },
          audio_format: 'wav',
          sample_rate_hz: 22050,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn({ status: response.status, errText }, '[NvidiaRivaTTS] NVIDIA TTS NIM error, falling back');
        return null;
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      logger.error({ error: error.message }, '[NvidiaRivaTTS] Audio generation failed');
      return null;
    }
  }

  async generateFullPodcastAudio(lines: PodcastLineInput[]): Promise<TTSSynthesisResult | null> {
    try {
      return await buildPodcastAudioWithTimestamps(lines, (opts) => this.generateAudio(opts));
    } catch (err: any) {
      logger.error({ error: err.message }, '[NvidiaRivaTTS] Failed to generate full podcast audio');
      return null;
    }
  }
}

/**
 * Mistral Voxtral TTS Service
 */
export class MistralVoxtralTTSService implements TTSService {
  private apiKey: string;
  private maleVoiceId: string | null;
  private femaleVoiceId: string | null;

  constructor() {
    this.apiKey = process.env.MISTRAL_API_KEY || '';
    this.maleVoiceId = process.env.MISTRAL_MALE_VOICE_ID || 'en_paul_cheerful';
    this.femaleVoiceId = process.env.MISTRAL_FEMALE_VOICE_ID || 'gb_jane_confident';
  }

  async generateAudio(options: TTSVoiceOptions): Promise<Buffer | null> {
    if (!this.apiKey) {
      logger.warn('[MistralVoxtralTTS] MISTRAL_API_KEY not configured, falling back to Web Speech');
      return null;
    }

    const voiceId = options.speaker === 'Alex' ? this.maleVoiceId : this.femaleVoiceId;
    if (!voiceId) {
      logger.warn(
        { speaker: options.speaker },
        '[MistralVoxtralTTS] No voice_id configured for speaker. Run setup-mistral-voices.ts first.',
      );
      return null;
    }

    try {
      logger.info({ speaker: options.speaker, voiceId }, '[MistralVoxtralTTS] Synthesizing speech via Voxtral TTS');

      const response = await fetch('https://api.mistral.ai/v1/audio/speech', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'voxtral-mini-tts-2603',
          input: options.text,
          voice_id: voiceId,
          response_format: 'mp3',
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.warn({ status: response.status, errText }, '[MistralVoxtralTTS] API error — falling back for this line');
        return null;
      }

      // Mistral returns JSON with base64-encoded audio_data field
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await response.json()) as { audio_data?: string };
        if (json.audio_data) {
          return Buffer.from(json.audio_data, 'base64');
        }
        logger.warn('[MistralVoxtralTTS] JSON response had no audio_data field');
        return null;
      }

      // Fallback: treat response as raw audio bytes
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error: any) {
      logger.error({ error: error.message }, '[MistralVoxtralTTS] Audio generation failed');
      return null;
    }
  }

  async generateFullPodcastAudio(lines: PodcastLineInput[]): Promise<TTSSynthesisResult | null> {
    try {
      return await buildPodcastAudioWithTimestamps(lines, (opts) => this.generateAudio(opts));
    } catch (err: any) {
      logger.error({ error: err.message }, '[MistralVoxtralTTS] Failed to generate full podcast audio');
      return null;
    }
  }
}

/**
 * Factory for creating configured TTS Service.
 *
 * Supported providers via TTS_PROVIDER env var:
 *   - web_speech : Default. Client-side browser speech synthesis (zero tokens, zero cost).
 *   - mistral    : Cloud REST TTS via Mistral Voxtral API (requires MISTRAL_API_KEY).
 *   - nvidia     : Self-hosted NVIDIA Riva NIM container (requires NVIDIA_TTS_BASE_URL,
 *                  NOT available via integrate.api.nvidia.com REST API).
 */
export class TTSServiceFactory {
  static create(): TTSService {
    const provider = (process.env.TTS_PROVIDER || 'web_speech').toLowerCase();

    switch (provider) {
      case 'nvidia':
        return new NvidiaRivaTTSService();
      case 'mistral':
        return new MistralVoxtralTTSService();
      case 'web_speech':
      default:
        return new WebSpeechTTSService();
    }
  }
}
