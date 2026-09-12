import { readFile, writeFile } from 'node:fs/promises';

const USERNAME = process.env.PROFILE_USERNAME || 'Vajbratya';
const DATA = new URL('../docs/data.json', import.meta.url);
const OUT = new URL('../assets/ship-signal.svg', import.meta.url);

const n = (v) => new Intl.NumberFormat('en-US').format(v);
const esc = (v) =>
  String(v)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const d = (s) => new Date(`${s}T00:00:00Z`);

const dateLabel = (s) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d(s));

const monthLabel = (s) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  })
    .format(d(`${s}-01`))
    .toUpperCase();

const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const arc = (cx, cy, r, a1, a2) => {
  const x1 = cx + Math.cos(a1) * r;
  const y1 = cy + Math.sin(a1) * r;
  const x2 = cx + Math.cos(a2) * r;
  const y2 = cy + Math.sin(a2) * r;

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${
    a2 - a1 > Math.PI ? 1 : 0
  } 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const raw = JSON.parse(await readFile(DATA, 'utf8'));
const days = raw.days.filter((x) => Number.isFinite(x.count)).slice(-365);

if (days.length < 300) {
  throw new Error(`Need at least 300 days, got ${days.length}.`);
}

const counts = days.map((x) => x.count || 0);
const total = sum(counts);
const activeDays = counts.filter((x) => x > 0).length;
const activeRate = (activeDays / days.length) * 100;
const dailyAverage = total / days.length;
const peak = days.reduce((a, b) => (b.count > a.count ? b : a), days[0]);
const maxCount = Math.max(1, ...counts);

let longest = 0;
let streak = 0;

for (const c of counts) {
  streak = c > 0 ? streak + 1 : 0;
  longest = Math.max(longest, streak);
}

let current = 0;
let i = days.length - 1;

if (days[i]?.date === new Date().toISOString().slice(0, 10) && days[i]?.count === 0) {
  i -= 1;
}

while (i >= 0 && days[i].count > 0) {
  current += 1;
  i -= 1;
}

const roll = counts.map((_, idx) => {
  const part = counts.slice(Math.max(0, idx - 6), idx + 1);
  return sum(part) / part.length;
});

const last7 = roll.at(-1) || 0;
const max7 = Math.max(1, ...roll);
const last30 = sum(counts.slice(-30));
const prev30 = sum(counts.slice(-60, -30));
const momentum = prev30 > 0 ? ((last30 - prev30) / prev30) * 100 : 0;

const monthMap = new Map();

for (const day of days) {
  const key = day.date.slice(0, 7);
  if (!monthMap.has(key)) monthMap.set(key, []);
  monthMap.get(key).push(day);
}

const months = [...monthMap.entries()].map(([key, value]) => ({
  key,
  label: monthLabel(key),
  total: sum(value.map((x) => x.count || 0)),
}));

const peakMonth = months.reduce((a, b) => (b.total > a.total ? b : a), months[0]);
const maxMonthTotal = Math.max(1, ...months.map((x) => x.total));

const wdNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const weekdays = wdNames.map((name) => ({ name, total: 0, days: 0 }));

for (const day of days) {
  const w = d(day.date).getUTCDay();
  weekdays[w].total += day.count || 0;
  weekdays[w].days += 1;
}

for (const day of weekdays) {
  day.avg = day.days ? day.total / day.days : 0;
}

const dominantWeekday = weekdays.reduce((a, b) => (b.avg > a.avg ? b : a), weekdays[0]);

const cx = 386;
const cy = 336;

const dots = days
  .map((day, idx) => {
    const ring = Math.floor(idx / 92);
    const slot = idx % 92;
    const ringSize = Math.min(92, days.length - ring * 92);
    const angle = -Math.PI / 2 + (slot / ringSize) * Math.PI * 2;
    const radius = 116 + ring * 38;
    const power = clamp((day.count || 0) / maxCount, 0, 1);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const href = esc(
      `https://github.com/${encodeURIComponent(USERNAME)}?from=${day.date}&to=${day.date}`,
    );

    return `<a href="${href}" target="_blank" rel="noopener noreferrer"><circle class="orbit-dot" cx="${x.toFixed(
      2,
    )}" cy="${y.toFixed(2)}" r="${(1.5 + power * 4.1).toFixed(
      2,
    )}" style="opacity:${(0.14 + power * 0.86).toFixed(3)}"><title>${esc(
      `${n(day.count || 0)} contribution${(day.count || 0) === 1 ? '' : 's'} · ${dateLabel(
        day.date,
      )}`,
    )}</title></circle></a>`;
  })
  .join('\n');

const spokes = months
  .map((m, idx) => {
    const angle = -Math.PI / 2 + (idx / months.length) * Math.PI * 2;
    const len = 38 + (m.total / maxMonthTotal) * 120;
    const x1 = cx + Math.cos(angle) * 80;
    const y1 = cy + Math.sin(angle) * 80;
    const x2 = cx + Math.cos(angle) * (80 + len);
    const y2 = cy + Math.sin(angle) * (80 + len);
    const lx = cx + Math.cos(angle) * (118 + len);
    const ly = cy + Math.sin(angle) * (118 + len);
    const anchor =
      Math.cos(angle) > 0.22 ? 'start' : Math.cos(angle) < -0.22 ? 'end' : 'middle';
    const sw = 4 + (m.total / maxMonthTotal) * 8;

    return `<g><line class="month-spoke" x1="${x1.toFixed(2)}" y1="${y1.toFixed(
      2,
    )}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(
      2,
    )}" style="stroke-width:${sw.toFixed(2)}"><title>${esc(
      `${m.label} · ${n(m.total)} contributions`,
    )}</title></line><circle class="month-node" cx="${x2.toFixed(
      2,
    )}" cy="${y2.toFixed(
      2,
    )}" r="5.4"/><text class="month-label mono" x="${lx.toFixed(
      2,
    )}" y="${(ly - 6).toFixed(2)}" text-anchor="${anchor}">${m.label}</text><text class="month-value" x="${lx.toFixed(
      2,
    )}" y="${(ly + 12).toFixed(2)}" text-anchor="${anchor}">${n(m.total)}</text></g>`;
  })
  .join('\n');

const gauges = [
  {
    label: 'ACTIVE RATE',
    value: activeRate / 100,
    text: `${activeRate.toFixed(0)}%`,
    color: 'var(--aqua)',
    r: 106,
  },
  {
    label: 'CURRENT STREAK',
    value: current / Math.max(longest, 1),
    text: `${current}d`,
    color: 'var(--violet)',
    r: 124,
  },
  {
    label: '7D FLOW',
    value: last7 / max7,
    text: `${last7.toFixed(1)}`,
    color: 'var(--amber)',
    r: 142,
  },
]
  .map((g, idx) => {
    const a1 = Math.PI * 0.88 + idx * 0.04;
    const a2 = Math.PI * 2.12 - idx * 0.04;
    const av = a1 + (a2 - a1) * clamp(g.value, 0, 1);
    const la = a1 + (a2 - a1) / 2;
    const lx = cx + Math.cos(la) * g.r;
    const ly = cy + Math.sin(la) * g.r;

    return `<g><path class="arc-track" d="${arc(cx, cy, g.r, a1, a2)}"/><path class="arc-value" d="${arc(
      cx,
      cy,
      g.r,
      a1,
      av,
    )}" style="stroke:${g.color}"><title>${esc(
      `${g.label}: ${g.text}`,
    )}</title></path><text class="arc-label mono" x="${lx.toFixed(
      2,
    )}" y="${(ly - 5).toFixed(2)}" text-anchor="middle">${g.label}</text><text class="arc-text" x="${lx.toFixed(
      2,
    )}" y="${(ly + 13).toFixed(2)}" text-anchor="middle">${g.text}</text></g>`;
  })
  .join('\n');

const maxWeekdayAvg = Math.max(1, ...weekdays.map((x) => x.avg));

const bars = weekdays
  .map((day, idx) => {
    const y = 84 + idx * 30;
    const w = (day.avg / maxWeekdayAvg) * 236;

    return `<g transform="translate(24 ${y})"><text class="mini-label mono" x="0" y="12">${
      day.name
    }</text><rect class="bar-bg" x="56" y="2" width="236" height="12" rx="6"/><rect class="bar-fill" x="56" y="2" width="${w.toFixed(
      2,
    )}" height="12" rx="6"><title>${esc(
      `${day.name}: ${day.avg.toFixed(1)} avg/day · ${n(day.total)} total contributions`,
    )}</title></rect><text class="mini-value" x="304" y="12">${day.avg.toFixed(
      1,
    )}</text></g>`;
  })
  .join('\n');

const b = raw.breakdown || {
  commits: 0,
  pullRequests: 0,
  issues: 0,
  reviews: 0,
};

const latest = days.at(-1).date;
const momentumText = `${momentum >= 0 ? '+' : ''}${momentum.toFixed(0)}%`;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="720" viewBox="0 0 1200 720" role="img" aria-labelledby="title desc">
<title id="title">${esc(USERNAME)} GitHub Flight Control</title>
<desc id="desc">A radial mission-control visualization of ${n(total)} GitHub contributions over the last 365 days.</desc>
<defs>
<radialGradient id="coreGlow" cx="50%" cy="50%" r="60%"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.92"/><stop offset="20%" stop-color="#b794ff" stop-opacity="0.72"/><stop offset="48%" stop-color="#5eead4" stop-opacity="0.28"/><stop offset="75%" stop-color="#0ea5e9" stop-opacity="0.08"/><stop offset="100%" stop-color="#0ea5e9" stop-opacity="0"/></radialGradient>
<linearGradient id="panelBorder" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#2b3440"/><stop offset="100%" stop-color="#11161d"/></linearGradient>
<linearGradient id="barFill" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#67e8f9"/><stop offset="100%" stop-color="#38bdf8"/></linearGradient>
<filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="8"/></filter>
</defs>
<style>
:root{--bg:#05070b;--panel:#0b1017;--panel2:#0f1622;--fg:#f8fafc;--muted:#8b9bb2;--line:#1c2634;--aqua:#67e8f9;--sky:#38bdf8;--violet:#b794ff;--amber:#fbbf24;--pink:#fb7185}
@media(prefers-color-scheme:light){:root{--bg:#f6f9fc;--panel:#ffffff;--panel2:#f9fbff;--fg:#0f172a;--muted:#52627b;--line:#d8e1ef;--aqua:#0891b2;--sky:#0284c7;--violet:#7c3aed;--amber:#d97706;--pink:#e11d48}}
text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif;fill:var(--fg)} .mono{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace}
.eyebrow{font-size:12px;font-weight:760;letter-spacing:2.2px;fill:var(--muted)} .title{font-size:42px;font-weight:800;letter-spacing:-1.8px} .subtitle{font-size:15px;fill:var(--muted)} .section{font-size:12px;font-weight:740;letter-spacing:1.9px;fill:var(--muted)} .hero{font-size:68px;font-weight:820;letter-spacing:-3.5px} .hero-sub{font-size:14px;letter-spacing:1.6px;fill:var(--muted)} .big-label{font-size:13px;fill:var(--muted);letter-spacing:1.2px} .big-value{font-size:28px;font-weight:780;letter-spacing:-1px} .mini-label{font-size:12px;fill:var(--muted)} .mini-value{font-size:12px;font-weight:700} .month-label{font-size:11px;fill:var(--muted);letter-spacing:1.1px} .month-value{font-size:12px;font-weight:720}
.orbit-guide{fill:none;stroke:var(--line);stroke-width:1;stroke-dasharray:3 8} .orbit-dot{fill:var(--aqua)} .month-spoke{stroke:var(--sky);stroke-linecap:round;opacity:.82;filter:url(#softGlow)} .month-node{fill:var(--fg)} .arc-track{fill:none;stroke:var(--line);stroke-width:8;stroke-linecap:round} .arc-value{fill:none;stroke-width:8;stroke-linecap:round;filter:url(#softGlow)} .arc-label{font-size:10px;fill:var(--muted);letter-spacing:1px} .arc-text{font-size:13px;font-weight:760} .bar-bg{fill:var(--line)} .bar-fill{fill:url(#barFill)} .chip{fill:var(--panel2);stroke:var(--line)} .divider{stroke:var(--line);stroke-width:1} .wire{stroke:var(--line);stroke-width:1.2;fill:none} .wire-strong{stroke:var(--aqua);stroke-width:1.8;fill:none;opacity:.85}
.pulse{animation:pulse 2.4s ease-in-out infinite} .scan{animation:spin 38s linear infinite;transform-origin:${cx}px ${cy}px} .scan-slow{animation:spinReverse 72s linear infinite;transform-origin:${cx}px ${cy}px} .float{animation:float 4.6s ease-in-out infinite}
@keyframes pulse{0%,100%{opacity:.45}50%{opacity:1}} @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}} @keyframes spinReverse{from{transform:rotate(360deg)}to{transform:rotate(0deg)}} @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}} @media(prefers-reduced-motion:reduce){.pulse,.scan,.scan-slow,.float{animation:none}}
</style>
<rect width="1200" height="720" fill="var(--bg)"/><rect x="18" y="18" width="1164" height="684" rx="28" fill="var(--panel)" stroke="url(#panelBorder)"/>
<g transform="translate(48 50)"><text class="eyebrow mono" x="0" y="0">GITHUB FLIGHT CONTROL / ${esc(
  USERNAME.toUpperCase(),
)}</text><text class="title" x="0" y="48">Not a heatmap. A launch console.</text><text class="subtitle" x="0" y="74">365-day output as orbital telemetry, monthly thrust, and weekday behavior. Click any glowing dot for the exact GitHub day.</text></g>
<g transform="translate(886 54)"><rect class="chip" x="0" y="0" width="246" height="124" rx="20"/><text class="section mono" x="22" y="28">CORE METRICS</text><text class="hero" x="22" y="76">${n(
  total,
)}</text><text class="hero-sub mono" x="22" y="100">TOTAL CONTRIBUTIONS / 365D</text><text class="hero-sub mono" x="22" y="118">LAST SYNC ${latest} · LIVE DATA</text></g>
<g><circle class="orbit-guide scan-slow" cx="${cx}" cy="${cy}" r="116"/><circle class="orbit-guide scan" cx="${cx}" cy="${cy}" r="154"/><circle class="orbit-guide scan-slow" cx="${cx}" cy="${cy}" r="192"/><circle class="orbit-guide scan" cx="${cx}" cy="${cy}" r="230"/><circle class="orbit-guide scan-slow" cx="${cx}" cy="${cy}" r="268"/></g>
<g>${dots}</g><g>${spokes}</g><g>${gauges}</g>
<g class="float"><circle cx="${cx}" cy="${cy}" r="68" fill="url(#coreGlow)" opacity=".95"/><circle class="pulse" cx="${cx}" cy="${cy}" r="46" fill="none" stroke="var(--aqua)" stroke-width="1.3" opacity=".72"/><circle cx="${cx}" cy="${cy}" r="16" fill="var(--fg)" opacity=".96"/><text class="section mono" x="${cx}" y="${
  cy - 10
}" text-anchor="middle">LAUNCH CORE</text><text class="big-value" x="${cx}" y="${
  cy + 22
}" text-anchor="middle">${dailyAverage.toFixed(1)}/day</text></g>
<g transform="translate(760 214)"><rect class="chip" x="0" y="0" width="372" height="436" rx="24"/><text class="section mono" x="24" y="30">WEEKDAY BEHAVIOR</text><text class="subtitle" x="24" y="54">Average contributions per weekday. This shows when the engine usually runs hottest.</text>${bars}<line class="divider" x1="24" y1="312" x2="348" y2="312"/><text class="section mono" x="24" y="340">OPERATING NOTES</text><text class="big-label" x="24" y="370">Dominant weekday</text><text class="big-value" x="24" y="398">${dominantWeekday.name} / ${dominantWeekday.avg.toFixed(
  1,
)}</text><text class="big-label" x="24" y="426">30D momentum</text><text class="big-value" x="24" y="454">${momentumText}</text><text class="big-label" x="24" y="482">Peak day</text><text class="big-value" x="24" y="510">${n(
  peak.count,
)} · ${dateLabel(peak.date)}</text><text class="big-label" x="24" y="538">Breakdown</text><text class="subtitle" x="24" y="562">${n(
  b.commits,
)} commits · ${n(b.pullRequests)} PRs · ${n(b.issues)} issues · ${n(b.reviews)} reviews</text></g>
<g transform="translate(52 548)"><rect class="chip" x="0" y="0" width="654" height="102" rx="24"/><text class="section mono" x="26" y="30">MISSION SUMMARY</text><path class="wire" d="M 24 66 H 630"/><circle cx="24" cy="66" r="4" fill="var(--aqua)"/><circle cx="232" cy="66" r="4" fill="var(--violet)"/><circle cx="420" cy="66" r="4" fill="var(--amber)"/><circle cx="630" cy="66" r="4" fill="var(--pink)"/><text class="mini-label" x="24" y="90">${activeDays} active days</text><text class="mini-label" x="232" y="90">${longest}d longest streak</text><text class="mini-label" x="420" y="90">${peakMonth.label} strongest month</text><text class="mini-label" x="630" y="90" text-anchor="end">${n(
  peakMonth.total,
)} contributions</text></g>
<g transform="translate(52 214)"><path class="wire-strong" d="M 560 126 C 624 126, 682 164, 734 212"/><path class="wire" d="M 540 184 C 614 212, 676 244, 728 286"/><path class="wire" d="M 520 244 C 612 280, 654 336, 728 420"/></g>
<text class="eyebrow mono" x="54" y="686">SELF-HOSTED ON GITHUB / NO THIRD-PARTY GRAPH ENGINE / UPDATED ${latest}</text><text class="eyebrow mono" x="1146" y="686" text-anchor="end">CLICK A DOT TO OPEN THE EXACT DAY</text>
</svg>`;

await writeFile(OUT, `${svg}\n`, 'utf8');

console.log(`Rendered GitHub Flight Control for ${USERNAME}: ${n(total)} contributions.`);
