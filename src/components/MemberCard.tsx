import { useState, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { COLOR_HEX, ON_COLOR, PANEL_HEX, type GColor } from "../data/content";
import type { Profile } from "../lib/profile";
import { SuitGlyph, SUIT_FOR, useFinePointer } from "./ui";

const YEAR_COLORS: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
const FOUR: GColor[] = ["gblue", "gred", "gyellow", "ggreen"];
const MAX_TILT = 7;

function cardColor(year?: number): GColor {
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

function CornerIndex({ initials, color, flipped = false }: { initials: string; color: GColor; flipped?: boolean }) {
  return (
    <span
      className={`absolute z-10 flex flex-col items-center gap-0.5 ${flipped ? "right-4 bottom-4 rotate-180" : "top-6 left-4"}`}
      style={{ color: COLOR_HEX[color] }}
      aria-hidden="true"
    >
      <span className="font-display text-sm leading-none font-extrabold text-ink">{initials}</span>
      <SuitGlyph suit={SUIT_FOR[color]} size={12} />
    </span>
  );
}

function Stat({ label, value, href }: { label: string; value: number | null; href: string }) {
  return (
    <a href={href} className="group min-w-0 flex-1 border-[3px] border-ink bg-bg px-3 py-2 transition-colors hover:bg-panel">
      <span className="block font-display text-2xl leading-none font-extrabold">{value ?? "–"}</span>
      <span className="mt-1 block text-[11px] font-bold text-muted uppercase group-hover:text-ink">{label}</span>
    </a>
  );
}

export default function MemberCard({
  user,
  upcoming,
  attended,
}: {
  user: Profile;
  upcoming?: number | null;
  attended?: number | null;
}) {
  const color = cardColor(user.year);
  const initials = initialsOf(user.name);
  const finePointer = useFinePointer();
  const reducedMotion = useReducedMotion();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })
    : "–";
  const details = [user.branch || "Branch not set", user.year ? `Year ${user.year}` : "Year not set"];

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!finePointer || reducedMotion) {
      return;
    }
    const box = event.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((event.clientY - box.top) / box.height - 0.5) * -MAX_TILT,
      y: ((event.clientX - box.left) / box.width - 0.5) * MAX_TILT,
    });
  };

  return (
    <figure aria-label={`GDGoC PSIT member card for ${user.name}`} style={{ perspective: 900 }}>
      <div
        onPointerMove={onPointerMove}
        onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        className="relative flex aspect-[5/7] flex-col overflow-hidden border-[3px] border-ink bg-bg shadow-[8px_8px_0_var(--color-ink)] transition-transform duration-200 ease-out"
        style={{ transform: `rotateX(${tilt.x.toFixed(2)}deg) rotateY(${tilt.y.toFixed(2)}deg)` }}
      >
        <span className="flex h-2 shrink-0" aria-hidden="true">
          {FOUR.map((c) => (
            <span key={c} className="flex-1" style={{ background: COLOR_HEX[c] }} />
          ))}
        </span>

        <span
          className="pointer-events-none absolute inset-0 grid place-items-center opacity-[0.06]"
          style={{ color: COLOR_HEX[color] }}
          aria-hidden="true"
        >
          <SuitGlyph suit={SUIT_FOR[color]} size={260} />
        </span>

        <CornerIndex initials={initials} color={color} />
        <CornerIndex initials={initials} color={color} flipped />

        <div className="relative flex flex-1 flex-col items-center justify-center px-8 pt-6 text-center">
          <p className={`font-mono text-[10px] font-semibold tracking-[0.25em] uppercase ${user.role === "admin" ? "text-gred font-bold" : "text-muted"}`}>
            GDGoC PSIT · {user.role === "admin" ? "⚡ Administrator" : "Member"}
          </p>
          <span
            className="mt-4 grid h-20 w-20 place-items-center border-[3px] border-ink font-display text-3xl font-extrabold shadow-[4px_4px_0_var(--color-ink)]"
            style={{ background: PANEL_HEX[color], color: ON_COLOR[color] }}
            aria-hidden="true"
          >
            {initials}
          </span>
          <figcaption className="mt-4 font-display text-2xl leading-tight font-extrabold break-words">
            {user.name}
          </figcaption>
          <p className="mt-1 text-sm font-semibold text-ink/70">{details.join(" · ")}</p>
          <p className="mt-1 max-w-full font-mono text-xs break-all text-muted">{user.email}</p>
          {user.bio && <p className="mt-3 line-clamp-2 text-sm text-muted italic">“{user.bio}”</p>}
        </div>

        <div className="relative border-t-[3px] border-dashed border-ink bg-panel px-5 pt-4 pb-10">
          {upcoming !== undefined && attended !== undefined && (
            <div className="mb-3 flex gap-3">
              <Stat label="Upcoming" value={upcoming} href="#/tickets" />
              <Stat label="Attended" value={attended} href="#/tickets" />
            </div>
          )}
          <p className="text-xs font-semibold text-muted">Member since {memberSince}</p>
        </div>
      </div>
    </figure>
  );
}
