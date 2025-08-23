import axios from "axios";
import { load } from "cheerio";
import { log } from "../utils/logger";

export async function getEpisodePIDs(showId: string = "m0002nly"): Promise<string[]> {
  const result: string[] = [];
  const BASE_URL = `https://www.bbc.co.uk/programmes/${showId}/episodes/player`;
  try {
    const response = await axios.get(BASE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ScraperBot/1.0)"
      }
    });

    if (!response || !response.data) {
      throw new Error("No data returned from BBC episodes page.");
    }

    const html: string = response.data;
    const $ = load(html);

    $(".programme").each((_, element) => {
      const pid = $(element).attr("data-pid");
      if (pid) {
        result.push(pid);
      }
    });

    log(`Found ${result.length} episodes`);
  } catch (err) {
    log(`Error fetching episode list: ${(err as Error).message}`);
    if (axios.isAxiosError(err)) {
      if (err.response) {
        log(`Status Code: ${err.response.status}`);
        log(`Response body snippet:\n${err.response.data?.toString().slice(0, 500)}...`);
      } else {
        log("No response received.");
      }
    }
  }

  return result;
}
