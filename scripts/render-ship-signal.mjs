import { readFile, writeFile } from 'node:fs/promises';

const USERNAME = process.env.PROFILE_USERNAME || 'Vajbratya';
const DATA = new URL('../docs/data.json', import.meta.url);
const OUT = new URL('../assets/ship-signal.svg', import.meta.url);

const raw = JSON.parse(await readFile(DATA, 'utf8'));
const days = raw.days.filter((day) => Number.isFinite(day.count)).slice(-365);

if (days.length < 300) {
  throw new Error(`Need at least 300 days, got ${days.length}.`);
}

const sum = (values) => values.reduce((total, value) => total + value, 0);
const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);
const dateOf = (value) => new Date(`${value}T00:00:00Z`);
const shortDate = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(dateOf(value));
const monthLabel = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(dateOf(value));
const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const counts = days.map((day) => day.count || 0);
const activeCounts = counts.filter((count) => count > 0).sort((a, b) => a - b);
const total = sum(counts);
const activeDays = activeCounts.length;
const medianActive = activeCounts.length
  ? activeCounts.length % 2
    ? activeCounts[(activeCounts.length - 1) / 2]
    : (activeCounts[activeCounts.length / 2 - 1] + activeCounts[activeCounts.length / 2]) / 2
  : 0;

let longestStreak = 0;
let streak = 0;
for (const count of counts) {
  streak = count > 0 ? streak + 1 : 0;
  longestStreak = Math.max(longestStreak, streak);
}

const weekendTotal = sum(
  days
    .filter((day) => {
      const weekday = dateOf(day.date).getUTCDay();
      return weekday === 0 || weekday === 6;
    })
    .map((day) => day.count || 0),
);
const weekendShare = total > 0 ? (weekendTotal / total) * 100 : 0;
const last30 = sum(counts.slice(-30));
const peak = days.reduce((best, day) => (day.count > best.count ? day : best), days[0]);
const maxCount = Math.max(1, ...counts);

const chartX = 28;
const chartWidth = 844;
const chartTop = 96;
const baseline = 178;
const chartHeight = baseline - chartTop;
const step = chartWidth / Math.max(days.length - 1, 1);
const barWidth = Math.max(1.1, Math.min(1.65, step * 0.68));
const recentStart = Math.max(0, days.length - 30);

const bars = days
  .map((day, index) => {
    const count = day.count || 0;
    const x = chartX + index * step;
    const scaled = count > 0 ? Math.log1p(count) / Math.log1p(maxCount) : 0;
    const height = count > 0 ? 3 + scaled * (chartHeight - 3) : 1;
    const y = baseline - height;
    const className = count === 0 ? 'idle' : index >= recentStart ? 'recent' : 'day';

    return `<rect class="${className}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(
      2,
    )}" height="${height.toFixed(2)}" rx="${(barWidth / 2).toFixed(2)}"><title>${escapeXml(
      `${day.date}: ${formatNumber(count)} contribution${count === 1 ? '' : 's'}`,
    )}</title></rect>`;
  })
  .join('\n');

const monthStarts = [];
let previousMonth = '';
for (let index = 0; index < days.length; index += 1) {
  const month = days[index].date.slice(0, 7);
  if (month !== previousMonth) {
    monthStarts.push({ index, date: days[index].date });
    previousMonth = month;
  }
}

const monthMarks = monthStarts
  .map(({ index, date }) => {
    const x = chartX + index * step;
    return `<g><line class="month-line" x1="${x.toFixed(2)}" y1="${chartTop}" x2="${x.toFixed(
      2,
    )}" y2="${baseline + 5}"/><text class="month" x="${x.toFixed(2)}" y="${baseline + 22}">${monthLabel(
      date,
    ).toUpperCase()}</text></g>`;
  })
  .join('\n');

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="244" viewBox="0 0 900 244" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(USERNAME)} GitHub activity, last 365 days</title>
<desc id="desc">One vertical stroke per day. Stroke height represents GitHub contribution volume on a logarithmic scale. The final 30 days are highlighted.</desc>
<style>
:root{--fg:#e6edf3;--muted:#8b949e;--line:#30363d;--bar:#b1bac4;--recent:#f78166}
@media(prefers-color-scheme:light){:root{--fg:#1f2328;--muted:#656d76;--line:#d0d7de;--bar:#57606a;--recent:#bc4c00}}
text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:var(--fg)}
.handle{font-size:17px;font-weight:650}.range{font-size:10px;fill:var(--muted)}
.value{font-size:25px;font-weight:650;letter-spacing:-.5px}.label{font-size:10px;fill:var(--muted)}
.day{fill:var(--bar);opacity:.78}.recent{fill:var(--recent)}.idle{fill:var(--line)}
.month-line{stroke:var(--line);stroke-width:1;opacity:.45}.month{font-size:8px;fill:var(--muted);letter-spacing:.45px}
.meta{font-size:10px;fill:var(--muted)}.rule{stroke:var(--line);stroke-width:1}
</style>
<text class="handle" x="28" y="27">${escapeXml(USERNAME)} / 365d</text>
<text class="range" x="872" y="27" text-anchor="end">${days[0].date} → ${days.at(-1).date}</text>

<g transform="translate(28 45)"><text class="value" x="0" y="23">${formatNumber(
  total,
)}</text><text class="label" x="0" y="40">contributions</text></g>
<g transform="translate(286 45)"><text class="value" x="0" y="23">${formatNumber(
  activeDays,
)}</text><text class="label" x="0" y="40">active days</text></g>
<g transform="translate(544 45)"><text class="value" x="0" y="23">${Number.isInteger(
  medianActive,
) ? formatNumber(medianActive) : medianActive.toFixed(1)}</text><text class="label" x="0" y="40">median / active day</text></g>

<line class="rule" x1="28" y1="${baseline}" x2="872" y2="${baseline}"/>
${monthMarks}
${bars}

<text class="meta" x="28" y="232">${longestStreak}d longest streak</text>
<text class="meta" x="244" y="232">${weekendShare.toFixed(0)}% weekend share</text>
<text class="meta" x="472" y="232">${formatNumber(last30)} last 30d</text>
<text class="meta" x="872" y="232" text-anchor="end">peak ${formatNumber(peak.count)} · ${shortDate(
  peak.date,
)}</text>
</svg>`;

await writeFile(OUT, `${svg}\n`, 'utf8');
console.log(`Rendered ${USERNAME} 365-day contribution trace.`);
