import { useEffect, useState } from "react";
import { api } from "../lib/profile";
import MemberNav from "./MemberNav";
import {
  dateStub,
  FILTERS,
  filterTickets,
  formatDateTime,
  isActive,
  sortTickets,
  STATES,
  type Ticket,
  type TicketFilter,
  type TicketState,
} from "../lib/tickets";

type Status = "loading" | "error" | "ready";

export function StatusBadge({ state }: { state: TicketState }) {
  return <Badge info={STATES[state]} />;
}

export function Badge({ info }: { info: { label: string; mark: string; color: string } }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 border-2 border-ink px-2 py-0.5 text-xs font-extrabold text-ink"
      style={{ background: info.color }}
    >
      <span aria-hidden="true">{info.mark}</span>
      {info.label}
    </span>
  );
}

function TicketCard({ ticket }: { ticket: Ticket }) {
  const stub = dateStub(ticket.event.startsAt);
  const stubColor = isActive(ticket) ? "bg-gyellow" : "bg-panel2";

  return (
    <li>
      <a href={`#/tickets/${ticket.ticketId}`} className="hard-surface grid grid-cols-[5.5rem_1fr] sm:grid-cols-[7rem_1fr]">
        <span
          className={`flex flex-col items-center justify-center border-r-[3px] border-dashed border-ink py-5 ${stubColor}`}
        >
          <span className="font-display text-xs font-extrabold tracking-widest">{stub.month}</span>
          <span className="font-display text-4xl leading-none font-extrabold">{stub.day}</span>
        </span>

        <span className="min-w-0 p-4 sm:p-5">
          <span className="block font-display text-lg leading-tight font-extrabold break-words sm:text-xl">
            {ticket.event.title}
          </span>
          <span className="mt-1 block text-sm text-muted">{formatDateTime(ticket.event.startsAt)}</span>
          {ticket.event.venue && <span className="block text-sm text-muted">{ticket.event.venue}</span>}
          <span className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <StatusBadge state={ticket.state} />
            <span className="text-sm font-bold underline">View ticket →</span>
          </span>
        </span>
      </a>
    </li>
  );
}

function LoadingList() {
  return (
    <div role="status" aria-label="Loading your tickets" className="mt-8 space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 animate-pulse border-[3px] border-ink/20 bg-panel2" />
      ))}
    </div>
  );
}

export default function Tickets() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [filter, setFilter] = useState<TicketFilter>("all");

  const load = async () => {
    setStatus("loading");
    try {
      const data = await api<{ tickets: Ticket[] }>("/tickets");
      if (!Array.isArray(data?.tickets)) {
        throw new Error("Unexpected response");
      }
      setTickets(sortTickets(data.tickets));
      setStatus("ready");
    } catch (error) {
      if ((error as Error).message === "401") {
        location.hash = "#/login?next=/tickets";
        return;
      }
      setStatus("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const visible = filterTickets(tickets, filter);
  const activeLabel = FILTERS.find((f) => f.id === filter)?.label.toLowerCase();

  return (
    <main className="mx-auto max-w-3xl px-4 pt-28 pb-20 sm:px-6">
      {status !== "loading" && <MemberNav active="tickets" />}
      <h1 className=" font-display text-4xl font-extrabold sm:text-5xl">My tickets</h1>
      <p className="mt-2 text-muted">Your event registrations and the QR codes you show at the door.</p>

      {status === "loading" && <LoadingList />}

      {status === "error" && (
        <div role="alert" className="mt-8 border-[3px] border-ink bg-bg p-6">
          <p className="font-bold">We couldn't load your tickets.</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <button type="button" className="hard-button mt-4 bg-gyellow px-5 py-2.5 font-display font-bold" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {status === "ready" && tickets.length === 0 && (
        <div className="mt-8 border-[3px] border-ink bg-bg p-6">
          <p className="font-display text-xl font-extrabold">No tickets yet</p>
          <p className="mt-1 text-muted">When you register for an event, its ticket shows up here.</p>
          <a href="#/events" className="hard-button mt-4 inline-block bg-gyellow px-5 py-2.5 font-display font-bold">
            Explore events
          </a>
        </div>
      )}

      {status === "ready" && tickets.length > 0 && (
        <>
          <div role="group" aria-label="Filter tickets" className="mt-8 flex flex-wrap gap-2">
            {FILTERS.map((f) => {
              const count = filterTickets(tickets, f.id).length;
              const active = filter === f.id;

              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.id)}
                  className={`border-[3px] border-ink px-3 py-1.5 text-sm font-bold ${active ? "bg-ink text-white" : "bg-bg"}`}
                >
                  {f.label} <span className={active ? "text-white/70" : "text-muted"}>{count}</span>
                </button>
              );
            })}
          </div>

          {visible.length > 0 ? (
            <ul className="mt-6 space-y-4">
              {visible.map((ticket) => (
                <TicketCard key={ticket.ticketId} ticket={ticket} />
              ))}
            </ul>
          ) : (
            <div className="mt-6 border-[3px] border-ink bg-bg p-6">
              <p className="font-bold">No {activeLabel} tickets.</p>
              <button type="button" className="mt-3 text-sm font-bold underline" onClick={() => setFilter("all")}>
                Show all tickets
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
