import { readFile, writeFile } from 'node:fs/promises';

const USERNAME = process.env.PROFILE_USERNAME || 'Vajbratya';
const DATA_URL = new URL('../docs/data.json', import.meta.url);
const OUTPUT_URL = new URL('../assets/ship-signal.svg', import.meta.url);

const int = (value) => new Intl.NumberFormat('en-US').format(value);
const xml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&apos;');

function shortDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function rollingAverage(values, windowSize = 7) {
  const output = [];
  const queue = [];
  let sum = 0;

  for (const value of values) {
    queue.push(value);
    sum += value;
    if (queue.length > windowSize) sum -= queue.shift();
    output.push(sum / queue.length);
  }

  return output;
}

function statsFor(days) {
  const counts = days.map((day) => Number(day.count) || 0);
  const total = counts.reduce((sum, value) => sum + value, 0);
  const activeDays = counts.filter((value) => value > 0).length;
  const peak = days.reduce(
    (best, day) => (day.count > best.count ? day : best),
    days[0],
  );

  let longestStreak = 0;
  let run = 0;
  for (const day of days) {
    if (day.count > 0) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }

  let currentStreak = 0;
  let index = days.length - 1;
  const today = new Date().toISOString().slice(0, 10);
  if (days[index]?.date === today && days[index]?.count === 0) index -= 1;
  while (index >= 0 && days[index].count > 0) {
    currentStreak += 1;
    index -= 1;
  }

  return {
    total,
    activeDays,
    activeRate: days.length ? (activeDays / days.length) * 100 : 0,
    dailyAverage: days.length ? total / days.length : 0,
    peak,
    currentStreak,
    longestStreak,
  };
}

function smoothPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    path += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }
  return path;
}

function monthLabels(days, startX, width) {
  let previousMonth = '';
  const labels = [];

  days.forEach((day, index) => {
    const monthKey = day.date.slice(0, 7);
    if (monthKey === previousMonth) return;
    previousMonth = monthKey;

    const text = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${day.date}T00:00:00Z`)).toUpperCase();

    const x = startX + (index / Math.max(1, days.length - 1)) * width;
    labels.push(`<text class="month" x="${x.toFixed(2)}" y="390">${xml(text)}</text>`);
  });

  return labels.join('\n');
}

function heatmap(days, startX, startY, width) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = new Date(`${days[0].date}T00:00:00Z`);
  const gridStart = new Date(first);
  gridStart.setUTCDate(gridStart.getUTCDate() - gridStart.getUTCDay());

  const last = new Date(`${days.at(-1).date}T00:00:00Z`);
  const columns = Math.ceil((last - gridStart) / 86_400_000 / 7) + 1;
  const cell = 10;
  const gapY = 3;
  const gapX = Math.max(3, (width - columns * cell) / Math.max(1, columns - 1));
  const output = [];

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < 7; row += 1) {
      const date = new Date(gridStart);
      date.setUTCDate(gridStart.getUTCDate() + column * 7 + row);
      const key = date.toISOString().slice(0, 10);
      const day = byDate.get(key);
      if (!day) continue;

      const x = startX + column * (cell + gapX);
      const y = startY + row * (cell + gapY);
      const level = Math.max(0, Math.min(4, Number(day.level) || 0));
      const label = `${int(day.count)} contribution${day.count === 1 ? '' : 's'} · ${shortDate(day.date)}`;
      const dayUrl = `https://github.com/${encodeURIComponent(USERNAME)}?from=${day.date}&to=${day.date}`;

      output.push(
        `<a href="${xml(dayUrl)}" target="_blank" rel="noopener noreferrer">` +
        `<rect class="day l${level}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell}" height="${cell}" rx="2">` +
        `<title>${xml(label)}</title></rect></a>`,
      );
    }
  }

  return output.join('\n');
}

