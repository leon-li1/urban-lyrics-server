import * as express from "express";
import * as puppeteer from "puppeteer";
import * as bodyParser from "body-parser";
import * as cors from "cors";
import axios from "axios";
import { getLyrics, getSongById } from "genius-lyrics-api";

let globalBrowser: puppeteer.Browser;

const app = express();
app.use(cors());
app.use(bodyParser.json()); // parse body from string to json

type ScrapeRequest = Express.Request & {
  body: {
    title: string;
  };
};

// Make sure the scrape request is valid
function isValidScrapeRequest(req: any): req is ScrapeRequest {
  return typeof req?.body?.title === "string";
}

// the request needs to contain a youtube video (song) title
app.post("/songdata", async function (req, res) {
  if (!isValidScrapeRequest(req))
    return res.status(400).json({ error: "Invalid request" });

  const title = req.body.title;
  try {
    const lyrics = await scrapeLyrics(title);
    res.status(200).json(lyrics);
  } catch (err) {
    res.status(500).json({ error: err.toString() });
  }
});

type LyricResult = {
  lyrics: string;
  songTitle: string;
  artist: string;
  geniusUrl: string;
};

async function scrapeLyrics(title: string): Promise<LyricResult> {
  try {
    const res = await axios.get(
      `${process.env.API_URL}${encodeURIComponent(title)}`,
      {
        headers: {
          Authorization: `BEARER ${process.env.GENIUS_TOKEN}`,
        },
      }
    );
    if (!res.data.response.hits) throw new Error("Song could not be found");
    const data = res.data.response.hits[0].result;
    const lyrics = await getLyrics(data.url);
    const lyricResult = {
      lyrics: lyrics,
      songTitle: data.title_with_featured,
      artist: data.primary_artist.name,
      geniusUrl: data.url,
    };
    return lyricResult;
  } catch (err) {
    console.error(`Error fetching lyrics: ${err?.response?.data?.error}`);
    throw err; // maybe don't throw
  }
}

const blockedUrls = [
  "ping.chartbeat.net",
  "librato-collector.genius.com",
  "api.mixpanel.com",
  "is1-ssl.mzstatic.com",
  "www.youtube.com",
  "connect.facebook.net",
  "sessions.bugsnag.com",
  "stats.g.doubleclick.net",
  "pixel.quantserve.com",
  "loadus.exelator.com",
  "api-js.mixpanel.com",
  "stats.pusher.com",
  "js-cdn.music.apple.com",
  "cds.taboola.com",
  "dialog.filepicker.io",
  "sb.scorecardresearch.com",
  "www.filepicker.io",
  "cdn.mxpnl.com",
  "trc.taboola.com",
  "www.google-analytics.com",
  "audio-ssl.itunes.apple.com",
  "secure.quantserve.com",
  "ws.pusherapp.com",
  "t2.genius.com",
  "cdn.taboola.com",
  "static.chartbeat.com",
  "pubmatic.com",
  "adsymptotic.com",
  "adsby.bidtheatre.com",
  "s.amazon-adsystem.com",
  "simpli.fi",
  "tapad.com",
  "googlesyndication.com",
  "gumgum.com",
];

app.listen(process.env.PORT || 8000, async function () {
  console.log("Server started.");
  globalBrowser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
});
