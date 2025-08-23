import axios from "axios";
import { log } from "../utils/logger";
import { Episode, Track } from "../db/entities";
import { AppDataSource } from "../db/database";
import { delay } from "../utils/rateLimiter";
import pRetry from "p-retry";

export async function scrapeEpisode(pid: string, showId?: string): Promise<{ scraped: boolean, tracks: number }> {
  const repo = AppDataSource.getRepository(Episode);
  const exists = await repo.findOneBy({ id: pid });
  if (exists) {
    log(`Episode ${pid} already exists, skipping.`);
    return { scraped: false, tracks: 0 };
  }
  await delay(3000); // Respectful throttling: 1 request every 3s

  const url = `https://www.bbc.co.uk/sounds/play/${pid}`;
  log(`Fetching episode: ${pid}`);

  let trackCount = 0;
  await pRetry(async () => {
    const { data } = await axios.get(url);
    const preloadMatch = data.match(
      /window\.__PRELOADED_STATE__\s*=\s*({.*?});\s*</s
    );

    if (!preloadMatch || !preloadMatch[1]) {
      throw new Error(`PRELOADED_STATE not found for ${pid}`);
    }

    const json = JSON.parse(preloadMatch[1]);
    const episodeModule = json.modules?.data?.find(
      (mod: any) => mod.id === "aod_play_area"
    );
    const tracklistModule = json.modules?.data?.find(
      (mod: any) =>
        mod.title?.toLowerCase() === "tracklist" &&
        mod.id === "aod_tracks"
    );

    if (!episodeModule || !tracklistModule) {
      throw new Error(`Modules not found for ${pid}`);
    }

    const episode = new Episode();
    episode.id = pid;
    episode.showId = showId || "m0002nly";
    episode.title = episodeModule.data[0]?.titles?.primary;
    episode.summary = episodeModule.data[0]?.titles?.secondary || "";
    episode.airDate = episodeModule.data[0]?.release?.date;
    episode.tracks = [];

    tracklistModule.data.forEach((trackItem: any) => {
      const track = new Track();
      track.id = trackItem.id;
      track.episode_id = pid;
      track.artist = trackItem.titles?.primary;
      track.title = trackItem.titles?.secondary;
      track.url = trackItem.uris?.[0]?.uri || null;
      episode.tracks.push(track);
    });
    trackCount = episode.tracks.length;
    await repo.save(episode);
    log(`Saved episode ${episode.title} with ${episode.tracks.length} tracks.`);
  }, { retries: 3 });
  return { scraped: true, tracks: trackCount };
}
