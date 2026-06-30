export function avatarUrl(seed: string, size = 64): string {
  // Generate a deterministic SVG identicon locally to avoid network dependencies.
  const palette = [
    "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7",
    "#14b8a6", "#f97316", "#84cc16", "#ec4899",
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  const color = palette[hash % palette.length];
  const color2 = palette[(hash >> 8) % palette.length];
  const initials = seed.slice(0, 2).toUpperCase();
  const grid: number[] = [];
  for (let i = 0; i < 25; i++) grid.push((hash >> (i % 30)) & 1);
  const cells: string[] = [];
  const cellSize = 6;
  const offsetX = 2;
  const offsetY = 12;
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < 3; x++) {
      if (grid[y * 3 + x]) {
        const cx = offsetX + x * cellSize;
        const mirrorX = offsetX + (4 - x) * cellSize;
        cells.push(`<rect x="${cx}" y="${offsetY + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="rgba(255,255,255,0.85)" />`);
        if (x !== 2) {
          cells.push(`<rect x="${mirrorX}" y="${offsetY + y * cellSize}" width="${cellSize}" height="${cellSize}" fill="rgba(255,255,255,0.85)" />`);
        }
      }
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}"><defs><linearGradient id="g${hash}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="${color2}"/></linearGradient></defs><rect width="64" height="64" rx="14" fill="url(#g${hash})"/><text x="50%" y="13" text-anchor="middle" font-family="Inter,system-ui,sans-serif" font-size="9" font-weight="700" fill="rgba(255,255,255,0.95)">${initials}</text>${cells.join("")}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(ts: number | string): string {
  const date = typeof ts === "number" ? new Date(ts) : new Date(ts);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "刚刚";
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)} 天前`;
  return date.toLocaleDateString("zh-CN");
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function truncate(text: string, len = 120): string {
  if (text.length <= len) return text;
  return text.slice(0, len).trimEnd() + "…";
}

export function chunkParagraphs(text: string, max = 80): string[] {
  const clean = text.replace(/\s+\n/g, "\n").trim();
  // split by double newlines first
  const paragraphs = clean.split(/\n{2,}/);
  const out: string[] = [];
  for (const p of paragraphs) {
    if (p.length <= max) {
      out.push(p);
      continue;
    }
    // sentence split
    const sentences = p.split(/(?<=[.!?。！？\n])/);
    let buf = "";
    for (const s of sentences) {
      if ((buf + s).length > max && buf.length > 0) {
        out.push(buf.trim());
        buf = s;
      } else {
        buf += s;
      }
    }
    if (buf.trim()) out.push(buf.trim());
  }
  return out.filter(Boolean);
}
