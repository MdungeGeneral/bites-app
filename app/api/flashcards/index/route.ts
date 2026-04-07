import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

async function fetchJson(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function GET() {
  const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || '';
  const items: { name: string; url: string; count: number }[] = [];

  // Try R2 index first
  if (R2_PUBLIC_URL) {
    try {
      const indexUrl = `${R2_PUBLIC_URL.replace(/\/$/, '')}/flashcards/index.json`;
      const idx = await fetchJson(indexUrl);
      if (idx && typeof idx === 'object') {
        // idx may be { topic: [{name,url}, ...] } or { filename: url }
        for (const k of Object.keys(idx)) {
          const v = idx[k];
          if (Array.isArray(v)) {
            for (const it of v) {
              if (it && it.name && it.url) {
                const arr = await fetchJson(it.url);
                const count = Array.isArray(arr) ? arr.length : 0;
                items.push({ name: it.name, url: it.url, count });
              }
            }
          } else if (typeof v === 'string') {
            // idx is { filename: url }
            const arr = await fetchJson(v as string);
            const count = Array.isArray(arr) ? arr.length : 0;
            items.push({ name: k, url: v as string, count });
          }
        }
        return NextResponse.json({ items });
      }
    } catch (e) {
      // ignore and fallback
    }
  }

  // Fallback: local public/flashcards folder (recursive)
  try {
    const publicDir = path.join(process.cwd(), 'public', 'flashcards');
    if (fs.existsSync(publicDir)) {
      const walk = (dir: string) => {
        const out: { name: string; rel: string; path: string }[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const ent of entries) {
          const p = path.join(dir, ent.name);
          if (ent.isDirectory()) out.push(...walk(p));
          else if (ent.isFile() && ent.name.toLowerCase().endsWith('.json')) {
            out.push({ name: ent.name, rel: path.relative(publicDir, p), path: p });
          }
        }
        return out;
      };
      const files = walk(publicDir);
      for (const f of files) {
        try {
          const txt = fs.readFileSync(f.path, 'utf8');
          const arr = JSON.parse(txt);
          const count = Array.isArray(arr) ? arr.length : 0;
          const url = `/flashcards/${encodeURIComponent(f.rel).replace(/%2F/g, '/')}`;
          items.push({ name: f.name, url, count });
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    // ignore
  }

  return NextResponse.json({ items });
}
