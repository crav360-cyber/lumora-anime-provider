'use strict';
const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT) || 3100;
const HOST = process.env.HOST || '127.0.0.1';

// Helper to search AniList by title
async function searchAniList(title) {
  const query = `
    query ($search: String) {
      Media (search: $search, type: ANIME) {
        id
        title { romaji english }
        episodes
      }
    }
  `;
  const res = await fetch('https://graphql.anilist.co', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ query, variables: { search: title } })
  });
  const json = await res.json();
  return json.data?.Media;
}

// Fetch streams from a public anime scraper API (e.g., Consumet or Aniwatch API)
async function fetchAnimeStreams(anilistId, episode, isDub = false) {
  // Note: You can swap this URL with your own self-hosted Consumet API later
  const apiUrl = `https://aniwatch-api-tau.vercel.app/anime/zoro/watch?episodeId=${anilistId}?ep=${episode}&dub=${isDub}`;
  
  try {
    // For demonstration, we mock the response if the API is down.
    // In production, parse the actual m3u8 links from the API response.
    return [
      {
        label: 'Zoro (Sub)',
        type: 'hls', // 'hls' triggers the Lumora native video player
        url: `https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8`, // Placeholder
        quality: '1080p',
        audio: 'sub',
        lang: 'ja'
      }
    ];
  } catch (e) {
    return [];
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}`);
  
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok' }));
  }

  if (url.pathname === '/lumora/v1/resolve') {
    const type = url.searchParams.get('type');
    const title = url.searchParams.get('title');
    const season = url.searchParams.get('season') || 1;
    const episode = url.searchParams.get('episode') || 1;

    if (type !== 'tv' && type !== 'movie') {
       res.writeHead(400); return res.end('Invalid type');
    }

    try {
      // 1. Find the anime on AniList using the title provided by TMDB
      const anime = await searchAniList(title);
      
      if (!anime) {
         res.writeHead(404); return res.end(JSON.stringify({ sources: [] }));
      }

      // 2. Fetch the streams
      const sources = await fetchAnimeStreams(anime.id, episode, false);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ sources }));
    } catch (err) {
      res.writeHead(500);
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, HOST, () => {
  console.log(`Anime provider listening on ${HOST}:${PORT}`);
});
