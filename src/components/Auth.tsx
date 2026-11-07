import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { button, input } from "./Profile";
import { SuitGlyph, SUIT_FOR } from "./ui";
import { COLOR_HEX, type GColor } from "../data/content";
import {
  api,
  BRANCHES,
  emailError,
  passwordError,
  PASSWORD_RULE,
  safeNext,
  signupErrors,
  YEARS,
  type Signup,
} from "../lib/profile";

export type Mode = "login" | "signup" | "forgot" | "reset";

const DECK: { word: string; color: GColor }[] = [
  { word: "Learn", color: "gblue" },
  { word: "Connect", color: "gred" },
  { word: "Build", color: "gyellow" },
  { word: "Grow", color: "ggreen" },
];

const FAN = [
  { x: -150, y: 26, rotate: -14 },
  { x: -52, y: 4, rotate: -5 },
  { x: 52, y: 4, rotate: 5 },
  { x: 150, y: 26, rotate: 14 },
];

function DeckPanel({ mode }: { mode: Mode }) {
  let heading = "Welcome back to the deck.";
  let desc = "Log in for your tickets, your member card and whatever is next on the board.";

  if (mode === "signup") {
    heading = "Draw your first card.";
    desc = "One account gets you event registration, QR tickets for the door and your own member card.";
  } else if (mode === "forgot") {
    heading = "Recover your key.";
    desc = "Enter your registered email address to receive a secure password recovery link.";
  } else if (mode === "reset") {
    heading = "Secure your account.";
    desc = "Choose a strong new password to regain access to your member area.";
  }

  return (
    <section className="lg:order-1">
      <p className="font-mono text-xs font-semibold tracking-[0.25em] text-muted uppercase">GDGoC PSIT · Member area</p>
      <h2 className="mt-4 text-h2 heading-shadow heading-shadow-yellow">{heading}</h2>
      <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink/80">{desc}</p>

      <div className="relative mx-auto mt-14 h-56 w-full max-w-md [--spread:0.55px] sm:h-64 sm:[--spread:1px]" aria-hidden="true">
        {DECK.map((card, i) => (
          <div
            key={card.word}
            className="deck-card absolute top-0 left-1/2 flex aspect-[5/7] w-24 flex-col items-center justify-center gap-2 border-[3px] border-ink text-ink shadow-[6px_6px_0_var(--color-ink)] sm:w-32"
            style={{
              background: COLOR_HEX[card.color],
              transform: `translateX(calc(-50% + ${FAN[i].x} * var(--spread))) translateY(${FAN[i].y}px) rotate(${FAN[i].rotate}deg)`,
            }}
          >
            <span className="absolute top-2 left-2.5 font-display text-xs font-extrabold">0{i + 1}</span>
            <SuitGlyph suit={SUIT_FOR[card.color]} size={36} />
            <span className="font-display text-sm font-extrabold">{card.word}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

const EMPTY: Signup = { name: "", email: "", password: "", confirm: "", branch: "", year: undefined };

function Field({
  name,
  label,
  hint,
  error,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  children: (a: object) => ReactNode;
}) {
  const describedBy = [hint && `${name}-hint`, error && `${name}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={name} className="text-sm font-bold">
        {label}
      </label>
      <div className="mt-1">
        {children({ id: name, name, "aria-invalid": !!error, "aria-describedby": describedBy })}
      </div>
      {hint && (
        <p id={`${name}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${name}-err`} className="mt-1 text-sm font-bold text-gred">
          {error}
        </p>
      )}
    </div>
  );
}

function getInitialMode(): Mode {
  const hash = typeof location !== "undefined" ? location.hash : "";
  const path = hash.split("?")[0];
  const params = new URLSearchParams(hash.split("?")[1] || "");
  if (path === "#/forgot-password" || params.get("mode") === "forgot") {
    return "forgot";
  }
  if (path === "#/reset-password" || params.get("mode") === "reset") {
    return "reset";
  }
  if (params.get("mode") === "signup") {
    return "signup";
  }
  return "login";
}

export default function Auth() {
  const params = new URLSearchParams(typeof location !== "undefined" ? location.hash.split("?")[1] : "");
  const next = safeNext(params.get("next"));
  const [mode, setMode] = useState<Mode>(getInitialMode);
  const [form, setForm] = useState<Signup>(() => ({
    ...EMPTY,
    name: params.get("name") ?? "",
    email: params.get("email") ?? "",
    year: Number(params.get("year")) || undefined,
  }));
  const [resetToken, setResetToken] = useState(() => params.get("token") ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const set = (patch: Partial<Signup>) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    // Only auto-redirect to dashboard if on login or signup mode, not while doing password reset
    if (mode === "login" || mode === "signup") {
      api("/users/me")
        .then(() => {
          location.hash = "#" + next;
        })
        .catch(() => {});
    }
  }, [next, mode]);

  useEffect(() => {
    const handleHash = () => {
      const newParams = new URLSearchParams(location.hash.split("?")[1] || "");
      const newMode = getInitialMode();
      setMode(newMode);
      if (newParams.get("email")) {
        set({ email: newParams.get("email") ?? "" });
      }
      if (newParams.get("token")) {
        setResetToken(newParams.get("token") ?? "");
      }
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    const first = Object.keys(errors)[0];
    if (first) {
      formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
    }
  }, [errors]);

  const switchTo = (m: Mode) => {
    setMode(m);
    setErrors({});
    setMsg("");
    setForgotSent(false);
    setResetSuccess(false);
    set({ password: "", confirm: "" });
    setNewPassword("");
    setConfirmPassword("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) {
      return;
    }

    let errs: Record<string, string> = {};
    if (mode === "signup") {
      errs = signupErrors(form);
    } else if (mode === "login") {
      const emailProblem = emailError(form.email.trim());
      if (emailProblem) {
        errs.email = emailProblem;
      }
      if (!form.password) {
        errs.password = "Enter your password.";
      }
    } else if (mode === "forgot") {
      const emailProblem = emailError(form.email.trim());
      if (emailProblem) {
        errs.email = emailProblem;
      }
    } else if (mode === "reset") {
      if (!newPassword) {
        errs.password = "Enter your new password.";
      } else {
        const pwProblem = passwordError(newPassword);
        if (pwProblem) {
          errs.password = pwProblem;
        }
      }
      if (newPassword !== confirmPassword) {
        errs.confirm = "Passwords do not match.";
      }
      if (!resetToken) {
        errs.token = "Reset token is missing or invalid.";
      }
    }

    setErrors(errs);
    setMsg("");
    if (Object.keys(errs).length) {
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { confirm: _, ...body } = form;
        await api("/auth/register", "POST", body);
        location.hash = "#" + next;
      } else if (mode === "login") {
        await api("/auth/login", "POST", { email: form.email, password: form.password });
        location.hash = "#" + next;
      } else if (mode === "forgot") {
        await api("/auth/forgot-password", "POST", { email: form.email.trim() });
        setForgotSent(true);
        setMsg("");
      } else if (mode === "reset") {
        await api("/auth/reset-password", "POST", {
          email: form.email.trim(),
          token: resetToken,
          password: newPassword,
          confirm: confirmPassword,
        });
        setResetSuccess(true);
        setMsg("");
      }
    } catch (err: any) {
      setMsg((err as Error).message);
      setErrors((err as { errors?: Record<string, string> }).errors ?? {});
    } finally {
      setBusy(false);
    }
  };

  const pw = show ? "text" : "password";

  let submitLabel = "Log in";
  if (busy) {
    if (mode === "signup") submitLabel = "Creating account…";
    else if (mode === "login") submitLabel = "Logging in…";
    else if (mode === "forgot") submitLabel = "Requesting link…";
    else if (mode === "reset") submitLabel = "Resetting password…";
  } else {
    if (mode === "signup") submitLabel = "Create account";
    else if (mode === "login") submitLabel = "Log in";
    else if (mode === "forgot") submitLabel = "Request reset link";
    else if (mode === "reset") submitLabel = "Reset password";
  }

  let title = "Log in";
  let subtitle = "Welcome back to GDGoC PSIT.";
  if (mode === "signup") {
    title = "Create your account";
    subtitle = "Join GDGoC PSIT to register for events and track your tickets.";
  } else if (mode === "forgot") {
    title = "Reset your password";
    subtitle = "Enter your registered email and we'll send you a recovery link.";
  } else if (mode === "reset") {
    title = "Set new password";
    subtitle = `Choose a new secure password for ${form.email || "your account"}.`;
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-14 px-4 pt-28 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-20">
      <div className="mx-auto w-full max-w-md lg:order-2">
        <h1 className="font-display text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-muted">{subtitle}</p>

        <form
          key={mode}
          ref={formRef}
          onSubmit={submit}
          noValidate
          className="mt-8 space-y-4 border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7"
        >
          {/* Sign up name */}
          {mode === "signup" && (
            <Field name="name" label="Full name" error={errors.name}>
              {(a) => (
                <input
                  {...a}
                  className={input}
                  autoFocus
                  autoComplete="name"
                  maxLength={60}
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              )}
            </Field>
          )}

          {/* Email field (for login, signup, forgot) */}
          {(mode === "login" || mode === "signup" || mode === "forgot") && (
            <>
              {mode === "forgot" && forgotSent ? (
                <div className="space-y-4">
                  <div className="border-2 border-ggreen bg-ggreen/10 p-4 text-sm font-semibold text-ink">
                    <p className="font-bold text-ggreen">✓ Check your inbox</p>
                    <p className="mt-1">
                      If an account exists with <span className="font-bold">{form.email}</span>, a password reset link has been sent. Please check your inbox and spam folder.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${button} w-full`}
                    onClick={() => switchTo("login")}
                  >
                    Return to login
                  </button>
                </div>
              ) : (
                <Field name="email" label={mode === "login" ? "Email" : "Email address"} error={errors.email}>
                  {(a) => (
                    <input
                      {...a}
                      className={input}
                      autoFocus={mode !== "signup"}
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      value={form.email}
                      onChange={(e) => set({ email: e.target.value })}
                    />
                  )}
                </Field>
              )}
            </>
          )}

          {/* Sign up extra fields */}
          {mode === "signup" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="branch" label="Branch (optional)" error={errors.branch}>
                {(a) => (
                  <select
                    {...a}
                    className={input}
                    value={form.branch}
                    onChange={(e) => set({ branch: e.target.value })}
                  >
                    <option value="">Not set</option>
                    {BRANCHES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                )}
              </Field>
              <Field name="year" label="Year (optional)" error={errors.year}>
                {(a) => (
                  <select
                    {...a}
                    className={input}
                    value={form.year ?? ""}
                    onChange={(e) => set({ year: Number(e.target.value) || undefined })}
                  >
                    <option value="">Not set</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          )}

          {/* Login and Signup password */}
          {(mode === "login" || mode === "signup") && (
            <Field
              name="password"
              label="Password"
              hint={mode === "signup" ? PASSWORD_RULE : undefined}
              error={errors.password}
            >
              {(a) => (
                <input
                  {...a}
                  className={input}
                  type={pw}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={form.password}
                  onChange={(e) => set({ password: e.target.value })}
                />
              )}
            </Field>
          )}

          {/* Sign up confirm password */}
          {mode === "signup" && (
            <Field name="confirm" label="Confirm password" error={errors.confirm}>
              {(a) => (
                <input
                  {...a}
                  className={input}
                  type={pw}
                  autoComplete="new-password"
                  value={form.confirm}
                  onChange={(e) => set({ confirm: e.target.value })}
                />
              )}
            </Field>
          )}

          {/* Reset password fields */}
          {mode === "reset" && (
            <>
              {resetSuccess ? (
                <div className="space-y-4">
                  <div className="border-2 border-ggreen bg-ggreen/10 p-4 text-sm font-semibold text-ink">
                    <p className="font-bold text-ggreen">✓ Password reset successful</p>
                    <p className="mt-1">
                      Your password has been updated and all active sessions have been secured. You can now log in with your new password.
                    </p>
                  </div>
                  <button
                    type="button"
                    className={`${button} w-full`}
                    onClick={() => switchTo("login")}
                  >
                    Return to login
                  </button>
                </div>
              ) : (
                <>
                  {!resetToken && (
                    <div className="border-2 border-gred bg-gred/10 p-4 text-sm text-gred font-bold">
                      Missing or invalid reset token. Please request a new password recovery link.
                    </div>
                  )}
                  <Field name="password" label="New password" hint={PASSWORD_RULE} error={errors.password}>
                    {(a) => (
                      <input
                        {...a}
                        className={input}
                        autoFocus
                        type={pw}
                        autoComplete="new-password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                      />
                    )}
                  </Field>
                  <Field name="confirm" label="Confirm new password" error={errors.confirm}>
                    {(a) => (
                      <input
                        {...a}
                        className={input}
                        type={pw}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                      />
                    )}
                  </Field>
                </>
              )}
            </>
          )}

          {/* Password controls for login, signup, reset */}
          {(mode === "login" || mode === "signup" || (mode === "reset" && !resetSuccess)) && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show password
              </label>
              {mode === "login" && (
                <button
                  type="button"
                  className="text-xs font-bold underline hover:text-gblue"
                  onClick={() => switchTo("forgot")}
                >
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {/* Global error message */}
          {msg && (
            <p role="alert" className="min-h-5 text-sm font-bold text-gred">
              {msg}
            </p>
          )}

          {/* Submit button */}
          {!(mode === "forgot" && forgotSent) && !(mode === "reset" && resetSuccess) && (
            <button type="submit" className={`${button} w-full`} disabled={busy}>
              {submitLabel}
            </button>
          )}
        </form>

        {/* Footer switches */}
        <p className="mt-6 text-center text-sm">
          {mode === "signup" && (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => switchTo("login")}
              >
                Log in
              </button>
            </>
          )}
          {mode === "login" && (
            <>
              New here?{" "}
              <button
                type="button"
                className="font-bold underline"
                onClick={() => switchTo("signup")}
              >
                Create an account
              </button>
            </>
          )}
          {(mode === "forgot" || mode === "reset") && (
            <button
              type="button"
              className="font-bold underline"
              onClick={() => switchTo("login")}
            >
              ← Back to login
            </button>
          )}
        </p>
      </div>

      <DeckPanel mode={mode} />
    </main>
  );
}
