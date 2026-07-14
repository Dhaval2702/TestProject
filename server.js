// HeyGen data-narrating avatar — starter server.
//
// Two integration paths are exposed:
//   1. Pre-rendered video  : POST /api/narrate  -> HeyGen v2 Video Generation API
//   2. Real-time streaming : POST /api/realtime/token -> LiveAvatar session token
//      (LiveAvatar replaced HeyGen's Interactive Avatar, which was sunset 2026-03-31)
//
// Docs: https://docs.heygen.com  and  https://docs.liveavatar.com

import express from "express";
import "dotenv/config";

const {
  HEYGEN_API_KEY,
  DATA_API_URL,
  HEYGEN_AVATAR_ID = "30973494479f4bbd944026f2fbb981c4",
  HEYGEN_VOICE_ID = "330290724a1b470fb63153f34d4c0183",
  PORT = 3000,
} = process.env;

const HEYGEN_API = "https://api.heygen.com";
const LIVEAVATAR_API = "https://api.liveavatar.com";

const app = express();
app.use(express.json());
app.use(express.static("public"));

// ---------------------------------------------------------------------------
// Step A: pull data from YOUR API and turn it into a natural spoken script.
// Replace buildScript() with whatever narrative fits your feed's shape.
// ---------------------------------------------------------------------------
async function fetchFeed() {
  const res = await fetch(DATA_API_URL);
  if (!res.ok) throw new Error(`Data API returned ${res.status}`);
  return res.json();
}

function buildScript(data) {
  // Naive generic narration: works for any flat JSON object or array.
  // Swap this for a template (or an LLM call) that matches your data.
  if (Array.isArray(data)) {
    const items = data
      .slice(0, 5)
      .map((item, i) => `Item ${i + 1}: ${summarize(item)}`)
      .join(". ");
    return `Here is the latest update from your data feed. ${items}. That covers the top ${Math.min(data.length, 5)} items.`;
  }
  return `Here is the latest update from your data feed. ${summarize(data)}.`;
}

function summarize(obj) {
  if (obj === null || typeof obj !== "object") return String(obj);
  return Object.entries(obj)
    .filter(([, v]) => typeof v !== "object")
    .slice(0, 6)
    .map(([k, v]) => `${k.replace(/[_-]/g, " ")} is ${v}`)
    .join(", ");
}

// ---------------------------------------------------------------------------
// Path 1 — pre-rendered avatar video (HeyGen v2 Video Generation API)
// ---------------------------------------------------------------------------

// Kick off a video: fetches your feed, builds the script, submits the render.
app.post("/api/narrate", async (req, res) => {
  try {
    const data = req.body && Object.keys(req.body).length ? req.body : await fetchFeed();
    const script = req.body?.script ?? buildScript(data);

    const r = await fetch(`${HEYGEN_API}/v2/video/generate`, {
      method: "POST",
      headers: { "X-Api-Key": HEYGEN_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        video_inputs: [
          {
            character: {
              type: "avatar",
              avatar_id: HEYGEN_AVATAR_ID,
              avatar_style: "normal",
            },
            voice: {
              type: "text",
              input_text: script,
              voice_id: HEYGEN_VOICE_ID,
              speed: 1.0,
            },
            background: { type: "color", value: "#f6f6fc" },
          },
        ],
        dimension: { width: 1280, height: 720 },
      }),
    });
    const body = await r.json();
    if (!r.ok || body.error) {
      return res.status(502).json({ error: body.error ?? body });
    }
    res.json({ video_id: body.data.video_id, script });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Poll render status; returns video_url when completed.
app.get("/api/narrate/:videoId", async (req, res) => {
  try {
    const r = await fetch(
      `${HEYGEN_API}/v1/video_status.get?video_id=${encodeURIComponent(req.params.videoId)}`,
      { headers: { "X-Api-Key": HEYGEN_API_KEY } }
    );
    const body = await r.json();
    res.status(r.ok ? 200 : 502).json(body.data ?? body);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ---------------------------------------------------------------------------
// Path 2 — real-time streaming avatar (LiveAvatar)
// The browser SDK (@heygen/liveavatar-web-sdk) needs a short-lived session
// token; mint it server-side so your API key never reaches the client.
// ---------------------------------------------------------------------------
app.post("/api/realtime/token", async (_req, res) => {
  try {
    const r = await fetch(`${LIVEAVATAR_API}/v1/sessions/token`, {
      method: "POST",
      headers: { "X-API-KEY": HEYGEN_API_KEY, "Content-Type": "application/json" },
    });
    const body = await r.json();
    res.status(r.ok ? 200 : 502).json(body);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Helpers to pick an avatar/voice without leaving the app.
app.get("/api/avatars", async (_req, res) => {
  const r = await fetch(`${HEYGEN_API}/v2/avatars`, {
    headers: { "X-Api-Key": HEYGEN_API_KEY },
  });
  res.status(r.status).json(await r.json());
});

app.get("/api/voices", async (_req, res) => {
  const r = await fetch(`${HEYGEN_API}/v2/voices`, {
    headers: { "X-Api-Key": HEYGEN_API_KEY },
  });
  res.status(r.status).json(await r.json());
});

app.listen(PORT, () => {
  console.log(`Avatar server running on http://localhost:${PORT}`);
  if (!HEYGEN_API_KEY) console.warn("WARNING: HEYGEN_API_KEY is not set — copy .env.example to .env");
});
