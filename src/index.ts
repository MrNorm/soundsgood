import { Command } from "commander";
import { initDatabase, AppDataSource } from "./db/database";
import { getEpisodePIDs } from "./scraper/episodeList";
import { scrapeEpisode } from "./scraper/episodeScraper";
import { log } from "./utils/logger";
import { Episode, Track } from "./db/entities";
import { ScrapeHistory } from "./db/scrapeHistory";
import { updateScrapeHistory, getScrapeHistory } from "./db/scrapeHistoryUtils";

const program = new Command();

program
  .name("bbc-track-scraper")
  .description("Scrapes BBC Sounds episode tracklists")
  .version("1.0.0");

program
  .command("scrape [show-id]")
  .description("Scrape all available episodes not in DB for a given show-id (default: m0002nly)")
  .action(async (showId?: string) => {
    await initDatabase();
    const pids = await getEpisodePIDs(showId);
    let episodesScraped = 0;
    let tracksScraped = 0;
    for (const pid of pids) {
      const result = await scrapeEpisode(pid, showId);
      if (result && result.scraped) {
        episodesScraped++;
        tracksScraped += result.tracks;
      }
    }
    // Update scrape history
    await updateScrapeHistory(showId || "m0002nly", tracksScraped);
    // Query total counts in DB
    const episodeRepo = AppDataSource.getRepository(Episode);
    const trackRepo = AppDataSource.getRepository(Track);
    const totalEpisodes = await episodeRepo.count();
    const totalTracks = await trackRepo.count();
    // Print summary
    console.log("\n--- Scrape Summary ---");
    console.log(`Episodes in DB: ${totalEpisodes}`);
    console.log(`Tracks in DB:   ${totalTracks}`);
    console.log(`Episodes scraped this run: ${episodesScraped}`);
    console.log(`Tracks scraped this run:   ${tracksScraped}`);
    // Show scrape history if no show-id
    if (!showId) {
      const history = await getScrapeHistory();
      console.log("\n--- Scrape History ---");
      history.forEach(h => {
        console.log(`Show ID: ${h.showId} | Last Scraped: ${h.lastScraped} | Tracks Scraped: ${h.tracksScraped}`);
      });
    }
    process.exit(0);
  });

program
  .command("show-episode [pid]")
  .description("Show the tracklist for an episode, or all episodes if no pid is given")
  .action(async (pid?: string) => {
    await initDatabase();
    const repo = AppDataSource.getRepository(Episode);
    if (pid) {
      const episode = await repo.findOne({
        where: { id: pid },
        relations: { tracks: true },
      });
      if (!episode) {
        console.error("Episode not found.");
        process.exit(1);
      }
      console.log(`\n${episode.title} (${episode.airDate})`);
      console.log(`${episode.summary}`);
      console.log("\nTracklist:");
      episode.tracks.forEach((track, i) => {
        const searchTerm = encodeURIComponent(`${track.artist} - ${track.title}`);
        const traxsourceUrl = `https://www.traxsource.com/search?term=${searchTerm}`;
        console.log(`${i + 1}. ${track.artist} — ${track.title}`);
        if (track.url) console.log(`   🎵 ${track.url}`);
        console.log(`   🔎 Traxsource: ${traxsourceUrl}`);
      });
    } else {
      const episodes = await repo.find({ relations: { tracks: true } });
      if (episodes.length === 0) {
        console.log("No episodes found.");
        process.exit(0);
      }
      episodes.forEach((episode) => {
        console.log(`\n${episode.title} (${episode.airDate})`);
        console.log(`${episode.summary}`);
        console.log("\nTracklist:");
        episode.tracks.forEach((track, i) => {
          const searchTerm = encodeURIComponent(`${track.artist} - ${track.title}`);
          const traxsourceUrl = `https://www.traxsource.com/search?term=${searchTerm}`;
          console.log(`${i + 1}. ${track.artist} — ${track.title}`);
          if (track.url) console.log(`   🎵 ${track.url}`);
          console.log(`   🔎 Traxsource: ${traxsourceUrl}`);
        });
        console.log("\n-----------------------------");
      });
    }
    process.exit(0);
  });

program
  .command("search-shows <query>")
  .description("Search BBC shows by keyword and display show info")
  .action(async (query: string) => {
    const url = `https://rms.api.bbc.co.uk/v2/experience/inline/search?q=${encodeURIComponent(query)}`;
    try {
      const { data } = await require("axios").get(url);
      const showsModule = data.data.find((mod: any) => mod.title === "Shows");
      if (!showsModule || !showsModule.data) {
        console.log("No shows found for this query.");
        process.exit(0);
      }
      showsModule.data.forEach((show: any) => {
        console.log("------------------------------");
        console.log(`id: ${show.id}`);
        console.log(`network: ${show.network?.short_title || "N/A"}`);
        console.log(`title: ${show.titles?.primary}`);
        console.log(`summary: ${show.synopses?.short}`);
      });
      console.log("------------------------------");
    } catch (err) {
      if (err instanceof Error) {
        console.error("Error fetching or parsing BBC API:", err.message);
      } else {
        console.error("Error fetching or parsing BBC API:", err);
      }
      process.exit(1);
    }
    process.exit(0);
  });

program
  .command("show-history")
  .description("Show scrape history for all shows")
  .action(async () => {
    await initDatabase();
    const history = await getScrapeHistory();
    if (!history.length) {
      console.log("No scrape history found.");
    } else {
      console.log("\n--- Scrape History ---");
      history.forEach(h => {
        console.log(`Show ID: ${h.showId} | Last Scraped: ${h.lastScraped} | Tracks Scraped: ${h.tracksScraped}`);
      });
    }
    process.exit(0);
  });

program
  .command("shows")
  .description("List all shows logged in the scrape history database, with episodes")
  .action(async () => {
    await initDatabase();
    const history = await getScrapeHistory();
    const uniqueShows = Array.from(new Set(history.map(h => h.showId)));
    const episodeRepo = AppDataSource.getRepository(Episode);
    if (!uniqueShows.length) {
      console.log("No shows found in scrape history.");
    } else {
      console.log("\n--- Shows in Scrape History ---");
      for (const showId of uniqueShows) {
        // Fetch all episodes for this showId
        const episodes = await episodeRepo.find({ where: { showId } });
        // Try to get show title/summary from first episode
        let showTitle = "(unknown)";
        let showSummary = "";
        if (episodes.length > 0) {
          showTitle = episodes[0].title || "(unknown)";
          showSummary = episodes[0].summary || "";
        }
        console.log(`\nShow ID: ${showId}`);
        console.log(`Title: ${showTitle}`);
        if (showSummary) console.log(`Summary: ${showSummary}`);
        if (episodes.length === 0) {
          console.log("  No episodes found for this show.");
        } else {
          episodes.forEach(ep => {
            console.log(`  Episode ID: ${ep.id} | Date: ${ep.airDate} | Summary: ${ep.summary}`);
          });
        }
      }
    }
    process.exit(0);
  });

program.parseAsync(process.argv);
