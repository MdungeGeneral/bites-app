import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const countParam = url.searchParams.get('count') || '10';
  const count = Math.max(1, Math.min(50, parseInt(countParam, 10) || 10));

  // Try to fetch index from R2 public URL if configured
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
  let index: Record<string, Array<{ name: string; url: string }>> = {};

  // Helper to fetch JSON via http(s)
  async function fetchJsonUrl(u: string) {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  // 1) Try R2 index
  if (R2_PUBLIC_URL) {
    try {
      const indexUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/flashcards/index.json`;
      const data = await fetchJsonUrl(indexUrl);
      if (data && typeof data === 'object') {
        index = data as typeof index;
      }
    } catch (e) {
      // ignore and fallback
      console.warn('R2 index fetch failed, falling back to local index', e);
    }
  }

  // 2) Fallback to local public/flashcards directory
  if (!Object.keys(index).length) {
    const publicDir = path.join(process.cwd(), 'public', 'flashcards');
    try {
      const files = fs.readdirSync(publicDir).filter((f) => f.endsWith('.json'));
      for (const f of files) {
        const topic = f.replace(/\.json$/i, '');
        const p = path.join(publicDir, f);
        try {
          const arr = JSON.parse(fs.readFileSync(p, 'utf8'));
          // each file is an array of {question, answer}
          index[topic] = [
            {
              name: f,
              url: `/flashcards/${f}`,
            },
          ];
        } catch (e) {
          // skip
        }
      }
    } catch (e) {
      console.error('Failed to read public flashcards', e);
    }
  }

  // Build list of available file entries
  const fileEntries: Array<{ topic: string; name: string; url: string }> = [];
  for (const topic of Object.keys(index)) {
    for (const item of index[topic]) {
      fileEntries.push({ topic, name: item.name, url: item.url });
    }
  }

  // Helper to pick random element
  function sample(arr: any[]) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  const results: Array<{ question: string; answer: string; source: string }> = [];

  if (fileEntries.length === 0) {
    return new Response(JSON.stringify({ error: 'no flashcards available' }), { status: 404 });
  }

  // Randomly select 'count' files and pick a random card from each
  const chosen = [];
  for (let i = 0; i < count; i++) {
    chosen.push(sample(fileEntries));
  }

  for (const entry of chosen) {
    try {
      let content;
      if (entry.url.startsWith('http')) {
        content = await fetchJsonUrl(entry.url);
      } else {
        // local path under public
        const p = path.join(process.cwd(), 'public', entry.url.replace(/^\//, ''));
        content = JSON.parse(fs.readFileSync(p, 'utf8'));
      }

      if (Array.isArray(content) && content.length > 0) {
        const card = sample(content);
        if (card && (card.question || card.Q || card.front)) {
          const question = card.question || card.Q || card.front || '';
          const answer = card.answer || card.A || card.back || '';
          results.push({ question, answer, source: entry.name });
        }
      }
    } catch (e) {
      // skip failures
      console.warn('Failed to load', entry.url, e);
    }
  }

  return new Response(JSON.stringify({ cards: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
