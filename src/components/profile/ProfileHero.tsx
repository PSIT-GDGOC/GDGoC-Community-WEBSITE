import { useEffect, useState, type ReactNode } from "react";
import { COLOR_HEX } from "../../data/content";
import {
  calculateProfileCompletion,
  resolveImageUrl,
  safeExternalUrl,
  type AccentColor,
  type Profile,
} from "../../lib/profile";

function accentHex(accent?: AccentColor) {
  if (accent && accent in COLOR_HEX) {
    return COLOR_HEX[accent as keyof typeof COLOR_HEX];
  }
  if (accent === "slate") return "#202124";
  return COLOR_HEX.gblue;
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SocialIconLink({
  href,
  label,
  icon,
}: {
  href?: string;
  label: string;
  icon: ReactNode;
}) {
  const safeHref = safeExternalUrl(href);
  if (!safeHref) return null;
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center justify-center border-2 border-ink bg-bg text-ink shadow-[2px_2px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5 hover:bg-gyellow hover:shadow-[3px_3px_0_var(--color-ink)]"
    >
      {icon}
    </a>
  );
}

export function BannerBackground({ user }: { user: Profile }) {
  const theme = user.bannerTheme || "google-brand";
  const [bannerError, setBannerError] = useState(false);

  useEffect(() => {
    setBannerError(false);
  }, [user.bannerUrl, user.bannerTheme]);

  if (theme === "custom" && user.bannerUrl && !bannerError) {
    return (
      <div className="relative h-44 w-full overflow-hidden sm:h-56">
        <img
          src={resolveImageUrl(user.bannerUrl)}
          alt="Profile cover banner"
          className="h-full w-full object-cover"
          onError={() => setBannerError(true)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
      </div>
    );
  }

  if (theme === "midnight-slate") {
    return (
      <div className="relative h-44 w-full overflow-hidden bg-[#0F172A] sm:h-56">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(#94A3B8 1px, transparent 1px), radial-gradient(#94A3B8 1px, #0F172A 1px)",
            backgroundSize: "24px 24px",
            backgroundPosition: "0 0, 12px 12px",
          }}
        />
        <div className="absolute top-4 right-6 font-mono text-[10px] tracking-widest text-blue-400/80 uppercase">
          SYS // OBSIDIAN-GRID
        </div>
      </div>
    );
  }

  if (theme === "cyber-grid") {
    return (
      <div className="relative h-44 w-full overflow-hidden bg-[#18181B] sm:h-56">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "linear-gradient(to right, #34A853 1px, transparent 1px), linear-gradient(to bottom, #34A853 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="absolute top-3 right-4 font-mono text-[10px] text-[#34A853]">
          &gt; GDGOC_CYBER_TERMINAL_V2
        </div>
      </div>
    );
  }

  if (theme === "sunset-gradient") {
    return (
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-r from-[#EA4335] via-[#FBBC05] to-[#4285F4] sm:h-56">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
        <div className="absolute bottom-3 right-4 font-display text-xs font-bold tracking-wider text-white uppercase drop-shadow">
          Solar Aurora
        </div>
      </div>
    );
  }

  if (theme === "emerald-code") {
    return (
      <div className="relative h-44 w-full overflow-hidden bg-[#064E3B] sm:h-56">
        <div className="absolute inset-0 flex items-center justify-around opacity-20 font-mono text-xs text-[#6EE7B7] select-none">
          <span>{`{ developer: true }`}</span>
          <span>{`const identity = "hub"`}</span>
          <span>{`async function innovate()`}</span>
        </div>
        <div className="absolute top-3 right-4 font-mono text-[10px] text-[#6EE7B7]">
          &lt;/&gt; CODE_FLOW
        </div>
      </div>
    );
  }

  // Default: Google Neo-Brutalist 4-Color Pattern
  return (
    <div className="relative h-44 w-full overflow-hidden bg-panel sm:h-56">
      <div className="flex h-3 w-full" aria-hidden="true">
        <span className="flex-1 bg-[#4285F4]" />
        <span className="flex-1 bg-[#EA4335]" />
        <span className="flex-1 bg-[#FBBC05]" />
        <span className="flex-1 bg-[#34A853]" />
      </div>
      <div className="absolute inset-0 flex items-center justify-between px-6 opacity-10 pointer-events-none select-none">
        <div className="h-28 w-28 rounded-full border-4 border-ink" />
        <div className="h-32 w-32 rotate-12 border-4 border-ink" />
        <div className="h-20 w-36 -rotate-6 border-4 border-ink" />
      </div>
      <div className="absolute bottom-3 right-4 font-mono text-[10px] font-bold tracking-wider text-muted uppercase">
        Google Developer Groups · PSIT
      </div>
    </div>
  );
}

export default function ProfileHero({
  user,
  onOpenEditor,
}: {
  user: Profile;
  onOpenEditor: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user.avatarUrl]);

  const initials = initialsOf(user.name);
  const completion = calculateProfileCompletion(user);
  const accent = accentHex(user.accentColor);

  const copyProfileLink = () => {
    const url = `${window.location.origin}/#/profile`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {});
  };

  return (
    <section
      className="relative border-[3px] border-ink bg-bg shadow-[8px_8px_0_var(--color-ink)]"
      style={{ borderTopColor: accent, borderTopWidth: "5px" }}
    >
      {/* Cover Banner */}
      <BannerBackground user={user} />

      {/* Main Profile Info Section */}
      <div className="relative px-5 pt-0 pb-7 sm:px-8">
        {/* Floating Avatar & Action Row */}
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          {/* Avatar (Overlapping banner) */}
          <div className="-mt-16 sm:-mt-20 relative flex items-end gap-4">
            <div
              className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden border-[3px] border-ink bg-panel2 font-display text-4xl font-extrabold shadow-[4px_4px_0_var(--color-ink)] sm:h-36 sm:w-36 sm:text-5xl"
              aria-label="Member profile picture"
            >
              {user.avatarUrl && !imgError ? (
                <img
                  src={resolveImageUrl(user.avatarUrl)}
                  alt={user.name}
                  className="h-full w-full object-cover"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-ink">{initials}</span>
              )}
            </div>

            {/* Role & Verification Badge Cluster */}
            <div className="hidden sm:flex flex-col gap-1.5 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 border-2 border-ink px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wider uppercase shadow-[2px_2px_0_var(--color-ink)] ${
                    user.role === "admin"
                      ? "bg-gred text-white"
                      : "bg-wash-blue text-ink"
                  }`}
                >
                  {user.role === "admin" ? "⚡ Lead Organizer" : "GDGoC Member"}
                </span>

                <span
                  className={`inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-[11px] font-bold shadow-[2px_2px_0_var(--color-ink)] ${
                    user.memberVerified
                      ? "bg-ggreen text-white"
                      : user.emailVerified
                      ? "bg-wash-blue text-ink"
                      : "bg-panel text-muted"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      user.memberVerified
                        ? "bg-white animate-pulse motion-reduce:animate-none"
                        : user.emailVerified
                        ? "bg-gblue"
                        : "bg-gyellow"
                    }`}
                  />
                  {user.memberVerified
                    ? "Verified Member"
                    : user.emailVerified
                    ? "Email Verified"
                    : "Unverified"}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:pt-0">
            <button
              type="button"
              onClick={copyProfileLink}
              className="hard-button border-2 border-ink bg-bg px-3.5 py-1.5 font-display text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:bg-panel"
              title="Copy link to profile"
            >
              {copied ? "✓ Copied!" : "🔗 Share"}
            </button>
            <button
              type="button"
              onClick={onOpenEditor}
              className="hard-button border-2 border-ink bg-gyellow px-4 py-1.5 font-display text-sm font-extrabold text-ink shadow-[3px_3px_0_var(--color-ink)] hover:bg-gyellow/90"
            >
              ✎ Customize Profile
            </button>
          </div>
        </div>

        {/* Mobile Badges Row */}
        <div className="mt-3 flex flex-wrap items-center gap-2 sm:hidden">
          <span
            className={`inline-flex items-center gap-1 border-2 border-ink px-2 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase shadow-[2px_2px_0_var(--color-ink)] ${
              user.role === "admin" ? "bg-gred text-white" : "bg-wash-blue text-ink"
            }`}
          >
            {user.role === "admin" ? "⚡ Lead Organizer" : "GDGoC Member"}
          </span>

          <span
            className={`inline-flex items-center gap-1 border-2 border-ink px-2 py-0.5 text-[10px] font-bold shadow-[2px_2px_0_var(--color-ink)] ${
              user.memberVerified
                ? "bg-ggreen text-white"
                : user.emailVerified
                ? "bg-wash-blue text-ink"
                : "bg-panel text-muted"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                user.memberVerified ? "bg-white" : user.emailVerified ? "bg-gblue" : "bg-gyellow"
              }`}
            />
            {user.memberVerified
              ? "Verified Member"
              : user.emailVerified
              ? "Email Verified"
              : "Unverified"}
          </span>
        </div>

        {/* Identity & Headline */}
        <div className="mt-4 max-w-3xl">
          <h1 className="font-display text-2xl font-black tracking-tight text-ink sm:text-4xl">
            {user.name}
          </h1>

          {user.headline ? (
            <p className="mt-1 text-sm font-bold text-ink/85 sm:text-base">
              {user.headline}
            </p>
          ) : (
            <p className="mt-1 text-sm italic text-muted">
              No professional headline set yet. Click Customize Profile to add one.
            </p>
          )}

          {/* Academic & Campus Credential Line */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold text-muted sm:text-sm">
            <span className="flex items-center gap-1">
              <span className="font-bold text-ink">🎓 {user.college || "PSIT Kanpur"}</span>
            </span>
            <span>•</span>
            <span>{user.branch || "Branch not specified"}</span>
            <span>•</span>
            <span>{user.year ? `Year ${user.year}` : "Academic year not set"}</span>
            {user.specialization && (
              <>
                <span>•</span>
                <span className="font-medium text-gblue font-mono">
                  [{user.specialization}]
                </span>
              </>
            )}
          </div>

          {/* Bio Quote */}
          {user.bio && (
            <div className="mt-4 border-l-4 border-gyellow bg-panel/70 px-3.5 py-2 text-sm italic text-ink/90 sm:max-w-2xl">
              “{user.bio}”
            </div>
          )}

          {/* Social Links Row */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <SocialIconLink
              href={user.socials?.github}
              label="GitHub Profile"
              icon={
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
              }
            />
            <SocialIconLink
              href={user.socials?.linkedin}
              label="LinkedIn Profile"
              icon={
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                </svg>
              }
            />
            <SocialIconLink
              href={user.socials?.portfolio}
              label="Portfolio"
              icon={
                <svg className="h-5 w-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
              }
            />
            <SocialIconLink
              href={user.socials?.website}
              label="Personal Website"
              icon={
                <svg className="h-5 w-5 stroke-current fill-none" viewBox="0 0 24 24" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                </svg>
              }
            />
            <SocialIconLink
              href={user.socials?.twitter}
              label="Twitter / X Profile"
              icon={
                <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              }
            />

            {/* Email notice (Privacy Protected) */}
            {user.privacy?.showEmail && user.email ? (
              <span className="font-mono text-xs text-muted ml-2">
                ✉ {user.email}
              </span>
            ) : null}
          </div>
        </div>

        {/* Profile Completion Indicator Card */}
        <div className="mt-6 border-2 border-ink bg-panel p-3.5 shadow-[3px_3px_0_var(--color-ink)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-black uppercase tracking-wider text-ink">
                Profile Completeness
              </span>
              <span
                className={`font-mono text-xs font-bold ${
                  completion.percentage === 100
                    ? "text-ggreen"
                    : completion.percentage >= 60
                    ? "text-gblue"
                    : "text-gyellow"
                }`}
              >
                {completion.percentage}%
              </span>
            </div>
            <button
              type="button"
              aria-expanded={showTasksModal}
              onClick={() => setShowTasksModal(!showTasksModal)}
              className="text-xs font-bold text-ink hover:underline"
            >
              {showTasksModal ? "Hide details ▲" : "View checklist ▼"}
            </button>
          </div>

          {/* Progress bar */}
          <div
            className="mt-2 h-2.5 w-full border border-ink bg-bg overflow-hidden"
            role="progressbar"
            aria-valuenow={completion.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Profile completion progress"
          >
            <div
              className={`h-full transition-all duration-500 ${
                completion.percentage === 100
                  ? "bg-ggreen"
                  : completion.percentage >= 60
                  ? "bg-gblue"
                  : "bg-gyellow"
              }`}
              style={{ width: `${completion.percentage}%` }}
            />
          </div>

          {/* Expandable Task Checklist */}
          {showTasksModal && (
            <div className="mt-3 grid gap-1.5 border-t border-ink/20 pt-3 text-xs sm:grid-cols-2">
              {completion.completedTasks.map((task) => (
                <div key={task} className="flex items-center gap-1.5 text-ggreen font-medium">
                  <span>✓</span>
                  <span>{task}</span>
                </div>
              ))}
              {completion.remainingTasks.map((task) => (
                <div key={task} className="flex items-center gap-1.5 text-muted">
                  <span className="text-gyellow font-bold">○</span>
                  <span>{task}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

