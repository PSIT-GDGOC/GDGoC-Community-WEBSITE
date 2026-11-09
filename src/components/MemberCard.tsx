import { useEffect, useState, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { COLOR_HEX, ON_COLOR, PANEL_HEX, type GColor } from "../data/content";
import { resolveImageUrl, type Profile } from "../lib/profile";
import { SuitGlyph, SUIT_FOR, useFinePointer } from "./ui";

const YEAR_COLORS: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
const FOUR: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
const MAX_TILT = 6;

function cardColor(year?: number, accent?: string): GColor {
  if (accent && ["gblue", "gred", "gyellow", "ggreen"].includes(accent)) {
    return accent as GColor;
  }
  if (!year) {
    return "gblue";
  }
  return YEAR_COLORS[(year - 1) % YEAR_COLORS.length];
}

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function memberIdOf(user: Profile): string {
  if (user.enrollmentNo && user.enrollmentNo.trim()) {
    return user.enrollmentNo.trim();
  }
  if (user.id || user._id) {
    return `GDG-${String(user.id || user._id).slice(-6).toUpperCase()}`;
  }
  const cleanEmail = (user.email || "").split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
  return `GDG-${(cleanEmail || "MEM").slice(0, 6).toUpperCase()}`;
}

function CornerIndex({
  initials,
  color,
  flipped = false,
}: {
  initials: string;
  color: GColor;
  flipped?: boolean;
}) {
  return (
    <span
      className={`absolute z-10 flex flex-col items-center gap-0.5 ${
        flipped ? "right-3.5 bottom-3.5 rotate-180" : "top-5 left-3.5"
      }`}
      style={{ color: COLOR_HEX[color] }}
      aria-hidden="true"
    >
      <span className="font-display text-xs leading-none font-black text-ink">{initials}</span>
      <SuitGlyph suit={SUIT_FOR[color]} size={11} />
    </span>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: number | null | undefined;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group min-w-0 flex-1 border-2 border-ink bg-bg p-2 text-center transition-all hover:-translate-y-0.5 hover:bg-panel hover:shadow-[2px_2px_0_var(--color-ink)]"
    >
      <span className="block font-display text-lg sm:text-xl leading-none font-black text-ink">
        {value ?? "–"}
      </span>
      <span className="mt-1 block text-[10px] font-bold text-muted uppercase tracking-wider group-hover:text-ink">
        {label}
      </span>
    </a>
  );
}

export default function MemberCard({
  user,
  upcoming,
  attended,
  registered,
  showEmail,
}: {
  user: Profile;
  upcoming?: number | null;
  attended?: number | null;
  registered?: number | null;
  showEmail?: boolean;
}) {
  const color = cardColor(user.year, user.accentColor);
  const initials = initialsOf(user.name);
  const memberId = memberIdOf(user);
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [imgError, setImgError] = useState(false);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [user.avatarUrl]);

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "–";
  const details = [user.branch || "Branch not set", user.year ? `Year ${user.year}` : "Year not set"];

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!finePointer || reducedMotion || flipped) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((event.clientY - box.top) / box.height - 0.5) * -MAX_TILT,
      y: ((event.clientX - box.left) / box.width - 0.5) * MAX_TILT,
    });
  };

  const showAvatar = Boolean(user.avatarUrl && !imgError);
  const hasActivityStats = upcoming !== undefined || attended !== undefined || registered !== undefined;
  const theme = user.cardTheme || "default";
  const accentStripe = user.accentColor === "slate" ? "#202124" : COLOR_HEX[color];

  return (
    <figure
      aria-label={`GDGoC PSIT member card for ${user.name}`}
      className="relative mx-auto w-full select-none"
      style={{ perspective: 1200 }}
    >
      <div
        onPointerMove={onPointerMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className={`relative flex min-h-[460px] w-full flex-col overflow-hidden border-[3px] border-ink shadow-[8px_8px_0_var(--color-ink)] transition-transform duration-300 ease-out ${
          theme === "dark"
            ? "bg-[#111419] text-white"
            : theme === "accent"
            ? "text-ink"
            : "bg-bg text-ink"
        }`}
        style={{
          backgroundColor: theme === "accent" ? PANEL_HEX[color] : undefined,
          transform: reducedMotion
            ? undefined
            : `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)`,
        }}
      >
        {/* Brand 4-Color Stripe Header */}
        <div className="flex h-2.5 w-full shrink-0" aria-hidden="true">
          {theme === "accent" ? (
            <span className="flex-1" style={{ background: accentStripe }} />
          ) : (
            FOUR.map((c) => (
              <span key={c} className="flex-1" style={{ background: COLOR_HEX[c] }} />
            ))
          )}
        </div>

        {!flipped ? (
          /* ======================================================== */
          /*  FRONT SIDE: Digital Membership Card                      */
          /* ======================================================== */
          <div className="relative flex flex-1 flex-col justify-between p-5 pt-3">
            {/* Background watermark badge */}
            {theme !== "minimal" && (
              <span
                className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.04]"
                style={{ color: COLOR_HEX[color] }}
                aria-hidden="true"
              >
                <SuitGlyph suit={SUIT_FOR[color]} size={260} />
              </span>
            )}

            {/* Corner Playing-Card Indices */}
            <CornerIndex initials={initials} color={color} />
            <CornerIndex initials={initials} color={color} flipped />

            {/* Top Bar: Chapter ID & Flip Button */}
            <div className="relative z-10 flex items-center justify-between pl-6 pr-1">
              <span className={`font-mono text-[10px] font-bold tracking-widest uppercase ${
                theme === "dark" ? "text-gray-400" : "text-muted"
              }`}>
                {memberId}
              </span>
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="inline-flex items-center gap-1 rounded-sm border border-ink bg-panel px-2 py-0.5 text-[11px] font-bold text-ink transition-colors hover:bg-gyellow hover:shadow-[2px_2px_0_var(--color-ink)]"
                aria-label="View back of membership card"
                title="View chapter pass"
              >
                <span>Pass</span>
                <span aria-hidden="true">↺</span>
              </button>
            </div>

            {/* Center Content: Avatar & Identity */}
            <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
              {/* Role badge */}
              <div className="mb-3">
                <span
                  className={`inline-flex items-center gap-1 border-2 border-ink px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider uppercase shadow-[2px_2px_0_var(--color-ink)] ${
                    user.role === "admin"
                      ? "bg-gred text-white"
                      : user.memberVerified
                      ? "bg-ggreen text-white"
                      : "bg-wash-blue text-ink"
                  }`}
                >
                  {user.role === "admin"
                    ? "⚡ Lead Organizer"
                    : user.memberVerified
                    ? "Verified Member"
                    : "GDGoC Member"}
                </span>
              </div>

              {/* Avatar Photo Frame */}
              <div
                className="relative grid h-24 w-24 place-items-center overflow-hidden border-[3px] border-ink font-display text-3xl font-extrabold shadow-[4px_4px_0_var(--color-ink)]"
                style={{ background: PANEL_HEX[color], color: ON_COLOR[color] }}
              >
                {showAvatar ? (
                  <img
                    src={resolveImageUrl(user.avatarUrl)!}
                    alt={user.name}
                    className="h-full w-full object-cover"
                    onError={() => setImgError(true)}
                  />
                ) : (
                  <span aria-hidden="true">{initials}</span>
                )}
              </div>

              {/* Name & Academic Credentials */}
              <figcaption className={`mt-3 font-display text-xl sm:text-2xl leading-tight font-extrabold tracking-tight break-words ${
                theme === "dark" ? "text-white" : "text-ink"
              }`}>
                {user.name}
              </figcaption>
              <p className={`mt-1 text-xs font-bold sm:text-sm ${
                theme === "dark" ? "text-gray-300" : "text-ink/75"
              }`}>
                {details.join(" · ")}
              </p>
              {user.headline && (
                <p className={`mt-1 max-w-[260px] text-[11px] font-semibold line-clamp-1 ${
                  theme === "dark" ? "text-blue-300" : "text-gblue"
                }`}>
                  {user.headline}
                </p>
              )}
              {(showEmail ?? Boolean(user.privacy?.showEmail)) && user.email && (
                <p className={`mt-0.5 max-w-full font-mono text-[11px] break-all ${
                  theme === "dark" ? "text-gray-400" : "text-muted"
                }`}>
                  {user.email}
                </p>
              )}

              {/* Bio quote if provided */}
              {user.bio && (
                <div className={`mt-2.5 max-w-[280px] rounded-xs border-l-2 border-ink px-2.5 py-1 text-left text-xs italic line-clamp-2 ${
                  theme === "dark" ? "bg-white/10 text-gray-200" : "bg-panel/60 text-muted"
                }`}>
                  “{user.bio}”
                </div>
              )}
            </div>

            {/* Bottom Activity Stats & Membership Footer */}
            <div className={`relative z-10 mt-auto border-t-2 border-dashed pt-3 ${
              theme === "dark" ? "border-gray-700" : "border-ink/80"
            }`}>
              {hasActivityStats && (
                <div className="mb-2.5 grid grid-cols-3 gap-2">
                  <Stat label="Upcoming" value={upcoming} href="#/tickets" />
                  <Stat label="Attended" value={attended} href="#/tickets" />
                  <Stat
                    label="Registered"
                    value={registered}
                    href="#/tickets"
                  />
                </div>
              )}

              <div className={`flex items-center justify-between pr-6 text-[11px] font-semibold ${
                theme === "dark" ? "text-gray-400" : "text-muted"
              }`}>
                <span>Member since {memberSince}</span>
                <span className={`font-mono text-[10px] ${
                  theme === "dark" ? "text-gray-500" : "text-ink/60"
                }`}>PSIT Chapter</span>
              </div>
            </div>
          </div>
        ) : (
          /* ======================================================== */
          /*  BACK SIDE: Chapter Pass & Verification Credential        */
          /* ======================================================== */
          <div className="relative flex flex-1 flex-col justify-between bg-panel p-5 pt-3">
            {/* Top Bar: Pass Title & Return Button */}
            <div className="flex items-center justify-between border-b-2 border-ink pb-2">
              <span className="font-mono text-[10px] font-bold tracking-widest text-ink uppercase">
                Chapter Pass
              </span>
              <button
                type="button"
                onClick={() => setFlipped(false)}
                className="inline-flex items-center gap-1 rounded-sm border border-ink bg-bg px-2 py-0.5 text-[11px] font-bold text-ink transition-colors hover:bg-gyellow hover:shadow-[2px_2px_0_var(--color-ink)]"
                aria-label="Return to front of membership card"
              >
                <span>Front</span>
                <span aria-hidden="true">↺</span>
              </button>
            </div>

            {/* Center Pass Credentials */}
            <div className="my-auto space-y-4 py-2">
              <div className="text-center">
                <p className="font-display text-sm font-extrabold uppercase tracking-wide text-ink">
                  Google Developer Groups
                </p>
                <p className="text-xs font-semibold text-muted">
                  On Campus · PSIT Kanpur
                </p>
              </div>

              {/* Verified Status Tag: Keep email verification separate from official membership verification */}
              <div className="mx-auto flex max-w-xs items-center justify-center gap-2 border-2 border-ink bg-bg p-2 text-center shadow-[3px_3px_0_var(--color-ink)]">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    user.role === "admin"
                      ? "bg-gred animate-pulse motion-reduce:animate-none"
                      : user.memberVerified
                      ? "bg-ggreen animate-pulse motion-reduce:animate-none"
                      : user.emailVerified
                      ? "bg-gblue"
                      : "bg-gyellow"
                  }`}
                />
                <span className="font-mono text-[11px] font-bold tracking-wider text-ink uppercase">
                  {user.role === "admin"
                    ? "Lead Chapter Organizer"
                    : user.memberVerified
                    ? "Verified Chapter Member"
                    : user.emailVerified
                    ? "Community Member (Email Verified)"
                    : "Community Member (Unverified)"}
                </span>
              </div>

              {/* Credential Data Table */}
              <div className="space-y-1.5 border-2 border-ink bg-bg p-3 text-xs shadow-[3px_3px_0_var(--color-ink)]">
                <div className="flex justify-between border-b border-ink/20 pb-1">
                  <span className="font-bold text-muted">ID:</span>
                  <span className="font-mono font-bold text-ink">{memberId}</span>
                </div>
                <div className="flex justify-between border-b border-ink/20 pb-1">
                  <span className="font-bold text-muted">Name:</span>
                  <span className="font-bold text-ink truncate max-w-[170px]">{user.name}</span>
                </div>
                <div className="flex justify-between border-b border-ink/20 pb-1">
                  <span className="font-bold text-muted">Branch:</span>
                  <span className="font-semibold text-ink">{user.branch || "–"}</span>
                </div>
                <div className="flex justify-between border-b border-ink/20 pb-1">
                  <span className="font-bold text-muted">Year:</span>
                  <span className="font-semibold text-ink">{user.year ? `Year ${user.year}` : "–"}</span>
                </div>
                <div className="flex justify-between border-b border-ink/20 pb-1">
                  <span className="font-bold text-muted">Membership:</span>
                  <span
                    className={`font-bold ${
                      user.role === "admin"
                        ? "text-gred"
                        : user.memberVerified
                        ? "text-ggreen"
                        : "text-ink"
                    }`}
                  >
                    {user.role === "admin"
                      ? "Chapter Lead"
                      : user.memberVerified
                      ? "Official Member"
                      : "Community Tier"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-muted">Email Status:</span>
                  <span
                    className={`font-bold ${
                      user.emailVerified ? "text-ggreen" : "text-gyellow"
                    }`}
                  >
                    {user.emailVerified ? "Verified Email" : "Pending Verification"}
                  </span>
                </div>
              </div>

              {/* Quick Navigation Links */}
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <a
                  href="#/tickets"
                  className="hard-button border-2 border-ink bg-bg p-2 font-display text-[11px] font-bold hover:bg-gyellow"
                >
                  My Tickets →
                </a>
                <a
                  href="#/events"
                  className="hard-button border-2 border-ink bg-bg p-2 font-display text-[11px] font-bold hover:bg-gyellow"
                >
                  Browse Events →
                </a>
              </div>
            </div>

            {/* Bottom Pass Barcode Representation */}
            <div className="border-t-2 border-dashed border-ink/80 pt-3 text-center">
              <div
                className="mx-auto flex h-6 w-44 items-center justify-between opacity-75"
                aria-hidden="true"
              >
                {[4, 2, 6, 1, 3, 5, 2, 4, 1, 6, 3, 2, 5, 1, 4, 2, 6].map((w, i) => (
                  <span
                    key={i}
                    className="bg-ink"
                    style={{ width: `${w}px`, height: "100%" }}
                  />
                ))}
              </div>
              <p className="mt-1 font-mono text-[9px] tracking-widest text-muted uppercase">
                PSIT-GDGOC-OFFICIAL-PASS
              </p>
            </div>
          </div>
        )}
      </div>
    </figure>
  );
}