const data = JSON.parse(await readFile(DATA_URL, 'utf8'));
const days = data.days
  .filter((day) => typeof day.date === 'string' && Number.isFinite(Number(day.count)))
  .map((day) => ({ ...day, count: Number(day.count), level: Number(day.level) || 0 }))
  .slice(-371);

if (days.length < 300) {
  throw new Error(`Expected at least 300 contribution days, got ${days.length}.`);
}

const stats = statsFor(days);
const velocity = rollingAverage(days.map((day) => day.count), 7);
const plot = { x: 64, y: 190, width: 1072, height: 174 };
const maxVelocity = Math.max(1, ...velocity);
const points = velocity.map((value, index) => [
  plot.x + (index / Math.max(1, velocity.length - 1)) * plot.width,
  plot.y + plot.height - (value / maxVelocity) * plot.height,
]);
const linePath = smoothPath(points);
const areaPath = `${linePath} L ${plot.x + plot.width} ${plot.y + plot.height} L ${plot.x} ${plot.y + plot.height} Z`;
const peakIndex = Math.max(0, days.findIndex((day) => day.date === stats.peak.date));
const peakPoint = points[peakIndex];
const latest = days.at(-1);

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520" role="img" aria-labelledby="title desc">
  <title id="title">${xml(USERNAME)} GitHub Ship Signal</title>
  <desc id="desc">${int(stats.total)} GitHub contributions across the last year, seven-day shipping velocity, and a daily contribution heatmap.</desc>
  <defs>
    <linearGradient id="signalFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f5f5f5" stop-opacity=".18"/>
      <stop offset=".62" stop-color="#f5f5f5" stop-opacity=".035"/>
      <stop offset="1" stop-color="#f5f5f5" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter>
  </defs>
  <style>
    :root{--bg:#0d1117;--fg:#f0f6fc;--muted:#8b949e;--grid:#21262d;--c0:#161b22;--c1:#0e4429;--c2:#006d32;--c3:#26a641;--c4:#39d353;--accent:#39d353}
    @media(prefers-color-scheme:light){:root{--bg:#ffffff;--fg:#1f2328;--muted:#656d76;--grid:#d8dee4;--c0:#ebedf0;--c1:#9be9a8;--c2:#40c463;--c3:#30a14e;--c4:#216e39;--accent:#1a7f37}}
    text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;fill:var(--fg)}
    .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
    .eyebrow{font-size:13px;font-weight:760;letter-spacing:1.7px}.muted{fill:var(--muted)}
    .hero{font-size:58px;font-weight:780;letter-spacing:-3.2px}.label,.month{font-size:11px;font-weight:680;letter-spacing:1.05px;fill:var(--muted)}
    .metric{font-size:23px;font-weight:720;letter-spacing:-.45px}.month{text-anchor:middle}
    .grid{stroke:var(--grid);stroke-width:1;vector-effect:non-scaling-stroke}
    .area{fill:url(#signalFill);opacity:0;animation:fade .75s .35s ease forwards}
    .trace-glow{fill:none;stroke:var(--fg);stroke-width:7;opacity:.08;filter:url(#glow)}
    .trace{fill:none;stroke:var(--fg);stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round;vector-effect:non-scaling-stroke;stroke-dasharray:1800;stroke-dashoffset:1800;animation:draw 2s cubic-bezier(.16,1,.3,1) forwards}
    .live,.latest{fill:var(--accent);animation:pulse 1.7s ease-in-out infinite}.peak{fill:var(--bg);stroke:var(--fg);stroke-width:2}
    .day{stroke:transparent;stroke-width:1.25;vector-effect:non-scaling-stroke;transform-box:fill-box;transform-origin:center;transition:transform 120ms ease,stroke 120ms ease;cursor:pointer}
    .day:hover{transform:scale(1.5);stroke:var(--fg)}.l0{fill:var(--c0)}.l1{fill:var(--c1)}.l2{fill:var(--c2)}.l3{fill:var(--c3)}.l4{fill:var(--c4)}
    @keyframes draw{to{stroke-dashoffset:0}}@keyframes fade{to{opacity:1}}@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}}
    @media(prefers-reduced-motion:reduce){.trace{animation:none;stroke-dashoffset:0}.area{animation:none;opacity:1}.live,.latest{animation:none}}
  </style>
  <rect width="1200" height="520" rx="18" fill="var(--bg)"/>
  <rect x=".5" y=".5" width="1199" height="519" rx="17.5" fill="none" stroke="var(--grid)"/>
  <g transform="translate(64 46)"><circle class="live" cx="4" cy="4" r="4"/><text class="eyebrow mono" x="18" y="9">NATAN / SHIP SIGNAL</text><text class="eyebrow mono muted" x="1072" y="9" text-anchor="end">LIVE · GITHUB · UTC</text></g>
  <text class="hero" x="64" y="132">${int(stats.total)}</text>
  <text class="label mono" x="66" y="155">PROFILE-VISIBLE CONTRIBUTIONS · ROLLING 365D</text>
  <g transform="translate(584 95)">
    <text class="metric" x="0" y="0">${stats.dailyAverage.toFixed(1)}</text><text class="label mono" x="0" y="23">DAILY AVG</text>
    <text class="metric" x="178" y="0">${stats.activeRate.toFixed(0)}%</text><text class="label mono" x="178" y="23">ACTIVE RATE</text>
    <text class="metric" x="356" y="0">${int(stats.peak.count)}</text><text class="label mono" x="356" y="23">PEAK · ${xml(shortDate(stats.peak.date).toUpperCase())}</text>
    <text class="metric" x="526" y="0">${stats.longestStreak}d</text><text class="label mono" x="526" y="23">LONGEST STREAK</text>
  </g>
  <text class="label mono" x="64" y="178">SHIPPING VELOCITY · 7D ROLLING AVERAGE</text>
  <text class="label mono" x="1136" y="178" text-anchor="end">GITHUB-NATIVE · SELF-HOSTED · NO GRAPH SERVICE</text>
  <g aria-hidden="true"><line class="grid" x1="64" x2="1136" y1="190" y2="190"/><line class="grid" x1="64" x2="1136" y1="248" y2="248" opacity=".62"/><line class="grid" x1="64" x2="1136" y1="306" y2="306" opacity=".62"/><line class="grid" x1="64" x2="1136" y1="364" y2="364"/></g>
  <path class="area" d="${areaPath}"/><path class="trace-glow" d="${linePath}"/><path class="trace" d="${linePath}"/>
  <line class="grid" x1="${peakPoint[0].toFixed(2)}" x2="${peakPoint[0].toFixed(2)}" y1="${Math.max(plot.y, peakPoint[1] - 8).toFixed(2)}" y2="364" opacity=".42"/>
  <circle class="peak" cx="${peakPoint[0].toFixed(2)}" cy="${peakPoint[1].toFixed(2)}" r="4.5"><title>${int(stats.peak.count)} contributions · ${xml(shortDate(stats.peak.date))}</title></circle>
  <circle class="latest" cx="${points.at(-1)[0].toFixed(2)}" cy="${points.at(-1)[1].toFixed(2)}" r="4.2"><title>${int(latest.count)} contributions · ${xml(shortDate(latest.date))}</title></circle>
  ${monthLabels(days, plot.x, plot.width)}
  <g>${heatmap(days, 64, 400, 1072)}</g>
  <text class="label mono" x="64" y="508">OPEN SIGNAL · HOVER OR CLICK A DAY FOR GITHUB DETAIL</text>
  <text class="label mono" x="1136" y="508" text-anchor="end">${stats.activeDays} ACTIVE DAYS · CURRENT STREAK ${stats.currentStreak}D · UPDATED ${xml(latest.date)}</text>
</svg>`;

await writeFile(OUTPUT_URL, `${svg}\n`, 'utf8');
console.log(`Rendered ${OUTPUT_URL.pathname}: ${int(stats.total)} contributions.`);
