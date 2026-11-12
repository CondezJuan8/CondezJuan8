#!/usr/bin/env node
/**
 * Builds first-party SVG analytics for the CondezJuan8 GitHub profile.
 * Data source: GitHub GraphQL API + public Events REST API.
 * No external image/statistics service is used.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const USERNAME = process.env.GITHUB_USERNAME || "CondezJuan8";
const TOKEN = process.env.GITHUB_TOKEN;
const OUTPUT = resolve(process.env.OUTPUT_DIR || "assets/stats");
const API = "https://api.github.com/graphql";
const REST = "https://api.github.com";
const NOW = new Date();
const FROM = new Date(NOW.getTime() - 365 * 24 * 60 * 60 * 1000);
const COLORS = {
  bg: "#08080D", panel: "#101018", red: "#FF1744",
  purple: "#7B2CFF", neon: "#A855F7", white: "#FFFFFF",
  gray: "#A1A1AA", muted: "#666675", grid: "#252532"
};

function esc(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}
function compact(n) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
}
function dateOnly(d) { return d.toISOString().slice(0, 10); }
function svgShell(width, height, title, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">${esc(title)}</title><desc id="desc">Automatically generated GitHub analytics for ${esc(USERNAME)}.</desc>
<defs>
  <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${COLORS.red}"/><stop offset="1" stop-color="${COLORS.neon}"/></linearGradient>
  <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${COLORS.purple}" stop-opacity=".16"/><stop offset="1" stop-color="${COLORS.red}" stop-opacity=".04"/></linearGradient>
</defs>
<rect width="${width}" height="${height}" rx="18" fill="${COLORS.bg}"/>
<rect x=".5" y=".5" width="${width-1}" height="${height-1}" rx="17.5" fill="url(#wash)" stroke="${COLORS.grid}"/>
${body}
</svg>`;
}
function text(x, y, value, size = 14, fill = COLORS.white, weight = 400, extra = "") {
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="Inter,Segoe UI,Arial,sans-serif" font-size="${size}" font-weight="${weight}" ${extra}>${esc(value)}</text>`;
}
function metricCard(x, y, label, value, accent, width = 250) {
  return `<g><rect x="${x}" y="${y}" width="${width}" height="90" rx="12" fill="${COLORS.panel}" stroke="${COLORS.grid}"/>
    <rect x="${x}" y="${y}" width="3" height="90" rx="1.5" fill="${accent}"/>
    ${text(x+18,y+29,label.toUpperCase(),10,COLORS.gray,700,'letter-spacing="1.3"')}
    ${text(x+18,y+66,value,27,COLORS.white,700)}
  </g>`;
}
function calculateStreak(days) {
  const map = new Map(days.map(d => [d.date, d.contributionCount > 0]));
  const today = dateOnly(NOW);
  const yesterday = dateOnly(new Date(NOW.getTime() - 86400000));
  let cursor = map.get(today) ? NOW : new Date(NOW.getTime() - 86400000);
  let current = 0;
  while (map.get(dateOnly(cursor))) {
    current++;
    cursor = new Date(cursor.getTime() - 86400000);
  }
  let best = 0, run = 0;
  const sorted = [...days].sort((a,b) => a.date.localeCompare(b.date));
  for (const day of sorted) {
    if (day.contributionCount > 0) { run++; best = Math.max(best, run); }
    else run = 0;
  }
  return { current, best };
}
function renderOverview(data) {
  const { user, repos, contributions, recentEvents } = data;
  const totalStars = repos.reduce((s,r) => s + r.stargazerCount, 0);
  const totalForks = repos.reduce((s,r) => s + r.forkCount, 0);
  const { current, best } = calculateStreak(contributions.days);
  const cards = [
    metricCard(24,82,"Public repositories",compact(user.repositories.totalCount),COLORS.red,250),
    metricCard(286,82,"Total stars",compact(totalStars),COLORS.neon,250),
    metricCard(548,82,"Total forks",compact(totalForks),COLORS.red,250),
    metricCard(810,82,"Followers",compact(user.followers.totalCount),COLORS.neon,250),
    metricCard(24,188,"Contributions · 12 months",compact(contributions.totalContributions),COLORS.neon,250),
    metricCard(286,188,"Current streak",`${current} days`,COLORS.red,250),
    metricCard(548,188,"Best streak · 12 months",`${best} days`,COLORS.neon,250),
    metricCard(810,188,"Public events · 30 days",compact(recentEvents),COLORS.red,250)
  ].join("");
  const body = `
    ${text(26,38,`${USERNAME} / GITHUB ANALYTICS`,13,COLORS.gray,700,'letter-spacing="2"')}
    ${text(26,59,"LIVE PROFILE SNAPSHOT",10,COLORS.neon,600,'letter-spacing="1.5"')}
    ${cards}
    ${text(26,316,"TOP LANGUAGES BY CODE SIZE",11,COLORS.gray,700,'letter-spacing="1.4"')}
    ${renderLanguageBars(data.languages, 26, 340, 1034, 48)}
    ${text(26,420,`Updated ${NOW.toISOString().replace("T"," ").slice(0,16)} UTC · Public GitHub data`,10,COLORS.muted)}
  `;
  return svgShell(1084,444,"GitHub profile statistics",body);
}
function renderLanguageBars(languages, x, y, width, height) {
  const entries = languages.slice(0,6);
  const total = entries.reduce((s,l) => s + l.size, 0) || 1;
  if (!entries.length) return text(x,y+18,"No public language data available",12,COLORS.gray);
  const colors = ["#A855F7","#FF1744","#7B2CFF","#E879F9","#F97316","#38BDF8"];
  let offset = 0;
  let out = `<rect x="${x}" y="${y}" width="${width}" height="9" rx="4.5" fill="${COLORS.grid}"/>`;
  for (let i=0;i<entries.length;i++) {
    const w = width * entries[i].size / total;
    out += `<rect x="${x+offset}" y="${y}" width="${Math.max(0,w)}" height="9" fill="${colors[i%colors.length]}"/>`;
    offset += w;
  }
  let lx = x;
  for (let i=0;i<entries.length;i++) {
    const item = entries[i];
    const label = `${item.name} ${((item.size/total)*100).toFixed(1)}%`;
    out += `<circle cx="${lx+5}" cy="${y+30}" r="4" fill="${colors[i%colors.length]}"/>`;
    out += text(lx+14,y+34,label,10,COLORS.gray,500);
    lx += Math.min(180, Math.max(110, label.length*6.2+25));
    if (lx > x+width-100) break;
  }
  return out;
}
function renderContributions(data) {
  const days = data.contributions.days;
  const max = Math.max(1, ...days.map(d => d.contributionCount));
  const cell = 12, gap = 3, left = 42, top = 86;
  const weeks = [];
  for (let i=0;i<days.length;i+=7) weeks.push(days.slice(i,i+7));
  const palette = ["#191923","#3B1B50","#63227D","#9230A8","#D14BD1"];
  let cells = "";
  weeks.forEach((week, wi) => week.forEach((day, di) => {
    const level = day.contributionCount === 0 ? 0 : Math.min(4,Math.ceil(day.contributionCount/max*4));
    const x = left + wi*(cell+gap), y = top + di*(cell+gap);
    cells += `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${palette[level]}" stroke="#FFFFFF" stroke-opacity=".04"><title>${esc(day.date)}: ${day.contributionCount} contributions</title></rect>`;
  }));
  const monthLabels = [];
  weeks.forEach((week, wi) => {
    const first = week[0];
    if (first && new Date(`${first.date}T00:00:00Z`).getUTCDate() <= 7) {
      const label = new Date(`${first.date}T00:00:00Z`).toLocaleString("en",{month:"short",timeZone:"UTC"});
      monthLabels.push(text(left+wi*(cell+gap),68,label,10,COLORS.gray));
    }
  });
  const body = `
    ${text(26,34,`${USERNAME} / CONTRIBUTION HISTORY`,13,COLORS.gray,700,'letter-spacing="2"')}
    ${text(26,56,`${compact(data.contributions.totalContributions)} contributions in the last 12 months`,11,COLORS.neon,500)}
    ${monthLabels.join("")}
    ${text(12,top+24,"Mon",9,COLORS.muted)}${text(12,top+54,"Wed",9,COLORS.muted)}${text(12,top+84,"Fri",9,COLORS.muted)}
    ${cells}
    ${text(42,top+7*(cell+gap)+16,"Less",9,COLORS.gray)}
    ${palette.map((c,i)=>`<rect x="${76+i*17}" y="${top+7*(cell+gap)+4}" width="11" height="11" rx="2" fill="${c}"/>`).join("")}
    ${text(170,top+7*(cell+gap)+14,"More",9,COLORS.gray)}
    ${text(26,top+7*(cell+gap)+38,`Updated ${NOW.toISOString().slice(0,10)} · GitHub contribution calendar`,9,COLORS.muted)}
  `;
  return svgShell(900,250,"GitHub contribution calendar",body);
}
function renderActivity(data) {
  const days = data.contributions.days.slice(-180);
  const byDate = new Map(days.map(d => [d.date,d.contributionCount]));
  const max = Math.max(1,...days.map(d=>d.contributionCount));
  const points = days.map((d,i) => {
    const x = 38 + (i/Math.max(1,days.length-1))*1000;
    const y = 250 - (d.contributionCount/max)*170;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const area = `38,250 ${points} 1038,250`;
  const body = `
    ${text(26,36,`${USERNAME} / ACTIVITY TREND`,13,COLORS.gray,700,'letter-spacing="2"')}
    ${text(26,58,"Daily public contributions · Last 180 days",11,COLORS.neon)}
    ${[80,135,190,250].map(y=>`<line x1="38" y1="${y}" x2="1038" y2="${y}" stroke="${COLORS.grid}" stroke-dasharray="3 6"/>`).join("")}
    <polygon points="${area}" fill="${COLORS.purple}" opacity=".18"/>
    <polyline points="${points}" fill="none" stroke="url(#accent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${text(38,282,"180 days ago",10,COLORS.gray)}
    ${text(970,282,"Today",10,COLORS.gray)}
    ${text(26,316,`Total contributions in period: ${compact(days.reduce((s,d)=>s+d.contributionCount,0))}`,10,COLORS.muted)}
  `;
  return svgShell(1070,340,"GitHub activity graph",body);
}

async function githubGraphQL(query) {
  const response = await fetch(API, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
      "User-Agent": "Condez-GitHub-Profile-Stats"
    },
    body: JSON.stringify({ query })
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) {
    throw new Error(`GitHub GraphQL error: ${JSON.stringify(payload.errors || payload)}`);
  }
  return payload.data;
}
async function githubRest(path) {
  const response = await fetch(`${REST}${path}`, {
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "Condez-GitHub-Profile-Stats"
    }
  });
  if (!response.ok) throw new Error(`GitHub REST ${response.status}: ${await response.text()}`);
  return response.json();
}

async function main() {
  if (!TOKEN) throw new Error("GITHUB_TOKEN is required. Run through the GitHub Actions workflow.");
  const from = FROM.toISOString(), to = NOW.toISOString();
  const query = `query {
    user(login: "${USERNAME}") {
      login
      followers { totalCount }
      repositories(first: 100, ownerAffiliations: OWNER, privacy: PUBLIC) {
        totalCount
        nodes {
          name
          isFork
          stargazerCount
          forkCount
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges { size node { name } }
          }
        }
      }
      contributionsCollection(from: "${from}", to: "${to}") {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalRepositoryContributions
        contributionCalendar {
          totalContributions
          weeks { contributionDays { date contributionCount } }
        }
      }
    }
  }`;
  const data = await githubGraphQL(query);
  const user = data.user;
  if (!user) throw new Error(`GitHub user ${USERNAME} was not found.`);
  const repos = user.repositories.nodes.filter(repo => !repo.isFork);
  const languageMap = new Map();
  for (const repo of repos) {
    for (const edge of repo.languages.edges) {
      languageMap.set(edge.node.name, (languageMap.get(edge.node.name) || 0) + edge.size);
    }
  }
  const languages = [...languageMap.entries()]
    .map(([name,size]) => ({name,size}))
    .sort((a,b)=>b.size-a.size);
  const calendar = user.contributionsCollection.contributionCalendar;
  const days = calendar.weeks.flatMap(w => w.contributionDays);
  const events = await githubRest(`/users/${USERNAME}/events/public?per_page=100`);
  const cutoff = NOW.getTime() - 30*24*60*60*1000;
  const recentEvents = events.filter(e => new Date(e.created_at).getTime() >= cutoff).length;
  const payload = {
    user, repos, languages,
    contributions: { totalContributions: calendar.totalContributions, days },
    recentEvents
  };
  await mkdir(OUTPUT,{recursive:true});
  const files = {
    "overview.svg": renderOverview(payload),
    "contributions.svg": renderContributions(payload),
    "activity.svg": renderActivity(payload)
  };
  for (const [name,content] of Object.entries(files)) {
    const path = resolve(OUTPUT,name);
    await mkdir(dirname(path),{recursive:true});
    await writeFile(path,content,"utf8");
    console.log(`Generated ${path}`);
  }
}
main().catch(error => { console.error(error); process.exit(1); });
