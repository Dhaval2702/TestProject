# HeyGen Data-Feed Avatar

A text-to-speech **human avatar** that naturally narrates data pulled from your
API, built on [HeyGen](https://www.heygen.com/).

There are two ways to do this with HeyGen — this starter implements both:

| | Path 1: Video Generation API | Path 2: LiveAvatar (real-time) |
|---|---|---|
| What you get | A rendered MP4 of the avatar speaking your data | A live, low-latency WebRTC avatar that speaks on command |
| Latency | 1–3 min render per video | Speaks within ~1 second |
| Best for | Daily/weekly report videos, embeddable summaries | Dashboards, assistants, "live anchor" experiences |
| Cost | Per video minute | Per streaming minute |

> **Note:** HeyGen's older "Interactive Avatar" / `@heygen/streaming-avatar`
> SDK was **sunset on March 31, 2026**. For real-time avatars use
> **LiveAvatar** (`@heygen/liveavatar-web-sdk`, [docs.liveavatar.com](https://docs.liveavatar.com)).

## Setup

1. **Get an API key** — sign in at [app.heygen.com](https://app.heygen.com) →
   *Settings → Subscriptions & API → API token*. API access requires a paid
   (Creator/Team/Enterprise or API) plan; a free trial token has limited credits.
2. **Configure**
   ```bash
   cp .env.example .env   # then fill in HEYGEN_API_KEY and DATA_API_URL
   npm install
   npm start
   ```
3. **Pick an avatar & voice** — open `http://localhost:3000/api/avatars` and
   `/api/voices`, choose an `avatar_id` and `voice_id` you like, and put them
   in `.env`.
4. **Run it** — open `http://localhost:3000` and click **Narrate latest data**.
   The server fetches `DATA_API_URL`, converts the JSON into a spoken script
   (`buildScript()` in `server.js` — customize this for your feed), submits it
   to `POST /v2/video/generate`, polls `GET /v1/video_status.get`, and plays
   the finished video.

## How the data → speech pipeline works

```
your API  ──▶  buildScript()  ──▶  HeyGen TTS + avatar  ──▶  video / live stream
 (JSON)        natural-language      lip-synced human
               narration             presenter
```

`buildScript()` currently produces a generic narration from any JSON. For a
truly *natural* delivery, replace it with either:

- a **template** tailored to your feed ("Sales today reached **$X**, up **Y%**
  from yesterday…"), or
- an **LLM call** (e.g. Claude) that turns the raw JSON into a conversational
  script — best results for varied or nested data.

## Going real-time (LiveAvatar)

For an avatar that reacts live (e.g. narrates every data refresh on a
dashboard):

1. The server already exposes `POST /api/realtime/token`, which mints a
   short-lived session token via `POST https://api.liveavatar.com/v1/sessions/token`
   (keeps your API key off the client).
2. In your frontend, install the SDK and start a session:
   ```bash
   npm install @heygen/liveavatar-web-sdk
   ```
   Use **LITE mode** since your speech comes from your own data pipeline —
   HeyGen handles only avatar rendering/streaming, and you push text for the
   avatar to speak each time your feed updates. (FULL mode instead gives you a
   built-in ASR + LLM + TTS conversational stack.)
3. On every data refresh: fetch feed → build script → send it to the session's
   speak/task endpoint. See the [LiveAvatar docs](https://docs.liveavatar.com)
   for the exact SDK calls.

## Production notes

- **Webhooks over polling** — register a webhook for `avatar_video.success`
  in HeyGen so you're notified when renders complete.
- **Keep the API key server-side** — never call HeyGen directly from the
  browser with your key.
- **Schedule it** — a cron job hitting `POST /api/narrate` gives you an
  automated daily "data anchor" video.
