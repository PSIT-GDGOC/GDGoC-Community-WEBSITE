import { useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import Lenis from "lenis";
import Nav from "./components/Nav";
import Hero from "./components/Hero";
import Stats from "./components/Stats";
import NoticeBoard from "./components/NoticeBoard";
import About from "./components/About";
import Hacktober from "./components/Hacktober";
import Events from "./components/Events";
import Domains from "./components/Domains";
import Crew from "./components/Crew";
import Join from "./components/Join";
import Footer from "./components/Footer";
import Cursor from "./components/Cursor";
import GDGoCIntro from "./components/intro/GDGoCIntro";
import Profile from "./components/Profile";
import Auth from "./components/Auth";
import Tickets from "./components/Tickets";
import TicketDetail from "./components/TicketDetail";
import EventsPage from "./components/EventsPage";
import EventDetail from "./components/EventDetail";
import Dashboard from "./components/Dashboard";
import ProjectsPage from "./components/ProjectsPage";
import NotFound from "./components/NotFound";
import Admin from "./components/Admin";
import PageWipe, { usePageWipe } from "./components/PageWipe";
import DeckTracker from "./components/DeckTracker";
import DeckWorld from "./components/world/DeckWorld";
import FinaleStage from "./components/world/FinaleStage";
import { useCinematic } from "./components/three/Card3D";
import { setLenis } from "./lib/scroll";

export default function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const onHash = () => setHash(location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const pages = {
    "#/profile": Profile,
    "#/login": Auth,
    "#/tickets": Tickets,
    "#/events": EventsPage,
    "#/dashboard": Dashboard,
    "#/projects": ProjectsPage,
    "#/admin": Admin,
  };
  const { shownHash, wipeId } = usePageWipe(hash);
  const cinematic = useCinematic();
  const route = shownHash.split("?")[0];
  let page = pages[route as keyof typeof pages];
  if (route.startsWith("#/tickets/")) {
    page = TicketDetail;
  }
  if (route.startsWith("#/events/")) {
    page = EventDetail;
  }
  if (!page && route.length > 2 && route.startsWith("#/")) {
    page = NotFound;
  }

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    setLenis(lenis);

    let rafId = 0;
    const raf = (time: number) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      setLenis(null);
    };
  }, []);

  /* effect 4: each section picks up its tint wash as it enters view */
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>("main > section"));
    if (sections.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-in");
        }
      },
      { rootMargin: "-20% 0px -20% 0px" }
    );
    for (const s of sections) io.observe(s);
    return () => io.disconnect();
  }, [page]);

  let content: ReactNode;
  if (page) {
    const Page = page;
    content = (
      <div className="paper-ground min-h-screen bg-bg font-body text-ink">
        <Nav key={`nav-${route}`} />
        <Page key={`page-${route}`} />
        <Cursor />
      </div>
    );
  } else {
    content = (
      <MotionConfig reducedMotion="user">
        <div className="relative min-h-screen bg-bg font-body text-ink">
          {/* No page-wide starfield here: the universe belongs to the hero
             alone (it owns and pauses the canvas), and the sections below
             are the paper world. A full-page copy would paint 61 MB of
             bitmap under opaque backgrounds for nothing. */}
          {cinematic && <DeckWorld />}
          <Nav />
          <main className="relative z-[1]">
            <Hero />
            <Stats />
            <NoticeBoard />
            <About />
            <Hacktober />
            <Events />
            <Domains />
            <Crew />
            <Join />
          </main>
          {cinematic && (
            <div className="relative z-[1]">
              <FinaleStage />
            </div>
          )}
          <div className="relative z-[1]">
            <Footer />
          </div>
          <DeckTracker />
          <Cursor />
          <div className="noise-overlay" aria-hidden="true" />
          <GDGoCIntro />
        </div>
      </MotionConfig>
    );
  }

  return (
    <>
      {content}
      <PageWipe wipeId={wipeId} />
    </>
  );
}
