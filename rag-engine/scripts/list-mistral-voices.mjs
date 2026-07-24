// list-mistral-voices.mjs — run with: node scripts/list-mistral-voices.mjs
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Parse .env manually (no dotenv needed)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');
const envContent = readFileSync(envPath, 'utf8');
const MISTRAL_API_KEY = envContent.split('\n')
  .find(l => l.startsWith('MISTRAL_API_KEY='))
  ?.split('=').slice(1).join('=').trim();

if (!MISTRAL_API_KEY) { console.error('MISTRAL_API_KEY not found in .env'); process.exit(1); }

const res = await fetch(`https://api.mistral.ai/v1/audio/voices?limit=50`, {
  headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` }
});

if (!res.ok) { console.error(`HTTP ${res.status}: ${await res.text()}`); process.exit(1); }

const data = await res.json();
console.log(`\nTotal voices: ${data.data?.length ?? 0}`);

const presets = (data.data ?? []).filter(v => v.is_preset);
console.log(`Preset voices: ${presets.length}\n`);

if (presets.length > 0) {
  console.log('=== PRESET (FREE) VOICES ===');
  presets.forEach(v => {
    console.log(`  Name: ${v.name} | ID: ${v.id} | Gender: ${v.gender ?? 'N/A'}`);
  });
} else {
  console.log('No preset voices found.\n=== ALL VOICES ===');
  (data.data ?? []).forEach(v => {
    console.log(`  Name: ${v.name} | ID: ${v.id} | is_preset: ${v.is_preset} | Gender: ${v.gender ?? 'N/A'}`);
  });
}
