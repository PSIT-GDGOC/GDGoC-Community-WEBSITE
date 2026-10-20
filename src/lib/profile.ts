const API = import.meta.env?.VITE_API_URL ?? "/api";

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

export type Profile = {
  name: string;
  email: string;
  role?: string;
  branch?: string;
  year?: number;
  bio?: string;
  enrollmentNo?: string;
  createdAt?: string;
};

export type ProfileEdit = Pick<Profile, "name" | "branch" | "year" | "bio">;

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

export function signupErrors(f: Signup): Record<string, string> {
  const errors: Record<string, string> = {};

  const name = validateProfile({ name: f.name });
  if (name) {
    errors.name = name;
  }

  const email = emailError(f.email.trim());
  if (email) {
    errors.email = email;
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
  return "/profile";
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
