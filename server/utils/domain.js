// ============================================================================
// GDGoC Server Domain Logic & Shared Validation
// Self-contained implementation for standalone Docker & Cloud Deployments
// ============================================================================

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

export const PASSWORD_RULE = "8 to 72 characters, with a letter and a number.";

export const DEFAULT_ALLOWED_EMAIL_DOMAINS = ["psit.ac.in"];

export function getAllowedEmailDomains() {
  const envDomains = process.env.ALLOWED_EMAIL_DOMAINS || process.env.CAMPUS_EMAIL_DOMAINS;
  if (envDomains) {
    const list = envDomains
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);

    // In production, strictly reject any test domains (e.g. test.dev) even if mistakenly configured in env
    if (process.env.NODE_ENV === "production") {
      const filtered = list.filter((d) => !d.endsWith(".dev") && !d.includes("test"));
      return filtered.length > 0 ? filtered : DEFAULT_ALLOWED_EMAIL_DOMAINS;
    }
    return list;
  }

  // When running in non-production environments (e.g. automated test suites or development),
  // allow test.dev fixtures alongside the default campus domain if no custom list was specified
  if (process.env.NODE_ENV !== "production") {
    return ["psit.ac.in", "test.dev"];
  }

  return DEFAULT_ALLOWED_EMAIL_DOMAINS;
}

export function isAllowedCampusEmail(email, domains = getAllowedEmailDomains()) {
  const normalized = String(email ?? "")
    .trim()
    .toLowerCase();

  const parts = normalized.split("@");
  if (parts.length !== 2) return false;

  const domain = parts[1];
  return domains.some((allowed) => domain === allowed.toLowerCase());
}

const DEFAULT_EVENT_LENGTH_MS = 24 * 60 * 60 * 1000;

export function eventEndsAt(event) {
  if (event?.endsAt) {
    return new Date(event.endsAt);
  }
  return new Date(new Date(event.startsAt).getTime() + DEFAULT_EVENT_LENGTH_MS);
}

export function registrationDeadline(event) {
  if (event?.registrationDeadline) {
    return new Date(event.registrationDeadline);
  }
  return new Date(event.startsAt);
}

export function eventStatus(event, now = new Date()) {
  if (event.cancelled) {
    return "cancelled";
  }
  if (eventEndsAt(event) < now) {
    return "completed";
  }
  if (new Date(event.startsAt) <= now) {
    return "ongoing";
  }
  if (event.seatsLeft === 0) {
    return "full";
  }
  if (registrationDeadline(event) <= now) {
    return "closed";
  }
  return "open";
}

export function validateProfile(p) {
  const name = String(p?.name ?? "").trim();

  if (name.length < 2 || name.length > 60) {
    return "Name must be 2 to 60 characters.";
  }
  if (p.branch && !BRANCHES.includes(p.branch)) {
    return "Pick a branch from the list.";
  }
  if (p.year && !YEARS.includes(Number(p.year))) {
    return "Pick a year from the list.";
  }
  if ((p.bio ?? "").length > 280) {
    return "Bio must be 280 characters or fewer.";
  }
  return null;
}

export function passwordError(pw) {
  const str = String(pw ?? "");
  const badLength = str.length < 8 || str.length > 72;
  const missingLetter = !/[a-z]/i.test(str);
  const missingNumber = !/\d/.test(str);

  if (badLength || missingLetter || missingNumber) {
    return PASSWORD_RULE;
  }
  return null;
}

export function validatePassword(current, next, confirm) {
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

export function emailError(email) {
  const str = String(email ?? "").trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) && str.length <= 254;

  if (!valid) {
    return "Enter a valid email address.";
  }
  return null;
}

export function signupErrors(f, options = {}) {
  const errors = {};

  const name = validateProfile({ name: f.name });
  if (name) {
    errors.name = name;
  }

  const email = emailError(f.email);
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
  if (f.year && !YEARS.includes(Number(f.year))) {
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

export function safeNext(next) {
  if (next && /^\/[a-z]/i.test(next)) {
    return next;
  }
  return "/profile";
}

export const BANNER_THEMES = [
  "google-brand",
  "midnight-slate",
  "cyber-grid",
  "sunset-gradient",
  "emerald-code",
  "custom",
];

export const ACCENT_COLORS = ["gblue", "gred", "gyellow", "ggreen", "slate"];

export const CARD_THEMES = ["default", "dark", "minimal", "accent"];

export const SKILL_CATEGORIES = [
  "Programming",
  "Frontend",
  "Backend",
  "Databases",
  "Cloud & DevOps",
  "AI & ML",
  "Design",
  "Developer Tools",
  "Other",
];

export function isValidUrl(url) {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.length > 500) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateProjectInput(p) {
  if (!p || typeof p !== "object") {
    return "Invalid project data.";
  }
  const title = String(p.title ?? "").trim();
  if (title.length < 2 || title.length > 80) {
    return "Project title must be 2 to 80 characters.";
  }
  const desc = String(p.description ?? "").trim();
  if (desc.length > 280) {
    return "Project description must be 280 characters or fewer.";
  }
  if (p.techStack && !Array.isArray(p.techStack)) {
    return "Tech stack must be an array of tags.";
  }
  if (Array.isArray(p.techStack) && p.techStack.length > 10) {
    return "Maximum 10 technology tags per project.";
  }
  if (p.githubUrl && !isValidUrl(p.githubUrl)) {
    return "GitHub URL must be a valid http(s) URL.";
  }
  if (p.liveUrl && !isValidUrl(p.liveUrl)) {
    return "Live Demo URL must be a valid http(s) URL.";
  }
  if (p.imageUrl) {
    const imgStr = String(p.imageUrl).trim();
    const safeRelative =
      !imgStr.includes("..") &&
      /^\/(?:api(?:\/v\d+)?\/media\/[a-zA-Z0-9._-]+|uploads\/projects\/[a-zA-Z0-9._-]+)$/.test(imgStr);
    if (!safeRelative && !isValidUrl(imgStr)) {
      return "Project image URL must be a valid http(s) URL or uploaded project media path.";
    }
  }
  return null;
}

export function validateSkillsInput(skills) {
  if (!Array.isArray(skills)) {
    return "Skills must be an array.";
  }
  if (skills.length > 25) {
    return "Maximum 25 skills allowed.";
  }
  for (const s of skills) {
    if (!s || typeof s !== "object") {
      return "Invalid skill format.";
    }
    const name = String(s.name ?? "").trim();
    if (!name || name.length > 40) {
      return "Each skill name must be between 1 and 40 characters.";
    }
    if (s.category && String(s.category).length > 40) {
      return "Skill category must be 40 characters or fewer.";
    }
  }
  return null;
}

export function validateSocialsInput(socials) {
  if (!socials || typeof socials !== "object") return null;
  const keys = ["github", "linkedin", "portfolio", "website", "twitter"];
  for (const k of keys) {
    if (socials[k]) {
      const val = String(socials[k]).trim();
      if (val && !isValidUrl(val)) {
        return `${k.charAt(0).toUpperCase() + k.slice(1)} URL must be a valid http(s) URL.`;
      }
    }
  }
  return null;
}
