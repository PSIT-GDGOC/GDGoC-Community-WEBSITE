import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, useTransform, useVelocity } from "framer-motion";
import { Reveal, SectionTag, ScrambleHeading, SuitGlyph, SUIT_FOR, useMediaQuery } from "./ui";
import { EVENTS, COLOR_HEX, ON_COLOR, PANEL_EDGE, PANEL_HEX, type PastEvent } from "../data/content";

function EventCard({ e, rank }: { e: PastEvent; rank: string }) {
  const hex = COLOR_HEX[e.color];
  const suit = SUIT_FOR[e.color];
  const [hover, setHover] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const open = hover || focused || pinned;

  return (
    <div
      className="hard-surface relative flex h-full flex-col overflow-hidden"
      tabIndex={0}
      role="group"
      aria-label={`${e.title}, ${e.date}. Session report`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onClick={() => setPinned((value) => !value)}
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b-[3px] border-ink">
        <img src={e.image} alt={e.title} loading="lazy" className="h-full w-full object-cover" />
        <span
          className="absolute top-4 left-4 px-2.5 py-1 text-[11px] font-bold text-ink"
          style={{ background: PANEL_HEX[e.color] }}
        >
          {e.tag}
        </span>
        {/* corner index over the photo */}
        <span
          className="absolute top-4 right-4 flex flex-col items-center gap-0.5 border-2 border-ink px-2 py-1"
          style={{ background: PANEL_HEX[e.color], color: ON_COLOR[e.color] }}
          aria-hidden="true"
        >
          <span className="font-display text-xs leading-none font-extrabold">{rank}</span>
          <SuitGlyph suit={suit} size={8} />
        </span>
        <span className="absolute right-4 bottom-3 border-2 border-ink bg-bg px-2 py-0.5 text-[11px] font-semibold text-ink">
          {e.turnout}
        </span>
      </div>

      <div className="relative z-[2] flex flex-1 flex-col p-6">
        <p className="text-[11px] font-semibold text-muted">{e.date}</p>
        <h3 className="mt-2 font-display text-xl font-extrabold text-ink">{e.title}</h3>
        <p className="mt-auto flex items-center gap-2 pt-4 text-[11px] font-semibold text-ink" aria-hidden="true">
          <span style={{ color: hex }}>
            <SuitGlyph suit={suit} size={11} />
          </span>
          tap, hover or focus for the session report
        </p>
      </div>

      {/* session report — slides up on hover */}
      <motion.div
        initial={false}
        animate={{ y: open ? 0 : "101%" }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-x-0 bottom-0 z-[7] border-t-[3px] px-6 py-5"
        style={{ background: PANEL_HEX[e.color], borderTopColor: PANEL_EDGE[e.color], color: ON_COLOR[e.color] }}
      >
        <p className="text-[11px] font-bold opacity-70">Session report</p>
        <p className="mt-1.5 text-[13px] leading-snug font-semibold">{e.note}</p>
        <p className="mt-2 font-mono text-[11px] font-bold opacity-80">{e.detail}</p>
      </motion.div>
    </div>
  );
}

function EventsHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <SectionTag index="04" label="Event log" color="ggreen" />
        <ScrambleHeading text="Past drops & sessions" className="mt-5 text-h2 heading-shadow heading-shadow-green" />
      </div>
      <p className="max-w-sm text-[15px] leading-relaxed text-ink/80">
        Cards from the deck we've played so far - open source drives, workshops, study jams, watch parties and PR nights.
        Tap, hover or tab to any card for its session report.{" "}
        <a href="#/events" className="font-bold text-ink underline">
          See upcoming events →
        </a>
      </p>
    </div>
  );
}

function EventsGallery() {
  const sectionRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [distance, setDistance] = useState(0);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0, 1], [0, -distance]);
  const velocity = useVelocity(scrollYProgress);
  const lean = useSpring(useTransform(velocity, [-0.6, 0, 0.6], [5, 0, -5]), { stiffness: 220, damping: 28 });

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const measure = () => {
      setDistance(Math.max(0, track.scrollWidth - window.innerWidth));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="events"
      data-wash="blue"
      className="wash-section relative scroll-mt-20 border-b-[3px] border-ink"
      style={{ height: `calc(100vh + ${distance}px)` }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden pt-16">
        <div className="mx-auto w-full max-w-7xl px-8">
          <EventsHeader />
        </div>

        <motion.div
          ref={trackRef}
          className="mt-10 flex w-max items-stretch gap-8 pr-16 pl-[max(2rem,calc((100vw-80rem)/2+2rem))]"
          style={{ x }}
        >
          {EVENTS.map((e, i) => (
            <motion.div key={e.title} className="w-[380px] shrink-0 xl:w-[420px]" style={{ skewX: lean }}>
              <EventCard e={e} rank={String(i + 1).padStart(2, "0")} />
            </motion.div>
          ))}

          <motion.a
            href="#/events"
            className="group flex w-[320px] shrink-0 flex-col items-center justify-center gap-4 border-[3px] border-dashed border-ink bg-bg p-8 text-center transition-colors hover:border-solid hover:bg-wash-green focus-visible:border-solid focus-visible:bg-wash-green"
            style={{ skewX: lean }}
          >
            <span className="font-mono text-xs font-semibold tracking-[0.3em] text-muted uppercase">Next card</span>
            <span className="font-display text-3xl leading-tight font-extrabold text-ink">Upcoming events</span>
            <span className="hard-button bg-gyellow px-5 py-2.5 font-display text-sm font-bold">Browse and register →</span>
          </motion.a>
        </motion.div>

        <div className="mx-auto mt-10 h-[5px] w-full max-w-7xl px-8" aria-hidden="true">
          <motion.div className="h-full origin-left bg-ink" style={{ scaleX: scrollYProgress }} />
        </div>
      </div>
    </section>
  );
}

export default function Events() {
  const cinematic = useMediaQuery("(min-width: 1024px) and (prefers-reduced-motion: no-preference)");

  if (cinematic) {
    return <EventsGallery />;
  }

  return <EventsGrid />;
}

function EventsGrid() {
  return (
    <section id="events" data-wash="blue" className="wash-section relative scroll-mt-20 border-b-[3px] border-ink">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
        <EventsHeader />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {EVENTS.map((e, i) => (
            <Reveal key={e.title} delay={(i % 3) * 0.08} animate>
              <EventCard e={e} rank={String(i + 1).padStart(2, "0")} />
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-10 text-center">
            <a href="#/events" className="hard-button inline-block bg-gyellow px-5 py-2.5 font-display font-bold">
              Upcoming events: browse and register →
            </a>
          </p>
        </Reveal>
      </div>
    </section>
  );
}
