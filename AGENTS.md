---
name: bites-app
description: TikTok-style educational video platform with flashcards and reactions
deployment: Vercel
repository: https://github.com/MdungeGeneral/bites-app
---

# AGENTS.md - Developer Guide for AI Agents

Welcome! This file is your map to the bites-app codebase. Read this before working on any issue.

---

## 🎯 Project Overview

**bites-app** is a TikTok-style educational video platform built with Next.js. Users swipe through:
- **Short-form educational videos** (MP4 files organized by topic/notebook)
- **Flashcards** (Q&A pairs) integrated into the video feed
- **Like/dislike reactions** tracked via Upstash Redis

The app is deployed on **Vercel** and uses **Cloudflare R2** for video/flashcard storage.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15.2.4 (App Router, React 19, TypeScript)
- **Styling**: Tailwind CSS
- **Video Player**: Swiper.js (touch gestures, vertical scrolling)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Database**: Upstash Redis (reactions/analytics)
- **Deployment**: Vercel
- **Content Generation**: Python scripts (flashcard_pipeline.py)

---

## 📂 File Structure

```
bites-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── flashcards/           # Flashcard serving APIs
│   │   │   ├── route.ts          # GET /api/flashcards (random cards)
│   │   │   └── index/route.ts    # GET /api/flashcards/index (list files)
│   │   ├── reactions/route.ts    # POST /api/reactions (like/dislike)
│   │   ├── videos/route.ts       # GET /api/videos (list all videos)
│   │   └── admin/disliked/route.ts # Admin endpoint for disliked content
│   ├── components/               # React components
│   │   ├── Flashcard.tsx         # Flip card UI (handles Q/A rendering)
│   │   ├── ShortsPlayer.tsx      # Video player (Swiper, autoplay, reactions)
│   │   └── HomeGrid.tsx          # Landing page grid of notebooks
│   ├── watch/[notebook]/page.tsx # Video player page for a specific notebook
│   ├── admin/report/page.tsx     # Admin dashboard
│   └── page.tsx                  # Home page
├── lib/
│   └── getVideos.ts              # Core logic for fetching videos/notebooks from R2 or local disk
├── public/
│   ├── videos/                   # Local videos (dev only, fallback if R2 not configured)
│   │   └── [notebook-name]/      # e.g., "Chapter 1-Life Insurance"
│   │       └── *.mp4
│   └── flashcards/               # Flashcard JSON files
│       ├── index.json            # Index of all flashcard files (topic -> files mapping)
│       └── *.json                # Individual flashcard files (arrays of {question, answer})
├── scripts/                      # Utility scripts
├── flashcard_pipeline.py         # Python script to generate flashcards from source notes
├── .env.local                    # Environment variables (R2, Redis, OpenAI)
├── .env.example                  # Template for env vars
└── package.json                  # Dependencies
```

---

## 🔑 Key Concepts

### 1. Videos

**Source:** Videos are stored in Cloudflare R2 or local `public/videos/` (dev fallback).

**Structure:**
- Organized by "notebook" (topic/chapter)
- Each notebook has multiple videos
- Example: `R2://Life Insurance Concepts/intro.mp4`

**Fetching:** `lib/getVideos.ts`
- `getVideos()` → returns array of Video objects
- `getNotebooks()` → returns array of Notebook objects (aggregates videos by topic)
- Caches R2 listings for 1 hour (`unstable_cache`)

**Display:**
- Home page (`app/page.tsx`) shows notebook grid
- Video player (`app/watch/[notebook]/page.tsx`) renders Swiper carousel

---

### 2. Flashcards

**Source:** JSON files in `public/flashcards/` or R2 `/flashcards/` folder.

**Schema (each file is an array):**
```json
[
  { "question": "What is term life insurance?", "answer": "Coverage for a fixed period..." },
  { "question": "...", "answer": "..." }
]
```

**Index file** (`public/flashcards/index.json`):
```json
{
  "Chapter 1": [
    { "name": "Chapter 1-Life Insurance Products.json", "url": "/flashcards/Chapter 1-Life Insurance Products.json" }
  ]
}
```

**API:**
- `GET /api/flashcards?count=10` → returns 10 random flashcards
- `GET /api/flashcards/index` → returns index.json

**Rendering:** `app/components/Flashcard.tsx`
- Flip animation (CSS 3D transform)
- Parses bullets (`+` or `-` markers) into lists
- Handles multi-paragraph answers

**Generation:** `flashcard_pipeline.py` (Python script, uses OpenAI API)

---

