export type GColor = "gblue" | "gred" | "gyellow" | "ggreen";

/* The Google four: blue · red · yellow · green.
   This object is the JS-side token surface for the four brand hues;
   src/index.css mirrors the same values in its @theme block. */
export const COLOR_HEX: Record<GColor, string> = {
  gblue: "#4285F4",
  gred: "#EA4335",
  gyellow: "#FBBC05",
  ggreen: "#34A853",
};

/* Neutral ink values, mirroring --color-ink / --color-line2 in src/index.css.
   Used by the WebGL scene, which cannot read CSS custom properties. */
export const INK = "#202124";
export const INK_SOFT = "#BDC1C6";

/* Text colour that is legible on a block of each accent colour.
   Ink passes AA on blue (4.5:1), yellow (9.4:1) and green (5.3:1).
   On red, ink is 4.1:1 — large or bold text only, otherwise the red
   block takes a tint sub-panel (see PANEL_HEX below). */
export const ON_COLOR: Record<GColor, string> = {
  gblue: INK,
  gred: INK,
  gyellow: INK,
  ggreen: INK,
};

/* Section washes / tints — mirror --color-wash-* in src/index.css. */
export const WASH_HEX: Record<GColor, string> = {
  gblue: "#E8F0FE",
  gred: "#FCE8E6",
  gyellow: "#FEF7E0",
  ggreen: "#E6F4EA",
};

/* Fill for an accent block that carries body copy. Blue, yellow and green
   are AA-legible with ink. Red is not (ink 4.1:1, white 3.9:1), so it
   falls back to its wash with a bright red edge — the tint-panel rule. */
export const PANEL_HEX: Record<GColor, string> = {
  gblue: "#4285F4",
  gred: "#FCE8E6",
  gyellow: "#FBBC04",
  ggreen: "#34A853",
};

/* Border/edge colour that keeps a tinted panel identifiable as red. */
export const PANEL_EDGE: Record<GColor, string> = {
  gblue: "#4285F4",
  gred: "#EA4335",
  gyellow: "#FBBC04",
  ggreen: "#34A853",
};

/* ------------------------------------------------------------------ */
/*  HACKTOBER — the flagship event (formerly Hacktober)                */
/*  Dates and status come from src/lib/oso.ts, the single source.      */
/*  Copy below is DRAFT — pending club approval (see ROBOT_HERO_REPORT).*/
/* ------------------------------------------------------------------ */

import { OSO } from "../lib/oso";

export const HACKTOBER = {
  name: "Open Source October",
  dates: OSO.dates,
  startISO: OSO.startISO,
  tagline: "24 days of open source. One campus-wide commit history.",
  intro:
    "Open Source October, formerly Hacktober, runs all month. Contributions stay open from October 8 through October 31, 2026. Pick an issue, open a pull request, and add your name to the campus commit history.",
  chips: ["Oct 8 to Oct 31, 2026", "Month-long", "Open contributions"],
};

/* ------------------------------------------------------------------ */
/*  Campus board — pinned notices                                      */
/* ------------------------------------------------------------------ */

export interface Notice {
  color: GColor;
  title: string;
  body: string;
  pinnedBy: string;
  date: string;
  link?: { label: string; target: string };
}

export const NOTICES: Notice[] = [
  {
    color: "gyellow",
    title: "Open Source October wrapped",
    body: "24 days, 140+ merged PRs. Huge thanks to all contributors and mentors. Check the event log for the wrap-up.",
    pinnedBy: "Events lead",
    date: "Nov 01",
    link: { label: "See the log", target: "events" },
  },
  {
    color: "gblue",
    title: "Weekly dev meetup",
    body: "Every Friday, 5 PM, Block C lab. Bring a laptop and exactly one bug you can't figure out.",
    pinnedBy: "Chapter lead",
    date: "every Fri",
  },
  {
    color: "ggreen",
    title: "First PR? We got you",
    body: "Drop your repo in #hacktober-help on Discord. A mentor reviews it within 24 hours, promise.",
    pinnedBy: "OSS lead",
    date: "always on",
  },
  {
    color: "gred",
    title: "DevFest watch party recap",
    body: "200+ attendees, 3 watch-along sessions, one very loud keynote reaction. Swag drop for top 50 contributors.",
    pinnedBy: "Community",
    date: "Dec 14",
    link: { label: "See the log", target: "events" },
  },
  {
    color: "gblue",
    title: "Design track portfolio reviews",
    body: "DM the design lead with your Figma link. Two slots open every week, first come first served.",
    pinnedBy: "Design lead",
    date: "weekly",
  },
];

