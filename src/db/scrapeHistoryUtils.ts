import { AppDataSource } from "./database";
import { ScrapeHistory } from "./scrapeHistory";

export async function updateScrapeHistory(showId: string, tracksScraped: number) {
  const repo = AppDataSource.getRepository(ScrapeHistory);
  let record = await repo.findOneBy({ showId });
  if (!record) {
    record = repo.create({ showId, lastScraped: new Date(), tracksScraped });
  } else {
    record.lastScraped = new Date();
    record.tracksScraped = tracksScraped;
  }
  await repo.save(record);
}

export async function getScrapeHistory() {
  const repo = AppDataSource.getRepository(ScrapeHistory);
  return repo.find();
}
