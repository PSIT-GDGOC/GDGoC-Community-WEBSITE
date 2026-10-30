import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import { cn } from "../utils/cn";
import { scrollToId, scrollToTop } from "../lib/scroll";
import { RollText, SuitGlyph, SUIT_FOR } from "./ui";
import GdgLogo from "./GdgLogo";
import { COLOR_HEX, ON_COLOR, PANEL_EDGE, PANEL_HEX, type GColor } from "../data/content";
import { api, type Profile } from "../lib/profile";

const NAV_ITEMS: { id: string; label: string; desc: string; color: GColor }[] = [
  { id: "board", label: "Board", desc: "what's pinned this week", color: "gblue" },
  { id: "about", label: "About", desc: "learn · connect · grow", color: "gred" },
  { id: "hacktober", label: "Open Source October", desc: "the month-long contribution drive", color: "gyellow" },
  { id: "events", label: "Events", desc: "the session log", color: "ggreen" },
  { id: "domains", label: "Domains", desc: "pick your lane", color: "gblue" },
  { id: "crew", label: "Crew", desc: "humans behind the board", color: "gred" },
];

/* the four brand colours, for the menu glyph */
const FOUR = [COLOR_HEX.gblue, COLOR_HEX.gred, COLOR_HEX.gyellow, COLOR_HEX.ggreen];

type Edge = "left" | "right" | "top" | "bottom";

/* One full-bleed row. The color fill floods in from whichever edge
   the pointer crossed — computed from the mouseenter coordinates. */
function MenuRow({
  index,
  label,
  desc,
  color,
  onClick,
  emphasized = false,
}: {
  index: string;
  label: string;
  desc: string;
  color: GColor;
  onClick: () => void;
  emphasized?: boolean;
}) {
  const hex = COLOR_HEX[color];
  const fill = PANEL_HEX[color];
  const onFill = ON_COLOR[color];
  const [origin, setOrigin] = useState<Edge>("left");
  const [hover, setHover] = useState(false);

  const handleEnter = (e: ReactMouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const dLeft = e.clientX - r.left;
    const dRight = r.right - e.clientX;
    const dTop = e.clientY - r.top;
    const dBottom = r.bottom - e.clientY;
    const min = Math.min(dLeft, dRight, dTop, dBottom);
    setOrigin(min === dLeft ? "left" : min === dRight ? "right" : min === dTop ? "top" : "bottom");
    setHover(true);
  };

  const axisY = origin === "top" || origin === "bottom";
  const hidden = axisY ? "scale(1, 0)" : "scale(0, 1)";

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={handleEnter}
      onMouseLeave={() => setHover(false)}
      className={cn(
        "group relative block w-full overflow-hidden border-b-[3px] border-ink text-left",
        emphasized && "bg-panel"
      )}
    >
      {/* directional flood fill */}
      <span
        className="absolute inset-0"
        style={{
          background: fill,
          boxShadow: `inset 6px 0 0 0 ${PANEL_EDGE[color]}`,
          transformOrigin: origin,
          transform: hover ? "scale(1, 1)" : hidden,
          transition: "transform 380ms cubic-bezier(0.76, 0, 0.24, 1)",
        }}
        aria-hidden="true"
      />
      <span className="relative z-10 flex items-center justify-between gap-4 px-6 py-4 sm:px-12 lg:px-20 lg:py-5">
        <span className="flex items-baseline gap-4 sm:gap-6">
          <span
            className="text-sm font-semibold transition-colors duration-300"
            style={{ color: hover ? onFill : "var(--color-muted)", opacity: hover ? 0.75 : 1 }}
          >
            {index}
          </span>
          <span className="self-center transition-colors duration-300" style={{ color: hover ? onFill : hex }} aria-hidden="true">
            <SuitGlyph suit={SUIT_FOR[color]} size={13} />
          </span>
          <span
            className={cn(
              "font-display text-[clamp(1.6rem,4.4vw,3rem)] leading-none font-extrabold tracking-tight transition-transform duration-300",
              hover && "translate-x-2"
            )}
            style={{ color: hover ? onFill : "var(--color-ink)" }}
          >
            {label}
          </span>
        </span>
        <span className="flex items-center gap-5">
          <span
            className="hidden text-sm font-medium transition-colors duration-300 md:block"
            style={{ color: hover ? onFill : "var(--color-muted)", opacity: hover ? 0.8 : 1 }}
          >
            {desc}
          </span>
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            className="shrink-0 transition-transform duration-300"
            style={{ color: hover ? onFill : "var(--color-ink)" }}
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </span>
      </span>
    </button>
  );
}

