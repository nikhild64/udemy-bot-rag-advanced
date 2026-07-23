import { Innertube } from 'youtubei.js';
import util from 'util';

async function run() {
  try {
    const yt = await Innertube.create();
    const playlist = await yt.getPlaylist('PLBCF2DAC6FFB574DE'); 
    console.log(`Success! Found ${playlist.items.length} items.`);
    if (playlist.items.length > 0) {
        console.log(util.inspect(playlist.items[0], { depth: 2 }));
    }
  } catch (err) {
    console.error('Failed:', err);
  }
}
run();
