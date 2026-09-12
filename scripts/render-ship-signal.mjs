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
const escapeXml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const parseDate = (value) => new Date(`${value}T00:00:00Z`);
const dateLabel = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(parseDate(value));
const shortDateLabel = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(parseDate(value));
const monthLabel = (value) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  })
    .format(parseDate(`${value}-01`))
    .toUpperCase();
const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

const counts = days.map((day) => day.count || 0);
const total = sum(counts);
const activeDays = counts.filter((count) => count > 0).length;
const activeRate = (activeDays / days.length) * 100;

let longestStreak = 0;
let streak = 0;
for (const count of counts) {
  streak = count > 0 ? streak + 1 : 0;
  longestStreak = Math.max(longestStreak, streak);
}

let currentStreak = 0;
let currentIndex = days.length - 1;
const today = new Date().toISOString().slice(0, 10);
if (days[currentIndex]?.date === today && days[currentIndex]?.count === 0) {
  currentIndex -= 1;
}
while (currentIndex >= 0 && days[currentIndex].count > 0) {
  currentStreak += 1;
  currentIndex -= 1;
}

const last30 = sum(counts.slice(-30));
const previous30 = sum(counts.slice(-60, -30));
const momentum = previous30 > 0 ? ((last30 - previous30) / previous30) * 100 : null;
const momentumLabel =
  momentum === null ? 'comparison unavailable' : `${momentum >= 0 ? '+' : ''}${momentum.toFixed(0)}% vs previous 30d`;
const momentumClass = momentum !== null && momentum < 0 ? 'negative' : 'positive';

const peakDay = days.reduce((best, day) => (day.count > best.count ? day : best), days[0]);

const weeklyDays = days.slice(-364);
const weekly = Array.from({ length: 52 }, (_, index) =>
  sum(weeklyDays.slice(index * 7, index * 7 + 7).map((day) => day.count || 0)),
);
const maxWeekly = Math.max(1, ...weekly);

const chartX = 28;
const chartY = 194;
const chartWidth = 500;
const chartHeight = 72;
const weeklyPoints = weekly
  .map((value, index) => {
    const x = chartX + (index / (weekly.length - 1)) * chartWidth;
    const y = chartY + chartHeight - (value / maxWeekly) * chartHeight;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  })
  .join(' ');

const monthMap = new Map();
for (const day of days) {
  const key = day.date.slice(0, 7);
  monthMap.set(key, (monthMap.get(key) || 0) + (day.count || 0));
}
const months = [...monthMap.entries()]
  .map(([key, value]) => ({ key, label: monthLabel(key), value }))
  .slice(-12);
const maxMonth = Math.max(1, ...months.map((month) => month.value));

const monthChartX = 574;
const monthChartY = 194;
const monthChartHeight = 72;
const monthChartWidth = 298;
const monthGap = 7;
const monthBarWidth = (monthChartWidth - monthGap * (months.length - 1)) / months.length;

const monthBars = months
  .map((month, index) => {
    const height = Math.max(2, (month.value / maxMonth) * monthChartHeight);
    const x = monthChartX + index * (monthBarWidth + monthGap);
    const y = monthChartY + monthChartHeight - height;
    const center = x + monthBarWidth / 2;

    return `<g><rect class="month-bar" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${monthBarWidth.toFixed(
      1,
    )}" height="${height.toFixed(1)}" rx="2"><title>${escapeXml(
      `${month.label}: ${formatNumber(month.value)} contributions`,
    )}</title></rect><text class="month-label" x="${center.toFixed(1)}" y="284" text-anchor="middle">${month.label}</text></g>`;
  })
  .join('\n');

