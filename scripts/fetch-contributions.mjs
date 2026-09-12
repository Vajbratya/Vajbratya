import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const login =
  process.env.PROFILE_USERNAME ??
  process.env.GITHUB_REPOSITORY_OWNER ??
  process.env.GITHUB_REPOSITORY?.split('/')[0];

if (!token) {
  throw new Error('Missing GH_TOKEN or GITHUB_TOKEN.');
}

if (!login) {
  throw new Error('Missing PROFILE_USERNAME.');
}

const output = new URL('../docs/data.json', import.meta.url);

const to = new Date();
to.setUTCHours(23, 59, 59, 999);

const from = new Date(to);
from.setUTCDate(from.getUTCDate() - 364);
from.setUTCHours(0, 0, 0, 0);

const query = `
  query ContributionData($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
              weekday
            }
          }
        }
        totalCommitContributions
        totalIssueContributions
        totalPullRequestContributions
        totalPullRequestReviewContributions
      }
    }
  }
`;

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    Authorization: `bearer ${token}`,
    'Content-Type': 'application/json',
    'User-Agent': 'github-flight-control',
  },
  body: JSON.stringify({
    query,
    variables: {
      login,
      from: from.toISOString(),
      to: to.toISOString(),
    },
  }),
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}\n${text}`);
}

const body = await response.json();

if (body.errors?.length) {
  throw new Error(
    `GitHub GraphQL returned errors:\n${body.errors.map((error) => error.message).join('\n')}`,
  );
}

const collection = body.data?.user?.contributionsCollection;

if (!collection) {
  throw new Error(`Could not load contributions for "${login}".`);
}

const fromDate = from.toISOString().slice(0, 10);
const toDate = to.toISOString().slice(0, 10);

const days = collection.contributionCalendar.weeks
  .flatMap((week) => week.contributionDays)
  .filter((day) => day.date >= fromDate && day.date <= toDate)
  .slice(-365)
  .map((day) => ({
    date: day.date,
    count: day.contributionCount,
    weekday: day.weekday,
  }));

if (days.length < 300) {
  throw new Error(`Expected at least 300 days. Got ${days.length}.`);
}

const payload = {
  login,
  range: {
    from: fromDate,
    to: toDate,
  },
  total: collection.contributionCalendar.totalContributions,
  breakdown: {
    commits: collection.totalCommitContributions,
    pullRequests: collection.totalPullRequestContributions,
    issues: collection.totalIssueContributions,
    reviews: collection.totalPullRequestReviewContributions,
  },
  days,
};

await mkdir(dirname(output.pathname), { recursive: true });
await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

console.log(`Saved ${days.length} contribution days for ${login}.`);
