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

export function signupErrors(f) {
  const errors = {};

  const name = validateProfile({ name: f.name });
  if (name) {
    errors.name = name;
  }

  const email = emailError(f.email);
  if (email) {
    errors.email = email;
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