const rangeFrom = raw.range?.from || days[0].date;
const rangeTo = raw.range?.to || days.at(-1).date;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="320" viewBox="0 0 900 320" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(USERNAME)} GitHub activity</title>
<desc id="desc">365-day GitHub contribution summary with activity, streak, recent output, weekly trend, and monthly totals.</desc>
<style>
:root{--bg:#0d1117;--fg:#f0f6fc;--muted:#8b949e;--border:#30363d;--grid:#21262d;--accent:#3fb950;--negative:#f85149;--bar:#238636}
@media(prefers-color-scheme:light){:root{--bg:#ffffff;--fg:#1f2328;--muted:#656d76;--border:#d0d7de;--grid:#d8dee4;--accent:#1a7f37;--negative:#cf222e;--bar:#2da44e}}
text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;fill:var(--fg)}
.title{font-size:19px;font-weight:650}.range{font-size:11px;fill:var(--muted)}
.metric-value{font-size:27px;font-weight:650;letter-spacing:-.5px}.metric-label{font-size:10px;font-weight:600;letter-spacing:.8px;fill:var(--muted)}.metric-note{font-size:10px;fill:var(--muted)}
.section{font-size:11px;font-weight:600;fill:var(--fg)}.section-note{font-size:10px;fill:var(--muted)}
.grid{stroke:var(--grid);stroke-width:1}.trend{fill:none;stroke:var(--accent);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.month-bar{fill:var(--bar)}.month-label{font-size:8px;fill:var(--muted)}
.footer{font-size:10px;fill:var(--muted)}.positive{fill:var(--accent)}.negative{fill:var(--negative)}
</style>
<rect x="0.5" y="0.5" width="899" height="319" rx="14" fill="var(--bg)" stroke="var(--border)"/>
<text class="title" x="28" y="38">${escapeXml(USERNAME)} · GitHub activity</text>
<text class="range" x="872" y="38" text-anchor="end">${escapeXml(dateLabel(rangeFrom))} → ${escapeXml(
  dateLabel(rangeTo),
)}</text>

<g transform="translate(28 68)"><text class="metric-value" x="0" y="24">${formatNumber(total)}</text><text class="metric-label" x="0" y="45">CONTRIBUTIONS</text><text class="metric-note" x="0" y="61">365-day total</text></g>
<g transform="translate(244 68)"><text class="metric-value" x="0" y="24">${activeDays}</text><text class="metric-label" x="0" y="45">ACTIVE DAYS</text><text class="metric-note" x="0" y="61">${activeRate.toFixed(0)}% of days</text></g>
<g transform="translate(456 68)"><text class="metric-value" x="0" y="24">${longestStreak}d</text><text class="metric-label" x="0" y="45">LONGEST STREAK</text><text class="metric-note" x="0" y="61">current ${currentStreak}d</text></g>
<g transform="translate(674 68)"><text class="metric-value" x="0" y="24">${formatNumber(last30)}</text><text class="metric-label" x="0" y="45">LAST 30 DAYS</text><text class="metric-note ${momentumClass}" x="0" y="61">${escapeXml(momentumLabel)}</text></g>

<line x1="28" y1="151" x2="872" y2="151" stroke="var(--border)"/>

<text class="section" x="28" y="178">Weekly contributions</text>
<text class="section-note" x="528" y="178" text-anchor="end">last 52 weeks</text>
<line class="grid" x1="28" y1="194" x2="528" y2="194"/><line class="grid" x1="28" y1="230" x2="528" y2="230"/><line class="grid" x1="28" y1="266" x2="528" y2="266"/>
<polyline class="trend" points="${weeklyPoints}"/>

<text class="section" x="574" y="178">Monthly totals</text>
<text class="section-note" x="872" y="178" text-anchor="end">last 12 months</text>
<line class="grid" x1="574" y1="266" x2="872" y2="266"/>
${monthBars}

<text class="footer" x="28" y="303">peak day ${formatNumber(peakDay.count)} · ${escapeXml(shortDateLabel(
  peakDay.date,
))}</text>
<text class="footer" x="872" y="303" text-anchor="end">updated ${escapeXml(rangeTo)}</text>
</svg>`;

await writeFile(OUT, `${svg}\n`, 'utf8');
console.log(`Rendered ${USERNAME} activity summary: ${formatNumber(total)} contributions.`);