### 3. Reactions (Likes/Dislikes)

**Storage:** Upstash Redis (KV store)

**Keys:**
- `video:{videoId}:likes` → count
- `video:{videoId}:dislikes` → count

**API:** `POST /api/reactions`
- Body: `{ videoId: string, action: "like" | "dislike" | "remove-like" | "remove-dislike" }`
- Returns: updated counts

**Client-side:**
- `app/components/ShortsPlayer.tsx` → `handleReact` callback
- Optimistic updates (local state synced immediately, then API call)
- Persists user's own votes to localStorage: `bites-reactions`

---

## 🌍 Environment Variables

All sensitive credentials are in `.env.local` (NOT committed to git).

**Required variables:**

```bash
# Cloudflare R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=bites-app-videos
R2_PUBLIC_URL=https://pub-xxx.r2.dev

# Upstash Redis (reactions)
KV_REST_API_TOKEN=...
KV_REST_API_URL=https://xxx.upstash.io
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379

# OpenAI (flashcard generation only, not required for app runtime)
OPENAI_API_KEY=sk-proj-...
```

**Vercel deployment:**
- Set these as environment variables in Vercel dashboard
- Missing env vars cause build failures (especially R2 keys)

---

## 🏗️ Common Workflows

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in credentials

3. Run dev server:
   ```bash
   npm run dev
   ```
   Opens at http://localhost:3000

4. **Local videos (optional):**
   - Create `public/videos/[topic-name]/` folders
   - Add `.mp4` files
   - App auto-detects and serves them

### Production Build

```bash
npm run build
```

**Common build errors:**
- Missing env vars (R2 keys) → check `.env.local` or Vercel env settings
- TypeScript errors → run `npm run build` locally first
- Flashcard JSON parsing errors → validate all `.json` files in `public/flashcards/`

### Testing

**No test suite exists yet.** When adding tests:
- Unit tests → Jest/Vitest
- E2E tests → Playwright/Cypress
- Test files → `*.test.ts` or `__tests__/` folders

---

## 📝 Flashcard Bullet Parsing

**Current logic** (`app/components/Flashcard.tsx`):

Flashcard answers support bullets via `+` or `-` markers:

**Input:**
```
This is a paragraph.

+ First bullet
+ Second bullet
- Third bullet
```

**Normalization:**
1. Replace `\+` → `+` (escaped bullets become literal)
2. Replace ` +` → `\n+` (space-before-bullet becomes newline)
3. Split by `\n`, parse bullets into `<ul>` lists

**Known edge cases:**
- Mid-line bullets (`"text +item"`) may not parse correctly
- Mixed `-` and `+` bullets should both work

---

## 🎨 Styling Notes

- **Tailwind classes** are used throughout (no custom CSS files)
- **Dark mode:** Not implemented (all UI is light mode)
- **Responsive:**
  - Mobile-first (designed for vertical swipe)
  - Desktop works but is secondary

---

## 🚀 Deployment

**Platform:** Vercel

**Deployment workflow:**
1. Push to `main` branch → auto-deploys to production
2. PR previews available for all branches

**Production URL:** (check Vercel dashboard or repo settings)

**Build configuration:**
- Next.js auto-detects settings
- No custom `vercel.json` (uses defaults)

---

## 🐛 Debugging

### Videos not loading

1. Check R2 env vars in `.env.local`
2. Verify R2 bucket has "Public Access" enabled
3. Check browser console for CORS errors
4. Try local videos (create `public/videos/Test/video.mp4`)

### Flashcards not loading

1. Check `public/flashcards/` folder exists
2. Validate JSON syntax (run through `jq` or JSON validator)
3. Check API logs: `GET /api/flashcards`

### Reactions not working

1. Check Upstash Redis env vars (`REDIS_URL`)
2. Test API manually: `curl -X POST /api/reactions -d '{"videoId":"test","action":"like"}'`
3. Check browser localStorage for saved reactions

---

## 📚 Additional Resources

- **Next.js Docs:** https://nextjs.org/docs
- **Swiper Docs:** https://swiperjs.com/react
- **Cloudflare R2 Docs:** https://developers.cloudflare.com/r2
- **Upstash Redis Docs:** https://docs.upstash.com/redis

---

## ✅ Before You Start

1. **Read this file fully** — understand the file structure and key concepts
2. **Read the GitHub issue** — your specific task is described there
3. **Check `.env.local`** — ensure credentials are present
4. **Run `npm run build` locally** — verify the app builds before making changes
5. **Test your changes** — run the dev server and verify visually

Good luck! 🚀
