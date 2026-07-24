import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY!;

async function main() {
  console.log('Fetching Mistral voices...');
  const res = await fetch('https://api.mistral.ai/v1/audio/voices?limit=50', {
    headers: { Authorization: `Bearer ${MISTRAL_API_KEY}` },
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    process.exit(1);
  }

  const data = await res.json() as { data: Array<{ id: string; name: string; gender?: string; is_preset?: boolean; languages?: string[] }> };
  console.log(`\nTotal voices: ${data.data.length}`);

  const presets = data.data.filter((v) => v.is_preset);
  console.log(`Preset voices: ${presets.length}\n`);

  if (presets.length > 0) {
    console.log('=== PRESET (FREE BUILT-IN) VOICES ===');
    presets.forEach((v) => {
      console.log(`  Name: ${v.name} | ID: ${v.id} | Gender: ${v.gender || 'N/A'} | Languages: ${(v.languages || []).join(', ')}`);
    });
  } else {
    console.log('No preset voices found.');
    console.log('\n=== ALL VOICES ===');
    data.data.forEach((v) => {
      console.log(`  Name: ${v.name} | ID: ${v.id} | is_preset: ${v.is_preset} | Gender: ${v.gender || 'N/A'}`);
    });
  }
}

main().catch(console.error);
