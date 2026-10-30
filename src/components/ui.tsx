import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { cn } from "../utils/cn";
import { OSO } from "../lib/oso";
import { addTicker } from "../lib/loop";
import { COLOR_HEX, ON_COLOR, PANEL_EDGE, PANEL_HEX, WASH_HEX, type GColor } from "../data/content";


/* ---------------- pointer capability ---------------- */

/** True only on devices with a fine pointer that can hover. */
export function useFinePointer() {
  const [fine, setFine] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: hover) and (pointer: fine)").matches
  );
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const onChange = () => setFine(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return fine;
}

/**
 * Short magnetic pull toward the pointer, only while the pointer is
 * within ~40px of the element. rAF-throttled, passive listener.
 * Returns a ref to attach and the current offset to apply as a transform.
 */
export function useMagnetic<T extends HTMLElement>(strength = 0.28, radius = 40) {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const fine = useFinePointer();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !fine || reduced) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const state = { x: 0, y: 0, in: false };
    let frame = 0;
    const apply = () => setOffset((o) => (o.x === state.x && o.y === state.y ? o : { x: state.x, y: state.y }));
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        const inside = Math.abs(dx) < r.width / 2 + radius && Math.abs(dy) < r.height / 2 + radius;
        if (!inside) {
          if (state.in) {
            state.in = false;
            state.x = 0;
            state.y = 0;
            apply();
          }
          return;
        }
        state.in = true;
        state.x = Math.round(dx * strength);
        state.y = Math.round(dy * strength);
        apply();
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
      setOffset((o) => (o.x === 0 && o.y === 0 ? o : { x: 0, y: 0 }));
    };
  }, [fine, reduced, strength, radius]);

  return { ref, offset };
}

/**
 * Lerped pointer parallax for decorative elements marked with
 * `data-drift="<depth>"`. Writes transforms straight to the DOM inside a
 * rAF loop so no React render is triggered. Fine pointers only.
 */
export function usePointerParallax<T extends HTMLElement>(defaultDepth = 14) {
  const ref = useRef<T>(null);
  const fine = useFinePointer();
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !fine || reduced) return;
    const targets = Array.from(el.querySelectorAll<HTMLElement>("[data-drift]"));
    if (targets.length === 0) return;
    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let frame = 0;
    let alive = true;
    let lastX = 0;
    let lastY = 0;
    const onMove = (e: PointerEvent) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    const tick = () => {
      cx += (tx - cx) * 0.07;
      cy += (ty - cy) * 0.07;
      const rx = Math.round(cx * 100) / 100;
      const ry = Math.round(cy * 100) / 100;
      if (rx !== lastX || ry !== lastY) {
        lastX = rx;
        lastY = ry;
        for (const t of targets) {
          const depth = Number(t.dataset.drift) || defaultDepth;
          t.style.transform = `translate3d(${(rx * depth).toFixed(2)}px, ${(ry * depth).toFixed(2)}px, 0)`;
        }
      }
      if (alive) frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    frame = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      for (const t of targets) t.style.transform = "";
    };
  }, [defaultDepth, fine, reduced]);

  return ref;
}

/**
 * Four-colour confetti burst from the centre of an element.
 * Squares are appended to the body and removed once the animation ends.
 */
export function burstConfetti(el: HTMLElement | null, colors: string[]): void {
  if (!el) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  for (let i = 0; i < 18; i++) {
    const bit = document.createElement("span");
    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const dist = 60 + Math.random() * 90;
    bit.className = "confetti-bit";
    bit.style.left = `${cx}px`;
    bit.style.top = `${cy}px`;
    bit.style.background = colors[i % colors.length];
    bit.style.setProperty("--dx", `${Math.cos(angle) * dist}px`);
    bit.style.setProperty("--dy", `${Math.sin(angle) * dist + 40}px`);
    bit.style.setProperty("--rot", `${Math.round(Math.random() * 540 - 270)}deg`);
    document.body.appendChild(bit);
    window.setTimeout(() => bit.remove(), 900);
  }
}

/* ---------------- Reveal on scroll ---------------- */

