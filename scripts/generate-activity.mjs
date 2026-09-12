import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const USERNAME = process.env.PROFILE_USERNAME || 'Vajbratya';
const TOKEN = process.env.GH_TOKEN || process.env.GITHUB_TOKEN || '';
const DAYS_IN_VIEW = 371;
const OUTPUT_SVG = new URL('../assets/activity.svg', import.meta.url);
const OUTPUT_JSON = new URL('../docs/data.json', import.meta.url);

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function decodeHtml(value) {
  return value
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function attr(tag, name) {
  const match = tag.match(new RegExp(`${name}=["']([^"']*)["']`, 'i'));
  return match?.[1] ?? null;
}

function normalizeDate(date) {
  return new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10);
}

function formatInt(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

async function fetchContributionHtml(username) {
  const response = await fetch(`https://github.com/users/${encodeURIComponent(username)}/contributions`, {
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': `${username}-profile-activity-signal`,
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub contributions HTML returned ${response.status}`);
  }

  return response.text();
}

function parseContributionHtml(html) {
  const tooltips = new Map();
  const tooltipPattern = /<tool-tip\b([^>]*)>([\s\S]*?)<\/tool-tip>/gi;
  for (const match of html.matchAll(tooltipPattern)) {
    const id = attr(match[1], 'for');
    if (!id) continue;
    const text = decodeHtml(match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    tooltips.set(id, text);
  }

  const days = [];
  const cellPattern = /<(?:td|rect)\b([^>]*ContributionCalendar-day[^>]*)>/gi;
  for (const match of html.matchAll(cellPattern)) {
    const tag = match[1];
    const date = attr(tag, 'data-date');
    if (!date) continue;

    const id = attr(tag, 'id');
    const explicitCount = attr(tag, 'data-count');
    const level = Number(attr(tag, 'data-level') ?? 0);
    const tooltip = id ? tooltips.get(id) : null;
    const countMatch = tooltip?.match(/([\d,.]+)\s+contributions?/i);
    const noContributions = tooltip ? /no contributions?/i.test(tooltip) : false;

    let count = explicitCount ? Number(explicitCount) : null;
    if (!Number.isFinite(count)) count = null;
    if (count === null && countMatch) count = Number(countMatch[1].replace(/[,.]/g, ''));
    if (count === null && noContributions) count = 0;

    days.push({
      date: normalizeDate(date),
      count,
      level: Number.isFinite(level) ? level : 0,
    });
  }

  const unique = new Map(days.map((day) => [day.date, day]));
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}

async function fetchGraphQlCalendar(username) {
  if (!TOKEN) return null;

  const now = new Date();
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - DAYS_IN_VIEW);

  const query = `
    query ActivitySignal($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          restrictedContributionsCount
          totalCommitContributions
          totalIssueContributions
          totalPullRequestContributions
          totalPullRequestReviewContributions
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                weekday
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': `${username}-profile-activity-signal`,
      'X-GitHub-Api-Version': '2026-03-10',
    },
    body: JSON.stringify({ query, variables: { login: username, from: from.toISOString(), to: now.toISOString() } }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL returned ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join('; '));
  }

  const collection = payload.data?.user?.contributionsCollection;
  if (!collection) return null;

  const levelMap = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
  };

  const days = collection.contributionCalendar.weeks
    .flatMap((week) => week.contributionDays)
    .map((day) => ({
      date: normalizeDate(day.date),
      count: day.contributionCount,
      level: levelMap[day.contributionLevel] ?? 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    days,
    breakdown: {
      commits: collection.totalCommitContributions,
      issues: collection.totalIssueContributions,
      pullRequests: collection.totalPullRequestContributions,
      reviews: collection.totalPullRequestReviewContributions,
      restricted: collection.restrictedContributionsCount,
    },
  };
}

function fillMissingCounts(days, graphQlDays) {
  if (!days.length) return graphQlDays ?? [];
  const graphQlByDate = new Map((graphQlDays ?? []).map((day) => [day.date, day]));

  return days.map((day) => {
    if (day.count !== null) return day;
    const gql = graphQlByDate.get(day.date);
    if (gql) return { ...day, count: gql.count, level: Math.max(day.level, gql.level) };
    return { ...day, count: 0 };
  });
}

function rollingAverage(values, windowSize) {
  const result = [];
  let sum = 0;
  const queue = [];

  for (const value of values) {
    queue.push(value);
    sum += value;
    if (queue.length > windowSize) sum -= queue.shift();
    result.push(sum / queue.length);
  }

  return result;
}

function percentileRank(values, value) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const below = sorted.filter((candidate) => candidate <= value).length;
  return Math.round((below / sorted.length) * 100);
}

function calculateStats(days) {
  const counts = days.map((day) => day.count ?? 0);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const activeDays = counts.filter((count) => count > 0).length;
  const peak = days.reduce(
    (best, day) => (day.count > best.count ? day : best),
    { date: days.at(-1)?.date ?? '', count: 0 },
  );

  let longestStreak = 0;
  let streak = 0;
  for (const day of days) {
    if (day.count > 0) {
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
    } else {
      streak = 0;
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

  const last30 = counts.slice(-30);
  const previous30 = counts.slice(-60, -30);
  const last30Total = last30.reduce((sum, count) => sum + count, 0);
  const previous30Total = previous30.reduce((sum, count) => sum + count, 0);
  const delta30 = previous30Total > 0 ? ((last30Total - previous30Total) / previous30Total) * 100 : 0;
  const latest7Average = rollingAverage(counts, 7).at(-1) ?? 0;
  const intensityPercentile = percentileRank(rollingAverage(counts, 7), latest7Average);

  return {
    total,
    activeDays,
    longestStreak,
    currentStreak,
    peak,
    delta30,
    latest7Average,
    intensityPercentile,
  };
}

function catmullRomPath(points) {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0][0]} ${points[0][1]}`;

  let path = `M ${points[0][0].toFixed(2)} ${points[0][1].toFixed(2)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6;
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6;
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6;
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6;

    path += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`;
  }

  return path;
}

function buildMonthLabels(days, x, width) {
  const labels = [];
  let previousMonth = null;

  days.forEach((day, index) => {
    const month = day.date.slice(0, 7);
    if (month === previousMonth) return;
    previousMonth = month;
    const date = new Date(`${day.date}T00:00:00.000Z`);
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' }).format(date).toUpperCase();
    const xPosition = x + (index / Math.max(1, days.length - 1)) * width;
    labels.push({ label, x: xPosition });
  });

  return labels;
}

function buildHeatmap(days, startX, startY, width) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const firstDate = new Date(`${days[0].date}T00:00:00.000Z`);
  const start = new Date(firstDate);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());

  const lastDate = new Date(`${days.at(-1).date}T00:00:00.000Z`);
  const columns = Math.ceil((lastDate - start) / 86_400_000 / 7) + 1;
  const gap = 3;
  const cell = Math.min(12, Math.max(7, (width - (columns - 1) * gap) / columns));
  const usedWidth = columns * cell + (columns - 1) * gap;
  const offsetX = startX + (width - usedWidth) / 2;
  const cells = [];

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < 7; row += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + column * 7 + row);
      const key = date.toISOString().slice(0, 10);
      const day = byDate.get(key);
      if (!day) continue;

      const x = offsetX + column * (cell + gap);
      const y = startY + row * (cell + gap);
      const level = Math.max(0, Math.min(4, day.level ?? 0));
      const label = `${formatInt(day.count)} contribution${day.count === 1 ? '' : 's'} · ${formatShortDate(day.date)}`;
      const profileUrl = `https://github.com/${encodeURIComponent(USERNAME)}?from=${day.date}&to=${day.date}`;

      cells.push(`<a href="${profileUrl}" target="_blank" rel="noopener noreferrer"><rect class="day level-${level}" x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${cell.toFixed(2)}" height="${cell.toFixed(2)}" rx="2"><title>${escapeXml(label)}</title></rect></a>`);
    }
  }

  return { cells: cells.join('\n'), height: 7 * cell + 6 * gap };
}

function buildSvg(days, stats, breakdown) {
  const plotX = 64;
  const plotY = 190;
  const plotWidth = 1072;
  const plotHeight = 176;
  const heatY = 406;

  const values = rollingAverage(days.map((day) => day.count), 7);
  const maxValue = Math.max(1, ...values);
  const points = values.map((value, index) => {
    const x = plotX + (index / Math.max(1, values.length - 1)) * plotWidth;
    const y = plotY + plotHeight - (value / maxValue) * plotHeight;
    return [x, y];
  });
  const linePath = catmullRomPath(points);
  const areaPath = `${linePath} L ${(plotX + plotWidth).toFixed(2)} ${(plotY + plotHeight).toFixed(2)} L ${plotX.toFixed(2)} ${(plotY + plotHeight).toFixed(2)} Z`;
  const months = buildMonthLabels(days, plotX, plotWidth);
  const heat = buildHeatmap(days, plotX, heatY, plotWidth);
  const latest = days.at(-1);
  const deltaPrefix = stats.delta30 > 0 ? '+' : '';
  const breakdownText = breakdown
    ? `${formatInt(breakdown.commits)} commits · ${formatInt(breakdown.pullRequests)} PRs · ${formatInt(breakdown.issues)} issues · ${formatInt(breakdown.reviews)} reviews`
    : 'GitHub contribution signal · rolling 365 days';

  const monthLabels = months
    .map((month) => `<text class="month" x="${month.x.toFixed(2)}" y="387">${month.label}</text>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="520" viewBox="0 0 1200 520" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(USERNAME)} GitHub activity signal</title>
  <desc id="desc">${formatInt(stats.total)} contributions across the last year, with a seven-day rolling shipping velocity line and a clickable daily contribution heatmap.</desc>
  <defs>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="var(--fg)" stop-opacity="0.20"/>
      <stop offset="0.68" stop-color="var(--fg)" stop-opacity="0.04"/>
      <stop offset="1" stop-color="var(--fg)" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <style>
    :root { --bg:#09090b; --panel:#0f0f12; --fg:#fafafa; --muted:#8b8b93; --grid:#24242a; --cell0:#17171b; --cell1:#12351f; --cell2:#17652f; --cell3:#21a347; --cell4:#39d353; --accent:#39d353; }
    @media (prefers-color-scheme: light) { :root { --bg:#ffffff; --panel:#fbfbfb; --fg:#111111; --muted:#66666f; --grid:#e7e7ea; --cell0:#eeeeef; --cell1:#b9ecc6; --cell2:#72d98c; --cell3:#36b85b; --cell4:#138a39; --accent:#138a39; } }
    * { box-sizing:border-box; }
    text { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Helvetica,Arial,sans-serif; fill:var(--fg); }
    .mono { font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace; }
    .eyebrow { font-size:13px; font-weight:700; letter-spacing:1.8px; }
    .muted { fill:var(--muted); }
    .value { font-size:54px; font-weight:750; letter-spacing:-2.8px; }
    .stat-value { font-size:22px; font-weight:680; letter-spacing:-0.5px; }
    .stat-label, .month { font-size:11px; font-weight:650; letter-spacing:1.1px; fill:var(--muted); }
    .month { text-anchor:middle; }
    .grid { stroke:var(--grid); stroke-width:1; vector-effect:non-scaling-stroke; }
    .signal { fill:none; stroke:var(--fg); stroke-width:2.4; stroke-linecap:round; stroke-linejoin:round; vector-effect:non-scaling-stroke; stroke-dasharray:1700; stroke-dashoffset:1700; animation:draw 2.2s cubic-bezier(.16,1,.3,1) forwards; filter:url(#glow); }
    .area { fill:url(#area); opacity:0; animation:fade .9s .45s ease forwards; }
    .latest-dot { fill:var(--accent); animation:pulse 1.8s ease-in-out infinite; }
    .live-dot { fill:var(--accent); animation:pulse 1.6s ease-in-out infinite; }
    .day { stroke:transparent; stroke-width:1.4; vector-effect:non-scaling-stroke; transform-box:fill-box; transform-origin:center; transition:transform 120ms ease, stroke 120ms ease, opacity 120ms ease; cursor:pointer; }
    .day:hover { transform:scale(1.45); stroke:var(--fg); opacity:1; }
    .level-0 { fill:var(--cell0); } .level-1 { fill:var(--cell1); } .level-2 { fill:var(--cell2); } .level-3 { fill:var(--cell3); } .level-4 { fill:var(--cell4); }
    @keyframes draw { to { stroke-dashoffset:0; } }
    @keyframes fade { to { opacity:1; } }
    @keyframes pulse { 0%,100% { opacity:.42; } 50% { opacity:1; } }
    @media (prefers-reduced-motion: reduce) { .signal { animation:none; stroke-dashoffset:0; } .area { animation:none; opacity:1; } .live-dot,.latest-dot { animation:none; } }
  </style>

  <rect width="1200" height="520" rx="18" fill="var(--bg)"/>
  <rect x="0.5" y="0.5" width="1199" height="519" rx="17.5" fill="none" stroke="var(--grid)"/>

  <g transform="translate(64 46)">
    <circle class="live-dot" cx="4" cy="4" r="4"/>
    <text class="eyebrow mono" x="18" y="9">NATAN / SHIP SIGNAL</text>
    <text class="eyebrow mono muted" x="1072" y="9" text-anchor="end">LIVE · GITHUB · UTC</text>
  </g>

  <text class="value" x="64" y="130">${formatInt(stats.total)}</text>
  <text class="stat-label mono" x="66" y="153">CONTRIBUTIONS · ROLLING 365D</text>

  <g transform="translate(584 94)">
    <text class="stat-value" x="0" y="0">${stats.currentStreak}d</text>
    <text class="stat-label mono" x="0" y="22">CURRENT STREAK</text>
    <text class="stat-value" x="178" y="0">${stats.activeDays}</text>
    <text class="stat-label mono" x="178" y="22">ACTIVE DAYS</text>
    <text class="stat-value" x="356" y="0">${formatInt(stats.peak.count)}</text>
    <text class="stat-label mono" x="356" y="22">PEAK · ${escapeXml(formatShortDate(stats.peak.date).toUpperCase())}</text>
    <text class="stat-value" x="526" y="0">${deltaPrefix}${stats.delta30.toFixed(0)}%</text>
    <text class="stat-label mono" x="526" y="22">30D MOMENTUM</text>
  </g>

  <text class="stat-label mono" x="64" y="178">SHIPPING VELOCITY · 7D ROLLING AVG · P${stats.intensityPercentile}</text>
  <text class="stat-label mono" x="1136" y="178" text-anchor="end">${escapeXml(breakdownText.toUpperCase())}</text>

  <g aria-hidden="true">
    <line class="grid" x1="64" x2="1136" y1="190" y2="190"/>
    <line class="grid" x1="64" x2="1136" y1="248.67" y2="248.67" opacity=".62"/>
    <line class="grid" x1="64" x2="1136" y1="307.33" y2="307.33" opacity=".62"/>
    <line class="grid" x1="64" x2="1136" y1="366" y2="366"/>
  </g>

  <path class="area" d="${areaPath}"/>
  <path class="signal" d="${linePath}"/>
  <circle class="latest-dot" cx="${points.at(-1)[0].toFixed(2)}" cy="${points.at(-1)[1].toFixed(2)}" r="4.2"><title>${escapeXml(`${formatInt(latest.count)} contributions · ${formatShortDate(latest.date)}`)}</title></circle>

  ${monthLabels}

  <g class="heatmap">
    ${heat.cells}
  </g>

  <text class="stat-label mono" x="64" y="503">HOVER / CLICK A DAY FOR GITHUB DETAIL</text>
  <text class="stat-label mono" x="1136" y="503" text-anchor="end">UPDATED ${escapeXml(latest.date)} · LONGEST STREAK ${stats.longestStreak}D</text>
</svg>`;
}

async function main() {
  let htmlDays = [];
  let graphQl = null;

  try {
    const html = await fetchContributionHtml(USERNAME);
    htmlDays = parseContributionHtml(html);
  } catch (error) {
    console.warn(`HTML contribution fetch failed: ${error.message}`);
  }

  try {
    graphQl = await fetchGraphQlCalendar(USERNAME);
  } catch (error) {
    console.warn(`GraphQL contribution fetch failed: ${error.message}`);
  }

  let days = fillMissingCounts(htmlDays, graphQl?.days ?? null);
  if (days.length < 300 && graphQl?.days?.length >= 300) days = graphQl.days;

  days = days.filter((day) => Number.isFinite(day.count) && day.count >= 0).slice(-DAYS_IN_VIEW);

  if (days.length < 300) {
    if (existsSync(OUTPUT_SVG) && existsSync(OUTPUT_JSON)) {
      console.warn(`Only ${days.length} contribution days were available. Keeping the last generated assets.`);
      return;
    }
    throw new Error(`Could not retrieve enough GitHub contribution history (${days.length} days).`);
  }

  const stats = calculateStats(days);
  const generatedAt = new Date().toISOString();
  const data = {
    username: USERNAME,
    generatedAt,
    timezone: 'UTC',
    days,
    stats,
    breakdown: graphQl?.breakdown ?? null,
  };

  await mkdir(new URL('../assets/', import.meta.url), { recursive: true });
  await mkdir(new URL('../docs/', import.meta.url), { recursive: true });
  await writeFile(OUTPUT_JSON, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await writeFile(OUTPUT_SVG, `${buildSvg(days, stats, graphQl?.breakdown ?? null)}\n`, 'utf8');

  console.log(`Generated activity signal for ${USERNAME}: ${formatInt(stats.total)} contributions across ${days.length} days.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