function AccountLink({ user }: { user: Profile | null }) {
  if (!user) {
    return (
      <a
        href="#/login"
        className="hard-button inline-flex items-center bg-bg px-4 py-2 font-display text-sm font-bold text-ink"
      >
        <RollText>Log in</RollText>
      </a>
    );
  }

  const initial = user.name.trim().charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-2">
      {user.role === "admin" && (
        <a
          href="#/admin"
          aria-label="Admin console"
          className="hard-button hidden sm:inline-flex items-center gap-1.5 border-2 border-ink bg-gred px-2.5 py-1 font-mono text-xs font-bold text-white shadow-[2px_2px_0_var(--color-ink)] hover:bg-gred/90"
        >
          <span>⚡</span>
          <span>Admin</span>
        </a>
      )}
      <a
        href="#/profile"
        aria-label="Your profile"
        className="hard-button inline-flex items-center gap-2 bg-bg px-2 py-1.5 font-display text-sm font-bold text-ink sm:px-3"
      >
        <span className="grid h-6 w-6 place-items-center border-2 border-ink bg-gblue text-xs text-white">
          {initial}
        </span>
        <span className="hidden sm:inline">Profile</span>
      </a>
    </div>
  );
}

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Profile | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 28, mass: 0.4 });
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    api<Profile>("/users/me")
      .then((me) => {
        setUser(me);
      })
      .catch(() => {
        setUser(null);
      });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* escape closes · body scroll lock while open */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLButtonElement>("nav button")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  const onHomepage = () => !location.hash.startsWith("#/");

  const go = (id: string) => {
    setOpen(false);
    if (onHomepage()) {
      scrollToId(id);
      return;
    }
    location.hash = "";

    let attempts = 0;
    const scrollWhenReady = () => {
      attempts += 1;
      if (document.getElementById(id) || attempts > 40) {
        scrollToId(id);
        return;
      }
      requestAnimationFrame(scrollWhenReady);
    };
    requestAnimationFrame(scrollWhenReady);
  };

  const goHome = () => {
    setOpen(false);
    if (onHomepage()) {
      scrollToTop();
    } else {
      location.hash = "";
    }
  };

  return (
    <>
      {/* scroll progress — four chapter colors */}
      <motion.div
        className="fixed top-0 right-0 left-0 z-[80] flex h-[5px] origin-left print:hidden"
        style={{ scaleX: progress }}
        aria-hidden="true"
      >
        <span className="flex-1 bg-gblue" />
        <span className="flex-1 bg-gred" />
        <span className="flex-1 bg-gyellow" />
        <span className="flex-1 bg-ggreen" />
      </motion.div>

      <header
        className={cn(
          "fixed top-0 right-0 left-0 z-[60] transition-all duration-300 print:hidden",
          scrolled || open ? "border-b-[3px] border-ink bg-bg" : "border-b-[3px] border-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <button
            type="button"
            onClick={goHome}
            className="group flex items-center gap-3"
            aria-label="GDGoC PSIT home"
          >
            {/* official mark, unmodified and undecorated - no hover rotation */}
            <GdgLogo variant="mark" size={30} alt="Google Developer Groups" />
            <span className="font-display text-[15px] font-extrabold">
              GDGoC<span className="text-gblue">·</span>PSIT
            </span>
            <span className="hidden border-2 border-ink px-1.5 py-0.5 text-[11px] font-semibold text-ink sm:inline">
              Kanpur
            </span>
          </button>

          <div className="flex items-center gap-3">
            <AccountLink user={user} />

            {/* the single menu button opens the board */}
            <button
              type="button"
              ref={menuButtonRef}
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="site-menu"
              className="hard-button group flex items-center gap-3 bg-gyellow px-4 py-2 font-display text-sm font-bold text-ink"
            >
              <span className="grid grid-cols-2 gap-[3px]">
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      "h-[5px] w-[5px] transition-all duration-300",
                      open ? "bg-ink" : "bg-current",
                      open && i === 0 && "translate-x-[3px] translate-y-[3px]",
                      open && i === 3 && "-translate-x-[3px] -translate-y-[3px]"
                    )}
                    style={
                      !open
                        ? { background: FOUR[i] }
                        : undefined
                    }
                  />
                ))}
              </span>
              {open ? "Close" : "Menu"}
            </button>
          </div>
        </div>
      </header>

      {/* full-screen dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            id="site-menu"
            initial={{ clipPath: "inset(0 0 100% 0)" }}
            animate={{ clipPath: "inset(0 0 0% 0)" }}
            exit={{ clipPath: "inset(0 0 100% 0)" }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
            className="fixed inset-0 z-[55] overflow-y-auto border-t-[3px] border-ink bg-bg"
          >
            <div className="flex min-h-full flex-col justify-center pt-16 pb-16">
              <p className="px-6 pt-4 pb-3 font-mono text-xs text-muted sm:px-12 lg:px-20">
                Navigate the board
              </p>
              <nav className="border-t-[3px] border-ink">
                {NAV_ITEMS.map((item, i) => (
                  <MenuRow
                    key={item.id}
                    index={`0${i + 1}`}
                    label={item.label}
                    desc={item.desc}
                    color={item.color}
                    onClick={() => go(item.id)}
                  />
                ))}
                <MenuRow
                  index="07"
                  label="Join us"
                  desc="open a PR on your future"
                  color="gyellow"
                  onClick={() => go("join")}
                  emphasized
                />
                <MenuRow
                  index="08"
                  label="Upcoming events"
                  desc="browse and register"
                  color="ggreen"
                  onClick={() => {
                    setOpen(false);
                    location.hash = "#/events";
                  }}
                />
                <MenuRow
                  index="09"
                  label={user ? "Your profile" : "Log in"}
                  desc={user ? "account and settings" : "members area"}
                  color="gblue"
                  onClick={() => {
                    setOpen(false);
                    location.hash = user ? "#/profile" : "#/login";
                  }}
                />
                {user?.role === "admin" && (
                  <MenuRow
                    index="⚡"
                    label="Admin Console"
                    desc="events, roster & QR scanner"
                    color="gred"
                    onClick={() => {
                      setOpen(false);
                      location.hash = "#/admin";
                    }}
                    emphasized
                  />
                )}
              </nav>

              {/* status strip */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 px-6 sm:px-12 lg:px-20">
                <span className="flex items-center gap-2.5 text-sm font-semibold text-muted">
                  <span className="animate-pulse-dot h-2.5 w-2.5 border-2 border-ink bg-ggreen" />
                  season 04 · active
                </span>
                <span className="hidden text-sm font-semibold text-muted md:block">
                  PSIT · Kanpur · India
                </span>
                <a
                  href="https://gdg.community.dev"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-draw text-sm font-bold text-ink"
                >
                  gdg.community.dev
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