export const UPCOMING = [
  { date: "Nov 07", label: "Android office hours", color: "ggreen" as GColor },
  { date: "Nov 21", label: "Cloud Study Jam #3", color: "gblue" as GColor },
  { date: "Dec 14", label: "DevFest watch party", color: "gred" as GColor },
  { date: "Jan 16", label: "Winter Code Sprint", color: "gyellow" as GColor },
];

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */

export const STATS = [
  { value: 250, suffix: "+", label: "Active members", color: "gblue" as GColor },
  { value: 18, suffix: "", label: "Events hosted", color: "gred" as GColor },
  { value: 40, suffix: "+", label: "Projects shipped", color: "gyellow" as GColor },
  { value: 12, suffix: "", label: "Mentors on deck", color: "ggreen" as GColor },
];

/* ------------------------------------------------------------------ */
/*  About pillars                                                      */
/* ------------------------------------------------------------------ */

export const PILLARS = [
  {
    index: "01",
    color: "gblue" as GColor,
    title: "Learn",
    body: "Study jams, bootcamps and zero-to-hero tracks. We run hands-on sessions on web, Android, cloud and GenAI - no slide-deck lectures, you ship something every single session.",
  },
  {
    index: "02",
    color: "gred" as GColor,
    title: "Connect",
    body: "Weekly dev meetups, DevFest watch parties and campus collabs. The point is simple: the person stuck on the same bug as you sits two rows away. We fix that.",
  },
  {
    index: "03",
    color: "gyellow" as GColor,
    title: "Build",
    body: "Open Source October, semester sprints and open-source Fridays. Real builds, real deadlines, real code reviews from mentors who have shipped for a living.",
  },
  {
    index: "04",
    color: "ggreen" as GColor,
    title: "Grow",
    body: "Mentorship circles, mock interviews, portfolio reviews and referrals into the wider developer community across India. Your first dev job starts here.",
  },
];

/* ------------------------------------------------------------------ */
/*  Domains — stacked cards                                            */
/* ------------------------------------------------------------------ */

export interface Domain {
  color: GColor;
  title: string;
  blurb: string;
  tools: string[];
  detail: string;
  icon: "web" | "android" | "cloud" | "ai" | "design" | "oss";
}

export const DOMAINS: Domain[] = [
  {
    color: "gblue",
    title: "Web",
    blurb: "Fast interfaces, honest performance budgets and deploys on Fridays anyway. The web track ships a public URL for everything it touches.",
    tools: ["React", "Next.js", "TypeScript", "Firebase"],
    detail: "Meets Fridays 5 PM · open to every year",
    icon: "web",
  },
  {
    color: "ggreen",
    title: "Android & Mobile",
    blurb: "Kotlin-first, Compose-everywhere. From campus utility apps to offline-ready tools that survive hostel Wi-Fi.",
    tools: ["Kotlin", "Jetpack Compose", "Flutter"],
    detail: "Device lab in Block C · monthly build-alongs · Kotlin from zero",
    icon: "android",
  },
  {
    color: "gyellow",
    title: "Cloud & Infra",
    blurb: "GCP study jams, Firebase backends and Docker nights. Learn to ship, scale and not cry at a billing dashboard.",
    tools: ["Google Cloud", "Firebase", "Docker"],
    detail: "Skill-badge sprints every month · free lab credits for members",
    icon: "cloud",
  },
  {
    color: "gred",
    title: "AI / ML & GenAI",
    blurb: "LLM apps, vision experiments and fine-tuning labs. Less hype, more working demos that solve campus problems.",
    tools: ["Vertex AI", "TensorFlow", "LangChain"],
    detail: "GPU hours booked for members · paper-reading circle, biweekly",
    icon: "ai",
  },
  {
    color: "gblue",
    title: "UI/UX & Design",
    blurb: "Design systems, Figma workflows and portfolio reviews. Developers who design, designers who ship.",
    tools: ["Figma", "Design systems", "Prototyping"],
    detail: "Two portfolio review slots weekly · DM the design lead",
    icon: "design",
  },
  {
    color: "ggreen",
    title: "Open Source",
    blurb: "First-PR nights, good-first-issue hunts and GSoC prep. Your commit history is your resume - we help you start it.",
    tools: ["Git", "GitHub", "GSoC"],
    detail: "PR reviews within 24h · GSoC prep circle starts January",
    icon: "oss",
  },
];

/* ------------------------------------------------------------------ */
/*  Past events log                                                    */
/* ------------------------------------------------------------------ */

export interface PastEvent {
  title: string;
  tag: string;
  color: GColor;
  date: string;
  turnout: string;
  note: string;
  detail: string;
  image: string;
}

