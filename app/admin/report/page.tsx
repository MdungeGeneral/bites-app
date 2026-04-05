"use client";

import { useEffect, useState } from "react";

interface DislikedVideo {
  id: string;
  key: string;
  notebook: string;
  title: string;
  url: string;
  likes: number;
  dislikes: number;
}

type SortKey = "dislikes" | "notebook" | "title";

export default function DislikedReport() {
  const [videos, setVideos] = useState<DislikedVideo[] | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("dislikes");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/disliked")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<DislikedVideo[]>;
      })
      .then(setVideos)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load")
      );
  }, []);

  function sorted(list: DislikedVideo[]) {
    return [...list].sort((a, b) => {
      if (sortBy === "dislikes") return b.dislikes - a.dislikes || a.notebook.localeCompare(b.notebook);
      if (sortBy === "notebook") return a.notebook.localeCompare(b.notebook) || b.dislikes - a.dislikes;
      return a.title.localeCompare(b.title);
    });
  }

  function copyList() {
    if (!videos) return;
    const text = sorted(videos)
      .map((v) => v.key)
      .join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const displayed = videos ? sorted(videos) : [];

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-xl font-semibold mb-1">Disliked Videos</h1>
        <p className="text-zinc-500 text-sm mb-6">
          Videos with at least one dislike — candidates for re-generation.
        </p>

        {error && (
          <p className="text-red-400 text-sm mb-4">Error: {error}</p>
        )}

        {videos === null && !error && (
          <p className="text-zinc-500 text-sm">Loading…</p>
        )}

        {videos !== null && videos.length === 0 && (
          <p className="text-zinc-400 text-sm">No dislikes recorded yet 🎉</p>
        )}

        {videos !== null && videos.length > 0 && (
          <>
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-zinc-400 text-sm">
                {videos.length} video{videos.length !== 1 ? "s" : ""}
              </span>

              <div className="flex items-center gap-1 text-sm text-zinc-400">
                <span>Sort:</span>
                {(["dislikes", "notebook", "title"] as SortKey[]).map((k) => (
                  <button
                    key={k}
                    onClick={() => setSortBy(k)}
                    className={`px-2 py-0.5 rounded transition-colors ${
                      sortBy === k
                        ? "bg-zinc-700 text-white"
                        : "hover:bg-zinc-800"
                    }`}
                  >
                    {k}
                  </button>
                ))}
              </div>

              <button
                onClick={copyList}
                className="ml-auto px-3 py-1 text-sm rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
              >
                {copied ? "Copied ✓" : "Copy file list"}
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded border border-zinc-800">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-500 text-left bg-zinc-950">
                    <th className="px-3 py-2 font-normal">Notebook</th>
                    <th className="px-3 py-2 font-normal">Title</th>
                    <th className="px-3 py-2 font-normal text-center">👎</th>
                    <th className="px-3 py-2 font-normal text-center">👍</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((v) => (
                    <tr
                      key={v.id}
                      className="border-b border-zinc-900 hover:bg-zinc-900/60 transition-colors"
                    >
                      <td className="px-3 py-2 text-zinc-400 whitespace-nowrap">
                        {v.notebook}
                      </td>
                      <td className="px-3 py-2">{v.title}</td>
                      <td className="px-3 py-2 text-center text-red-400 font-mono">
                        {v.dislikes}
                      </td>
                      <td className="px-3 py-2 text-center text-emerald-400 font-mono">
                        {v.likes}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Copyable list preview */}
            <details className="mt-6">
              <summary className="text-zinc-500 text-sm cursor-pointer hover:text-zinc-300 transition-colors">
                Show file list (for pipeline re-generation)
              </summary>
              <pre className="mt-2 p-3 rounded bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 overflow-x-auto whitespace-pre-wrap">
                {displayed.map((v) => v.key).join("\n")}
              </pre>
            </details>
          </>
        )}
      </div>
    </main>
  );
}
