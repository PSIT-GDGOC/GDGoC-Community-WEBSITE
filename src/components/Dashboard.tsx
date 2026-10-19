import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { api, type Profile } from "../lib/profile";
import { EVENT_STATUS, formatEventTime, type EventSummary } from "../lib/events";
import { firstName, listText, missingDetails, ticketSummary, upcomingEvents } from "../lib/dashboard";
import type { Ticket } from "../lib/tickets";
import MemberCard from "./MemberCard";
import MemberNav from "./MemberNav";
import { Badge, StatusBadge } from "./Tickets";
import { PageHeader } from "./ui";

type Status = "loading" | "error" | "ready";

const LOGIN = "#/login?next=/dashboard";
const GITHUB = "https://github.com/PSIT-GDGOC";
const action = "hard-button inline-block bg-gyellow px-4 py-2 font-display text-sm font-bold";
const plain = "hard-button inline-block bg-bg px-4 py-2 font-display text-sm font-bold";

function useList<T>(path: string, key: string) {
  const [status, setStatus] = useState<Status>("loading");
  const [items, setItems] = useState<T[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      const body = await api<Record<string, unknown>>(path);
      const list = body?.[key];
      if (!Array.isArray(list)) {
        throw new Error("Unexpected response");
      }
      if (mounted.current) {
        setItems(list as T[]);
        setStatus("ready");
      }
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      if ((error as Error).message === "401") {
        location.hash = LOGIN;
        return;
      }
      setStatus("error");
    }
  }, [path, key]);

  useEffect(() => {
    load();
  }, [load]);

  return { status, items, reload: load };
}

function Panel({ title, children, footer }: { title: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-6"
    >
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <div className="mt-3 flex-1">{children}</div>
      {footer && <div className="mt-5 flex flex-wrap gap-3">{footer}</div>}
    </section>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-2">
      <div className="h-4 w-3/4 animate-pulse bg-panel2" />
      <div className="h-4 w-1/2 animate-pulse bg-panel2" />
    </div>
  );
}

