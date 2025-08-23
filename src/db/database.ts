import "reflect-metadata";
import { DataSource } from "typeorm";
import { Episode, Track } from "./entities";
import { ScrapeHistory } from "./scrapeHistory";

export const AppDataSource = new DataSource({
  type: "sqlite",
  database: "./bbc-episodes.sqlite",
  synchronize: true,
  logging: false,
  entities: [Episode, Track, ScrapeHistory],
  migrations: [],
  subscribers: [],
});

export async function initDatabase() {
  await AppDataSource.initialize();
}