export function Reveal({
  children,
  delay = 0,
  y = 30,
  className,
  animate = false,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  animate?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial={animate ? { opacity: 0, y } : false}
      whileInView={animate ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, margin: "-70px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ---------------- Section tag ---------------- */

export function SectionTag({
  label,
  color = "gblue",
  className,
}: {
  /** Kept in the prop signature for call-site compatibility; no longer rendered. */
  index?: string;
  label: string;
  color?: GColor;
  className?: string;
}) {
  return (
    <span
      className={cn("tab-label bg-panel text-sm text-ink sm:text-base", className)}
      style={{
        /* red fails AA for small ink text at 4.1:1, so its tab falls back
           to the red wash with a red edge - the tint-panel rule. */
        background: color === "gred" ? WASH_HEX.gred : COLOR_HEX[color],
        borderColor: "var(--color-ink)",
      }}
    >
      {label}
    </span>
  );
}

/* ---------------- Contribution month grid ---------------- */

/* One square per OSO day, filled as the month progresses. Shared by the
   hero status rail and the poster so the two can never disagree. */
export function MonthGrid({
  state,
  day,
  cols = 6,
  square = 0,
  flip = false,
  className,
}: {
  state: "upcoming" | "live" | "wrapped";
  day: number;
  cols?: number;
  /** Extra px on each side of a square; 0 lets the grid size itself. */
  square?: number;
  flip?: boolean;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const animateFlip = flip && !reduced;

  return (
    <div
      className={cn("grid gap-1.5", className)}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {Array.from({ length: OSO.totalDays }, (_, i) => {
        const filled = state === "wrapped" || (state === "live" && i < day);
        const today = state === "live" && i === day - 1;
        const next = state === "upcoming" && i === 0;
        let background = "#ffffff";
        if (filled) {
          background = COLOR_HEX.ggreen;
        } else if (next) {
          background = COLOR_HEX.gyellow;
        }
        const boxShadow = today || next ? "3px 3px 0 var(--color-ink)" : undefined;

        if (!animateFlip) {
          return (
            <span
              key={i}
              className="aspect-square border-2 border-ink"
              style={{ background, boxShadow, minWidth: square || undefined }}
            />
          );
        }

        return (
          <motion.span
            key={i}
            className="aspect-square border-2 border-ink"
            style={{ boxShadow, minWidth: square || undefined, transformPerspective: 300 }}
            initial={{ rotateY: 180, backgroundColor: "#202124" }}
            whileInView={{ rotateY: 0, backgroundColor: background }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, ease: [0.34, 1.3, 0.64, 1], delay: 0.2 + i * 0.045 }}
          />
        );
      })}
    </div>
  );
}

/* ---------------- Status pill ---------------- */

/* The one place OSO status colour is allowed. Upcoming takes yellow, Live
   takes green, Wrapped is ink on white. These never stand in for the
   event-type colours. */
export function StatusPill({
  state,
  className,
}: {
  state: "upcoming" | "live" | "wrapped";
  className?: string;
}) {
  const label = state === "upcoming" ? "Upcoming" : state === "live" ? "Live" : "Wrapped";
  const fill =
    state === "upcoming" ? COLOR_HEX.gyellow : state === "live" ? COLOR_HEX.ggreen : "var(--color-bg)";
  return (
    <span className={cn("status-pill", className)} style={{ background: fill }}>
      {label}
    </span>
  );
}

/* ---------------- Scramble heading ---------------- */

export function ScrambleHeading({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduced = useReducedMotion();
  const words = text.split(" ");

  return (
    <h2 ref={ref} className={className} aria-label={text}>
      {words.map((word, i) => (
        <Fragment key={`${word}-${i}`}>
          <span className="mask-word" aria-hidden="true">
            <motion.span
              className="inline-block"
              initial={reduced ? false : { y: "115%", rotate: 4 }}
              animate={inView || reduced ? { y: 0, rotate: 0 } : undefined}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: i * 0.07 }}
            >
              {word}
            </motion.span>
          </span>
          {i < words.length - 1 && " "}
        </Fragment>
      ))}
    </h2>
  );
}

/* ---------------- Count up ---------------- */

export function CountUp({
  to,
  suffix = "",
  duration = 1500,
  className,
}: {
  to: number;
  suffix?: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduced = useReducedMotion();
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (reduced) {
      setVal(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(to * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, duration, reduced]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">
        {val}
        {suffix}
      </span>
      <span className="sr-only">
        {to}
        {suffix}
      </span>
    </span>
  );
}

/* ---------------- Marquee ---------------- */

export function Marquee({
  children,
  duration = 32,
  className,
  mask = true,
}: {
  children: ReactNode;
  duration?: number;
  className?: string;
  mask?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    const wrap = wrapRef.current;
    const track = trackRef.current;
    if (!wrap || !track || reduced) {
      return;
    }

    let offset = 0;
    let boost = 0;
    let direction = 1;
    let paused = false;
    let lastScroll = window.scrollY;

    const onScroll = () => {
      const delta = window.scrollY - lastScroll;
      lastScroll = window.scrollY;
      if (delta === 0) {
        return;
      }
      direction = delta > 0 ? 1 : -1;
      boost = Math.min(boost + Math.abs(delta) * 4, 1400);
    };

    const pause = () => {
      paused = true;
    };

    const resume = () => {
      paused = false;
    };

    const stop = addTicker((dt) => {
      const loop = track.scrollWidth / 2;
      if (!loop || paused) {
        return;
      }

      const speed = loop / duration + boost;
      offset -= direction * speed * dt;
      offset %= loop;
      if (offset > 0) {
        offset -= loop;
      }

      track.style.transform = `translate3d(${offset.toFixed(2)}px, 0, 0)`;
      boost *= Math.pow(0.04, dt);
    });

    window.addEventListener("scroll", onScroll, { passive: true });
    wrap.addEventListener("pointerenter", pause);
    wrap.addEventListener("pointerleave", resume);
    wrap.addEventListener("focusin", pause);
    wrap.addEventListener("focusout", resume);

    return () => {
      stop();
      window.removeEventListener("scroll", onScroll);
      wrap.removeEventListener("pointerenter", pause);
      wrap.removeEventListener("pointerleave", resume);
      wrap.removeEventListener("focusin", pause);
      wrap.removeEventListener("focusout", resume);
    };
  }, [duration, reduced]);

  return (
    <div
      ref={wrapRef}
      className={cn("marquee overflow-hidden", mask && "marquee-mask", className)}
      tabIndex={0}
      aria-label="Scrolling ticker - pause with focus"
    >
      <div ref={trackRef} className="marquee-track flex w-max items-center">
        <div className="flex items-center">{children}</div>
        <div className="flex items-center" aria-hidden="true">
          {children}
        </div>
      </div>
    </div>
  );
}

/* The old hand-rolled GdgMark lived here. It was a lookalike, not the
   official mark, so it is gone: every logo now comes from
   src/components/GdgLogo.tsx, which only ever places official files. */

/* ---------------- Arrow button ---------------- */

export function ArrowLink({
  children,
  onClick,
  color = "gyellow",
  className,
  ghost = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  color?: GColor;
  className?: string;
  ghost?: boolean;
}) {
  const hex = COLOR_HEX[color];
  const { ref, offset } = useMagnetic<HTMLSpanElement>();
  return (
    <span
      ref={ref}
      className="inline-block"
      style={offset.x || offset.y ? { transform: `translate3d(${offset.x}px, ${offset.y}px, 0)` } : undefined}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "hard-button group inline-flex items-center gap-3 px-6 py-3.5 font-display text-[15px] font-bold text-ink",
          ghost ? "bg-bg" : "",
          className
        )}
        style={
          ghost
            ? ({ "--hard-edge": hex } as CSSProperties)
            : { background: PANEL_HEX[color], color: ON_COLOR[color] }
        }
      >
        <RollText>{children}</RollText>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          className="transition-transform duration-300 group-hover:translate-x-1"
          aria-hidden="true"
        >
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      </button>
    </span>
  );
}

/* ---------------- Corner ticks for framed panels ---------------- */

export function CornerFrame({ className, color = "var(--color-ink)" }: { className?: string; color?: string }) {
  return (
    <>
      <span className={cn("pointer-events-none absolute -top-px -left-px h-4 w-4 border-t-2 border-l-2", className)} style={{ borderColor: color }} />
      <span className={cn("pointer-events-none absolute -top-px -right-px h-4 w-4 border-t-2 border-r-2", className)} style={{ borderColor: color }} />
      <span className={cn("pointer-events-none absolute -bottom-px -left-px h-4 w-4 border-b-2 border-l-2", className)} style={{ borderColor: color }} />
      <span className={cn("pointer-events-none absolute -right-px -bottom-px h-4 w-4 border-r-2 border-b-2", className)} style={{ borderColor: color }} />
    </>
  );
}

/* ================================================================ */
/*  PLAYING-CARD SYSTEM — tilt, glare, suit pips, hover intel panel  */
/* ================================================================ */

export type Suit = "spade" | "heart" | "diamond" | "club";

export const SUIT_FOR: Record<GColor, Suit> = {
  gblue: "spade",
  gred: "heart",
  gyellow: "diamond",
  ggreen: "club",
};

export function SuitGlyph({ suit, size = 14, className }: { suit: Suit; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      {suit === "diamond" && <path d="M12 2 19.5 12 12 22 4.5 12Z" />}
      {suit === "heart" && (
        <path d="M12 21.3C4.8 14.6 2.6 9.8 6 6.6c2.6-2.4 5.4-.6 6 1 .6-1.6 3.4-3.4 6-1 3.4 3.2 1.2 8-6 14.7Z" />
      )}
      {suit === "spade" && (
        <path d="M12 2c3.8 4.8 8 7.8 8 11.4 0 2.8-2.2 4.5-4.6 3.8.8 2 1.9 3.1 3.2 3.8H5.4c1.3-.7 2.4-1.8 3.2-3.8C6.2 17.9 4 16.2 4 13.4 4 9.8 8.2 6.8 12 2Z" />
      )}
      {suit === "club" && (
        <>
          <circle cx="12" cy="6.8" r="3.6" />
          <circle cx="6.8" cy="13" r="3.6" />
          <circle cx="17.2" cy="13" r="3.6" />
          <path d="M10.2 14.5 9 21.5h6l-1.2-7Z" />
        </>
      )}
    </svg>
  );
}

/**
 * Flat hard-edged card: solid colour bar, corner rank + suit chip and an
 * intel panel that slides up on hover. The pointer-tracked 3D tilt and
 * glare were replaced by the shared card lift (see .hard-surface).
 */
export function TiltCard({
  color,
  rank,
  details,
  detailsLabel = "INTEL",
  className,
  children,
}: {
  color: GColor;
  rank: string;
  details?: string;
  detailsLabel?: string;
  max?: number;
  className?: string;
  children: ReactNode;
}) {
  const hex = COLOR_HEX[color];
  const suit = SUIT_FOR[color];
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focused || pinned;

  return (
    <div
      className={cn("hard-surface relative h-full overflow-hidden", className)}
      tabIndex={details ? 0 : undefined}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => setPinned((value) => !value)}
    >
      {/* colour bar */}
      <span className="absolute inset-x-0 top-0 h-2" style={{ background: hex }} aria-hidden="true" />

      {/* corner index — accent chip so the rank stays legible in ink */}
      <div
        className="absolute top-5 left-4 z-[4] flex flex-col items-center gap-0.5 border-2 border-ink px-1.5 py-1"
        style={{ background: PANEL_HEX[color], color: ON_COLOR[color] }}
        aria-hidden="true"
      >
        <span className="font-display text-sm leading-none font-extrabold">{rank}</span>
        <SuitGlyph suit={suit} size={9} />
      </div>

      {/* content */}
      <div className="relative z-[2] h-full px-5 pt-16 pb-7">{children}</div>

      {/* hover intel panel */}
      {details && (
        <motion.div
          initial={false}
          animate={{ y: open ? 0 : "101%" }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-x-0 bottom-0 z-[5] border-t-[3px] px-5 py-4"
          style={{
            background: PANEL_HEX[color],
            borderTopColor: PANEL_EDGE[color],
            color: ON_COLOR[color],
          }}
        >
          <p className="font-display text-[11px] font-bold opacity-70">{detailsLabel}</p>
          <p className="mt-1 text-[13px] leading-snug font-semibold">{details}</p>
        </motion.div>
      )}
    </div>
  );
}

const HEADING_SHADOW: Record<GColor, string> = {
  gblue: "heading-shadow-blue",
  gred: "heading-shadow-red",
  gyellow: "heading-shadow-yellow",
  ggreen: "heading-shadow-green",
};

export function PageHeader({
  tag,
  title,
  color = "gblue",
  children,
}: {
  tag: string;
  title: string;
  color?: GColor;
  children?: ReactNode;
}) {
  return (
    <header>
      <SectionTag label={tag} color={color} />
      <h1 className={cn("mt-5 text-h2 break-words heading-shadow", HEADING_SHADOW[color])}>{title}</h1>
      {children && <div className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink/80">{children}</div>}
    </header>
  );
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function RollText({ children }: { children: ReactNode }) {
  return (
    <span className="roll-text">
      <span className="roll-text-line">{children}</span>
      <span className="roll-text-line roll-text-copy" aria-hidden="true">
        {children}
      </span>
    </span>
  );
}