export const EVENTS: PastEvent[] = [
  {
    title: "Open Source October",
    tag: "Open Source",
    color: "ggreen",
    date: "Oct 08 – 31, 2026",
    turnout: "180+ devs",
    note: "Month-long contribution drive. 24 days of open source, good-first-issues and community PRs.",
    detail: "Outcome: 142 pull requests merged across campus and open source repos.",
    image:
      "https://images.pexels.com/photos/1181263/pexels-photo-1181263.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "Git & GitHub Bootcamp",
    tag: "Workshop",
    color: "gblue",
    date: "Aug 22, 2026",
    turnout: "120 devs",
    note: "From git init to a merged PR in three hours. Branches, conflicts, rebases - demystified live.",
    detail: "Outcome: 74 first commits pushed before the session ended.",
    image:
      "https://images.pexels.com/photos/16070143/pexels-photo-16070143.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "GenAI Study Jam",
    tag: "Study Jam",
    color: "gred",
    date: "Jul 18, 2026",
    turnout: "90 devs",
    note: "Prompting, RAG and a live Vertex AI walkthrough - everyone left with a working chatbot.",
    detail: "Outcome: 61 skill badges claimed in one sitting.",
    image:
      "https://images.pexels.com/photos/29627312/pexels-photo-29627312.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "First-PR Night",
    tag: "Open Source",
    color: "ggreen",
    date: "Feb 06, 2026",
    turnout: "60 devs",
    note: "Mentors on speed-dial, zero judgement. Squashing the fear of the green button.",
    detail: "Outcome: 41 pull requests merged before midnight.",
    image:
      "https://images.pexels.com/photos/5380607/pexels-photo-5380607.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "DevFest Watch Party",
    tag: "Community",
    color: "gyellow",
    date: "Dec 14, 2025",
    turnout: "200 devs",
    note: "Keynotes on the big screen, live reactions, swag drop for the top contributors of the semester.",
    detail: "Outcome: biggest room we've ever filled - auditorium at capacity.",
    image:
      "https://images.pexels.com/photos/8199151/pexels-photo-8199151.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "Cloud Study Jam",
    tag: "Study Jam",
    color: "gblue",
    date: "Nov 08, 2025",
    turnout: "75 devs",
    note: "GCP skill badges, Firebase backends and one gloriously over-engineered hello-world.",
    detail: "Outcome: 48 badges, 3 Firebase apps deployed to production.",
    image:
      "https://images.pexels.com/photos/19895774/pexels-photo-19895774.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
  {
    title: "Android Dev 101",
    tag: "Workshop",
    color: "ggreen",
    date: "Sep 27, 2025",
    turnout: "85 devs",
    note: "Kotlin basics to a working Compose UI - the 'hello campus' app is still on half our phones.",
    detail: "Outcome: 85 APKs sideloaded by 7 PM the same day.",
    image:
      "https://images.pexels.com/photos/6804068/pexels-photo-6804068.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=627&w=1200",
  },
];

/* The hero ticker shows real event names, derived from the event log and
   the upcoming calendar so the list can never drift from the data. */
export const MARQUEE_WORDS: string[] = [
  ...EVENTS.map((e) => e.title),
  ...UPCOMING.map((u) => u.label),
];

/* The community lines are the chapter's own sentences — the hero copy
   already says the crew "learns in public, builds loudly and ships open
   source" — restated as the six things the community actually does. No
   counts, no dates, no claims that are not already on the page. */
export const TICKER_COMMUNITY_LINES: string[] = [
  "Learn in public",
  "Build together",
  "Ship open source",
  "Explore new technologies",
  "Turn ideas into projects",
  "Share what we learn",
];

/* One interleaved rail: a community line, then a real item from the event
   log or the upcoming calendar, and so on. Colours cycle the Google four
   so the rail carries the brand without decorating every word. */
export const TICKER_LINES: { text: string; color: GColor }[] = (() => {
  const rail: { text: string; color: GColor }[] = [];
  const colors: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
  const real = MARQUEE_WORDS;
  const max = Math.max(TICKER_COMMUNITY_LINES.length, real.length);
  for (let i = 0; i < max; i++) {
    const community = TICKER_COMMUNITY_LINES[i % TICKER_COMMUNITY_LINES.length];
    if (i < TICKER_COMMUNITY_LINES.length) {
      rail.push({ text: community.toUpperCase(), color: colors[rail.length % 4] });
    }
    if (i < real.length) rail.push({ text: real[i], color: colors[rail.length % 4] });
  }
  return rail;
})();

export const SOCIAL_LINKS: { label: string; href: string; color: GColor }[] = [
  { label: "gdg.community.dev", href: "https://gdg.community.dev", color: "gblue" },
  { label: "Instagram", href: "https://www.instagram.com/gdgoc.psit", color: "gred" },
  { label: "GitHub", href: "https://github.com/PSIT-GDGOC", color: "ggreen" },
];
