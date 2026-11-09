const API = import.meta.env?.VITE_API_URL ?? "/api";

export function safeExternalUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = String(url).trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export function resolveImageUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const apiBase = typeof import.meta !== "undefined" ? import.meta.env?.VITE_API_URL : undefined;
  if (apiBase && (apiBase.startsWith("http://") || apiBase.startsWith("https://"))) {
    const origin = apiBase.replace(/\/api(\/v\d+)?\/?$/, "");
    return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
  }
  return url;
}

export const BRANCHES = [
  "CSE",
  "CSE (AI & ML)",
  "CSE (Data Science)",
  "CS",
  "IT",
  "ECE",
  "EEE",
  "ME",
  "Civil",
  "Other",
];
export const YEARS = [1, 2, 3, 4];

export const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["psit.ac.in"];

export function getAllowedEmailDomains(): string[] {
  const envDomains = typeof import.meta !== "undefined" && import.meta.env?.VITE_ALLOWED_EMAIL_DOMAINS;
  if (envDomains) {
    return envDomains
      .split(",")
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  return DEFAULT_ALLOWED_EMAIL_DOMAINS;
}

export function isAllowedCampusEmail(
  email: string,
  domains: string[] = getAllowedEmailDomains()
): boolean {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();

  const parts = normalized.split("@");
  if (parts.length !== 2) return false;

  const domain = parts[1];
  return domains.some((allowed) => domain === allowed.toLowerCase());
}

export type SkillItem = {
  name: string;
  category: string;
};

export type ProjectItem = {
  id?: string;
  _id?: string;
  title: string;
  description: string;
  techStack: string[];
  githubUrl?: string;
  liveUrl?: string;
  imageUrl?: string | null;
  featured?: boolean;
  order?: number;
  createdAt?: string;
};

export type SocialLinks = {
  github?: string;
  linkedin?: string;
  portfolio?: string;
  website?: string;
  twitter?: string;
};

export type ProfilePrivacy = {
  showEmail?: boolean;
  showAttendance?: boolean;
  showProjects?: boolean;
};

export type BannerTheme =
  | "google-brand"
  | "midnight-slate"
  | "cyber-grid"
  | "sunset-gradient"
  | "emerald-code"
  | "custom";

export type AccentColor = "gblue" | "gred" | "gyellow" | "ggreen" | "slate";

export type CardTheme = "default" | "dark" | "minimal" | "accent";

export type Profile = {
  id?: string;
  _id?: string;
  name: string;
  email?: string;
  role?: "student" | "admin";
  branch?: string;
  year?: number;
  bio?: string;
  enrollmentNo?: string;
  avatarUrl?: string | null;
  emailVerified?: boolean;
  emailVerifiedAt?: string | null;
  memberVerified?: boolean;
  memberVerifiedAt?: string | null;
  headline?: string;
  college?: string;
  specialization?: string;
  bannerTheme?: BannerTheme;
  bannerUrl?: string | null;
  accentColor?: AccentColor;
  cardTheme?: CardTheme;
  socials?: SocialLinks;
  skills?: SkillItem[];
  projects?: ProjectItem[];
  privacy?: ProfilePrivacy;
  createdAt?: string;
  updatedAt?: string;
};

export type ProfileEdit = {
  name: string;
  branch?: string;
  year?: number;
  bio?: string;
  headline?: string;
  college?: string;
  specialization?: string;
  bannerTheme?: BannerTheme;
  accentColor?: AccentColor;
  cardTheme?: CardTheme;
  socials?: SocialLinks;
  skills?: SkillItem[];
  privacy?: ProfilePrivacy;
};

export const BANNER_THEMES: { id: BannerTheme; label: string; desc: string }[] = [
  { id: "google-brand", label: "Google Brand", desc: "Dynamic 4-color stripe & geometric neo-brutalist blocks" },
  { id: "midnight-slate", label: "Midnight Slate", desc: "Dark aerospace obsidian with technical grid lines" },
  { id: "cyber-grid", label: "Cyber Matrix", desc: "Retro-futuristic dot matrix with blueprint markers" },
  { id: "sunset-gradient", label: "Warm Solar", desc: "Warm energetic gradient with sunset glow" },
  { id: "emerald-code", label: "Emerald Code", desc: "Modern developer terminal mint & forest accents" },
  { id: "custom", label: "Custom Banner", desc: "Upload your personal header artwork or banner" },
];

export const ACCENT_COLORS: { id: AccentColor; label: string; bg: string }[] = [
  { id: "gblue", label: "Google Blue", bg: "#4285F4" },
  { id: "gred", label: "Google Red", bg: "#EA4335" },
  { id: "gyellow", label: "Google Yellow", bg: "#FBBC04" },
  { id: "ggreen", label: "Google Green", bg: "#34A853" },
  { id: "slate", label: "Dark Slate", bg: "#202124" },
];

export const CARD_THEMES: { id: CardTheme; label: string }[] = [
  { id: "default", label: "Standard Brand" },
  { id: "dark", label: "Obsidian Noir" },
  { id: "minimal", label: "Clean Minimalist" },
  { id: "accent", label: "Accent Highlight" },
];

export const CURATED_SKILLS: Record<string, string[]> = {
  Programming: ["TypeScript", "JavaScript", "Python", "Java", "C++", "C", "Go", "Rust", "Kotlin", "Swift"],
  Frontend: ["React", "Next.js", "Vue.js", "Svelte", "Tailwind CSS", "HTML5", "CSS3", "Redux", "Three.js"],
  Backend: ["Node.js", "Express", "FastAPI", "Django", "Spring Boot", "GraphQL", "NestJS", "Fastify"],
  Databases: ["MongoDB", "PostgreSQL", "MySQL", "Redis", "Supabase", "Firebase", "SQLite"],
  "Cloud & DevOps": ["Google Cloud (GCP)", "AWS", "Docker", "Kubernetes", "CI/CD", "Git", "Linux", "Vercel"],
  "AI & ML": ["TensorFlow", "PyTorch", "Scikit-Learn", "OpenCV", "LangChain", "Hugging Face", "NLP", "LLMs"],
  Design: ["Figma", "UI/UX Design", "Design Systems", "Canva", "Responsive Design", "Wireframing"],
  "Developer Tools": ["VS Code", "Postman", "Vite", "Webpack", "Vitest", "Jest", "GitHub Actions", "Docker"],
};

export function calculateProfileCompletion(user: Profile): {
  percentage: number;
  completedTasks: string[];
  remainingTasks: string[];
} {
  const tasks = [
    { name: "Full name provided", done: Boolean(user.name?.trim()) },
    { name: "Professional headline", done: Boolean(user.headline?.trim()) },
    { name: "Biography written", done: Boolean(user.bio?.trim()) },
    { name: "Profile photo uploaded", done: Boolean(user.avatarUrl) },
    { name: "Branch & academic year", done: Boolean(user.branch && user.year) },
    { name: "At least 3 technical skills", done: Boolean(user.skills && user.skills.length >= 3) },
    {
      name: "At least 1 social link",
      done: Boolean(
        user.socials &&
          (user.socials.github || user.socials.linkedin || user.socials.portfolio || user.socials.website)
      ),
    },
    { name: "At least 1 featured project", done: Boolean(user.projects && user.projects.length >= 1) },
  ];

  const completed = tasks.filter((t) => t.done);
  const remaining = tasks.filter((t) => !t.done);
  const percentage = Math.round((completed.length / tasks.length) * 100);

  return {
    percentage,
    completedTasks: completed.map((t) => t.name),
    remainingTasks: remaining.map((t) => t.name),
  };
}

export function validateProfile(p: ProfileEdit): string | null {
  const name = p.name.trim();

  if (name.length < 2 || name.length > 60) {
    return "Name must be 2 to 60 characters.";
  }
  if (p.branch && !BRANCHES.includes(p.branch)) {
    return "Pick a branch from the list.";
  }
  if (p.year && !YEARS.includes(p.year)) {
    return "Pick a year from the list.";
  }
  if ((p.bio ?? "").length > 280) {
    return "Bio must be 280 characters or fewer.";
  }
  return null;
}

export const PASSWORD_RULE = "8 to 72 characters, with a letter and a number.";

export function passwordError(pw: string): string | null {
  const badLength = pw.length < 8 || pw.length > 72;
  const missingLetter = !/[a-z]/i.test(pw);
  const missingNumber = !/\d/.test(pw);

  if (badLength || missingLetter || missingNumber) {
    return PASSWORD_RULE;
  }
  return null;
}

export function validatePassword(current: string, next: string, confirm: string): string | null {
  if (!current) {
    return "Enter your current password.";
  }
  if (passwordError(next)) {
    return PASSWORD_RULE;
  }
  if (next === current) {
    return "New password must differ from the current one.";
  }
  if (next !== confirm) {
    return "Passwords do not match.";
  }
  return null;
}

export function emailError(email: string): string | null {
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;

  if (!valid) {
    return "Enter a valid email address.";
  }
  return null;
}

export type Signup = {
  name: string;
  email: string;
  password: string;
  confirm: string;
  branch: string;
  year?: number;
};

export function signupErrors(
  f: Signup,
  options?: { requireCampusEmail?: boolean; allowedDomains?: string[] } | string[]
): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = validateProfile({ name: f.name });
  if (name) {
    errors.name = name;
  }

  const email = emailError(f.email.trim());
  if (email) {
    errors.email = email;
  } else if (
    options &&
    typeof options === "object" &&
    !Array.isArray(options) &&
    options.requireCampusEmail &&
    !isAllowedCampusEmail(f.email, options.allowedDomains)
  ) {
    errors.email = "Please use your official PSIT campus email address.";
  }

  if (f.branch && !BRANCHES.includes(f.branch)) {
    errors.branch = "Pick a branch from the list.";
  }
  if (f.year && !YEARS.includes(f.year)) {
    errors.year = "Pick a year from the list.";
  }

  const password = passwordError(f.password);
  if (password) {
    errors.password = password;
  } else if (f.password !== f.confirm) {
    errors.confirm = "Passwords do not match.";
  }

  return errors;
}

export function safeNext(next: string | null): string {
  if (next && /^\/[a-z]/i.test(next)) {
    return next;
  }
  return "/dashboard";
}

export async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(API + path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => {
    throw new Error("Can't reach the server. Check your connection and try again.");
  });

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && path !== "/auth/login") {
    throw new Error("401");
  }
  if (!res.ok) {
    const error = new Error(data.message || "Something went wrong. Try again.");
    throw Object.assign(error, { errors: data.errors });
  }
  return data as T;
}
