/**
 * One-time setup script: Creates Alex (male) and Jamie (female) voice profiles
 * on Mistral Voxtral TTS using bundled sample audio files.
 *
 * Usage:
 *   1. Place two sample audio files in rag-engine/scripts/voice-samples/:
 *      - alex-sample.mp3   (3–25 sec, clear male voice speaking English)
 *      - jamie-sample.mp3  (3–25 sec, clear female voice speaking English)
 *   2. Run: npx ts-node --project tsconfig.json scripts/setup-mistral-voices.ts
 *   3. Copy the printed voice IDs into your .env:
 *      MISTRAL_MALE_VOICE_ID=<id>
 *      MISTRAL_FEMALE_VOICE_ID=<id>
 *
 * Note: Voice IDs are permanent on your Mistral account — run this script only once.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
if (!MISTRAL_API_KEY) {
  console.error('❌  MISTRAL_API_KEY is not set in rag-engine/.env');
  process.exit(1);
}

const SAMPLES_DIR = path.resolve(__dirname, 'voice-samples');

interface CreateVoiceResult {
  id: string;
  name: string;
  gender: string;
}

async function createVoice(
  name: string,
  sampleFilePath: string,
  gender: 'male' | 'female',
): Promise<CreateVoiceResult> {
  if (!fs.existsSync(sampleFilePath)) {
    throw new Error(
      `Sample audio file not found: ${sampleFilePath}\n` +
        `Please place a 3–25 second ${gender} voice sample at this path.`,
    );
  }

  const audioBytes = fs.readFileSync(sampleFilePath);
  const audioB64 = audioBytes.toString('base64');
  const filename = path.basename(sampleFilePath);

  console.log(`\n📤  Creating ${gender} voice "${name}" from ${filename} (${(audioBytes.length / 1024).toFixed(1)} KB)...`);

  const response = await fetch('https://api.mistral.ai/v1/audio/voices', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${MISTRAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      sample_audio: audioB64,
      sample_filename: filename,
      languages: ['en'],
      gender,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Failed to create voice "${name}": HTTP ${response.status} — ${errText}`);
  }

  const data = (await response.json()) as CreateVoiceResult;
  return data;
}

async function main() {
  console.log('🎙  Mistral Voxtral Voice Setup Script');
  console.log('======================================');

  if (!fs.existsSync(SAMPLES_DIR)) {
    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
    console.log(`\n📁  Created samples directory: ${SAMPLES_DIR}`);
    console.log('    Please place the following files there and re-run:');
    console.log('      alex-sample.mp3   — 3–25 sec clear male English voice');
    console.log('      jamie-sample.mp3  — 3–25 sec clear female English voice');
    process.exit(0);
  }

  try {
    const alexVoice = await createVoice(
      'Alex - RAG Podcast Male',
      path.join(SAMPLES_DIR, 'alex-sample.mp3'),
      'male',
    );
    console.log(`✅  Alex voice created: ${alexVoice.id}`);

    const jamieVoice = await createVoice(
      'Jamie - RAG Podcast Female',
      path.join(SAMPLES_DIR, 'jamie-sample.mp3'),
      'female',
    );
    console.log(`✅  Jamie voice created: ${jamieVoice.id}`);

    console.log('\n======================================');
    console.log('🎉  Voice IDs created! Add these to your rag-engine/.env:\n');
    console.log(`MISTRAL_MALE_VOICE_ID=${alexVoice.id}`);
    console.log(`MISTRAL_FEMALE_VOICE_ID=${jamieVoice.id}`);
    console.log('\nThen restart the rag-engine server. No need to run this script again.');
  } catch (err: any) {
    console.error(`\n❌  Error: ${err.message}`);
    process.exit(1);
  }
}

main();
