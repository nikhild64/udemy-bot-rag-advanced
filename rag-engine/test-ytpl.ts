import ytpl from 'ytpl';

async function run() {
  try {
    const playlist = await ytpl('PLBCF2DAC6FFB574DE'); // standard test playlist
    console.log(`Success! Found ${playlist.items.length} items.`);
    console.log(playlist.items[0].title);
  } catch (err) {
    console.error('Failed:', err);
  }
}
run();
