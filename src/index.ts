import * as express from "express";
import * as puppeteer from "puppeteer";
import * as bodyParser from "body-parser";
import * as cors from "cors";

let globalBrowser: puppeteer.Browser;

// create the server object
const app = express();
// .use() will run the given middleware on every request
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
app.post("/scrape", async function (req, res) {
  if (!isValidScrapeRequest(req)) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const {
    body: { title },
  } = req;
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
  // 1. search google.com
  // 2. click on the first link
  // 3. grab the lyrics from the newly loaded page

  const page = await globalBrowser.newPage();
  try {
    await page.setRequestInterception(true);
    let skippedResources = blockedUrls;
    // listen for the request event
    page.on("request", (request) => {
      if (
        !["document", "script", "xhr", "other"].includes(request.resourceType())
      ) {
        request.abort();
        return;
      }
      // mywebsite.com/page?q=google.com => mywebsite.com/page and mywebsite.com/page# => mywebsite.com/page
      const requestUrl: string = (request as any)._url
        .split("?")[0]
        .split("#")[0];
      // Example: requestUrl = mywebsite.com/page, resource = mywebsite.com
      if (
        skippedResources.some((resource) => requestUrl.indexOf(resource) !== -1)
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // %20 = space, %26 = &
    const searchTerm = encodeURIComponent(`${title} lyrics site:genius.com`);
    const googleSearchURL = `https://google.com/search?hl=en&q=${searchTerm}`;

    //hl = host language
    await page.goto(googleSearchURL);

    const firstLink = await page.waitForXPath(
      '//*[@id="rso"]/div[1]/div/div[1]/a', // <-- concerning (test it thoroughly)
      {
        timeout: 10000,
      }
    ); // <a></a> <-- anchor tag
    const geniusUrl = await firstLink.evaluate(
      (a: HTMLAnchorElement) => a.href
    );
    await firstLink.click();
    const lyrics = await (
      await page.waitForXPath("//*[contains(@class,'Lyrics__Root')]|//section")
    ).evaluate((p: any) => p.innerText);
    const songTitle = await (
      await page.waitForXPath("//h1[contains(@class, 'itle')]")
    ).evaluate((p: any) => p.innerText);
    const artist = await (
      await page.waitForXPath(
        "//a[contains(@href,'https://genius.com/artists/') and contains(@class, 'rtist')]"
      )
    )
      // runs the function on the element IN THE PUPPETEER BROWSER (not node.js)
      .evaluate((p: any) => p.innerText);
    return {
      lyrics,
      songTitle,
      artist,
      geniusUrl,
    };
  } finally {
    page.close();
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

// say we run this from this ip address: 333.333.3.3, then it will be accessible from http://333.333.3.3:8000
// say we have a website domain on 333.333.3.3 called leonswebsite.com with port redirection 8000 -> 80
// then it will be accessible from http://leonswebsite.com
app.listen(8000, async function () {
  console.log("Server started.");
  globalBrowser = await puppeteer.launch({
    headless: false,
    args: ["--no-sandbox"],
  });
});