function Failed({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div role="alert">
      <p className="text-sm font-semibold">{text}</p>
      <button type="button" className="mt-2 text-sm font-bold underline" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

function EventsCard() {
  const { status, items, reload } = useList<EventSummary>("/events", "events");
  const upcoming = upcomingEvents(items);

  return (
    <Panel
      title="Events"
      footer={
        <a href="#/events" className={action}>
          Browse events →
        </a>
      }
    >
      <p className="text-sm text-muted">Workshops, study jams and talks. Read the details and register in one click.</p>
      <div className="mt-4">
        {status === "loading" && <Skeleton label="Loading upcoming events" />}
        {status === "error" && <Failed text="We couldn't load upcoming events." onRetry={reload} />}
        {status === "ready" && upcoming.length === 0 && (
          <p className="text-sm font-semibold">No upcoming events right now. New sessions show up here first.</p>
        )}
        {status === "ready" && upcoming.length > 0 && (
          <>
            <p className="text-sm font-bold">
              {upcoming.length} upcoming {upcoming.length === 1 ? "event" : "events"}
            </p>
            <ul className="mt-2 space-y-2">
              {upcoming.slice(0, 3).map((event) => (
                <li key={event.id}>
                  <a href={`#/events/${event.id}`} className="block border-[3px] border-ink bg-bg p-3 hover:bg-panel">
                    <span className="block font-bold break-words">{event.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <Badge info={EVENT_STATUS[event.status]} />
                      {formatEventTime(event.startsAt)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Panel>
  );
}

function ProjectsCard() {
  return (
    <Panel
      title="Projects"
      footer={
        <>
          <a href="#/projects" className={action}>
            Open projects →
          </a>
          <a href={GITHUB} target="_blank" rel="noreferrer" className={plain}>
            GitHub ↗
          </a>
        </>
      }
    >
      <p className="text-sm text-muted">Explore what members are building, the tech behind it and how to contribute.</p>
      <p className="mt-4 text-sm font-semibold">
        The project showcase is being set up. Until then, our open-source work lives on GitHub.
      </p>
    </Panel>
  );
}

function RegistrationsCard({ status, upcoming, onRetry }: { status: Status; upcoming: Ticket[]; onRetry: () => void }) {
  return (
    <Panel
      title="Your registrations"
      footer={
        <a href="#/tickets" className={plain}>
          All my tickets →
        </a>
      }
    >
      {status === "loading" && <Skeleton label="Loading your registrations" />}
      {status === "error" && <Failed text="We couldn't load your registrations." onRetry={onRetry} />}
      {status === "ready" && upcoming.length === 0 && (
        <div>
          <p className="text-sm font-semibold">You haven't registered for an upcoming event yet.</p>
          <a href="#/events" className="mt-2 inline-block text-sm font-bold underline">
            Find an event →
          </a>
        </div>
      )}
      {status === "ready" && upcoming.length > 0 && (
        <ul className="space-y-2">
          {upcoming.slice(0, 3).map((ticket) => (
            <li key={ticket.ticketId}>
              <a href={`#/tickets/${ticket.ticketId}`} className="block border-[3px] border-ink bg-bg p-3 hover:bg-panel">
                <span className="block font-bold break-words">{ticket.event.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <StatusBadge state={ticket.state} />
                  {formatEventTime(ticket.event.startsAt)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ProfileStatus({ user }: { user: Profile }) {
  const missing = missingDetails(user);

  if (missing.length === 0) {
    return (
      <p className="text-sm font-semibold">
        Your profile is complete.{" "}
        <a href="#/profile" className="font-bold underline">
          Edit profile
        </a>
      </p>
    );
  }

  return (
    <div className="border-[3px] border-ink bg-wash-yellow p-4">
      <p className="text-sm font-semibold">
        Add your {listText(missing)} so organisers know who's coming.
      </p>
      <a href="#/profile" className="mt-2 inline-block text-sm font-bold underline">
        Complete your profile →
      </a>
    </div>
  );
}

function Account({ user }: { user: Profile }) {
  const tickets = useList<Ticket>("/tickets", "tickets");
  const summary = ticketSummary(tickets.items);
  const ready = tickets.status === "ready";

  return (
    <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,340px)_1fr] lg:gap-12">
      <aside className="mx-auto w-full max-w-[340px] space-y-6" aria-label="Your account">
        <MemberCard
          user={user}
          upcoming={ready ? summary.upcoming.length : null}
          attended={ready ? summary.attended : null}
        />
        <ProfileStatus user={user} />
      </aside>

      <div className="grid min-w-0 gap-6 md:grid-cols-2">
        <EventsCard />
        <ProjectsCard />
        <div className="md:col-span-2">
          <RegistrationsCard status={tickets.status} upcoming={summary.upcoming} onRetry={tickets.reload} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [user, setUser] = useState<Profile | null>(null);
  const [status, setStatus] = useState<Status>("loading");

  const load = async () => {
    setStatus("loading");
    try {
      const me = await api<Profile>("/users/me");
      if (!me?.name || !me.email) {
        throw new Error("Unexpected response");
      }
      setUser(me);
      setStatus("ready");
    } catch (error) {
      if ((error as Error).message === "401") {
        location.hash = LOGIN;
        return;
      }
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      {status === "loading" && (
        <div role="status" aria-label="Checking your session" className="space-y-4">
          <div className="h-10 w-2/3 max-w-md animate-pulse bg-panel2" />
          <div className="h-5 w-1/2 max-w-sm animate-pulse bg-panel2" />
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="max-w-xl border-[3px] border-ink bg-bg p-6">
          <p className="font-bold">We couldn't reach the server to open your dashboard.</p>
          <p className="mt-1 text-sm text-muted">This is a connection problem, not your account. Try again in a moment.</p>
          <button type="button" className={`${action} mt-4`} onClick={load}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && user && (
        <>
          <MemberNav active="dashboard" />
          <PageHeader tag="Member area" title={`Hi, ${firstName(user.name)}`} color="gblue">
            Your GDGoC PSIT home. Find your next event, keep track of your tickets and see what the community is
            building.
          </PageHeader>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#/events" className={action}>
              Find an event
            </a>
            <a href="#/tickets" className={plain}>
              My tickets
            </a>
          </div>
          <Account user={user} />
        </>
      )}
    </main>
  );
}
