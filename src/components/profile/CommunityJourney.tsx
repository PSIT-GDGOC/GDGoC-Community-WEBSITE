import { type Ticket } from "../../lib/tickets";

export default function CommunityJourney({
  tickets,
}: {
  tickets: Ticket[];
}) {
  const activeTickets = tickets.filter(
    (t) => t.state !== "cancelled" && t.state !== "event_cancelled"
  );
  const now = new Date();

  const upcomingTickets = activeTickets.filter((t) => {
    if (!t.event?.startsAt) return false;
    return new Date(t.event.startsAt) >= now;
  });

  const attendedTickets = tickets.filter(
    (t) => t.state === "checked_in" || Boolean(t.attendedAt)
  );

  // Sort chronological for timeline (newest first)
  const timelineEvents = [...tickets].sort((a, b) => {
    const timeA = new Date(a.event?.startsAt || a.registeredAt).getTime();
    const timeB = new Date(b.event?.startsAt || b.registeredAt).getTime();
    return timeB - timeA;
  });

  return (
    <section className="border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7">
      <div className="border-b-2 border-ink pb-4">
        <h2 className="font-display text-xl font-black text-ink sm:text-2xl">
          Community Journey & Activity
        </h2>
        <p className="mt-1 text-xs text-muted sm:text-sm">
          Verified chapter participation, event registrations, and physical check-ins.
        </p>
      </div>

      {/* 3 Activity Metrics Grid */}
      <div className="mt-5 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="flex flex-col items-center justify-center border-2 border-ink bg-panel p-3 text-center shadow-[3px_3px_0_var(--color-ink)] sm:p-4">
          <span className="block font-display text-2xl font-black text-ink sm:text-3xl">
            {upcomingTickets.length}
          </span>
          <span className="mt-1 block text-[10px] font-bold tracking-wider text-muted uppercase sm:text-xs">
            Upcoming
          </span>
        </div>

        <div className="flex flex-col items-center justify-center border-2 border-ink bg-wash-green p-3 text-center shadow-[3px_3px_0_var(--color-ink)] sm:p-4">
          <span className="block font-display text-2xl font-black text-[#137333] sm:text-3xl">
            {attendedTickets.length}
          </span>
          <span className="mt-1 block text-[10px] font-bold tracking-wider text-[#137333] uppercase sm:text-xs">
            Attended (Verified)
          </span>
        </div>

        <div className="flex flex-col items-center justify-center border-2 border-ink bg-panel p-3 text-center shadow-[3px_3px_0_var(--color-ink)] sm:p-4">
          <span className="block font-display text-2xl font-black text-ink sm:text-3xl">
            {activeTickets.length}
          </span>
          <span className="mt-1 block text-[10px] font-bold tracking-wider text-muted uppercase sm:text-xs">
            Total Confirmed
          </span>
        </div>
      </div>

      {/* Community Timeline */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold text-ink">
            Participation Timeline
          </h3>
          <a
            href="#/tickets"
            className="text-xs font-bold text-gblue hover:underline"
          >
            All Tickets →
          </a>
        </div>

        {timelineEvents.length === 0 ? (
          <div className="mt-4 border-2 border-dashed border-ink/40 bg-panel/30 p-6 text-center">
            <p className="font-display text-sm font-bold text-ink">
              No event registrations yet
            </p>
            <p className="mt-1 text-xs text-muted">
              Register for upcoming GDGoC workshops, hackathons, and speaker sessions to start your journey.
            </p>
            <a
              href="#/events"
              className="hard-button mt-3 inline-block border-2 border-ink bg-gyellow px-4 py-2 font-display text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:bg-gyellow/80"
            >
              Browse Events →
            </a>
          </div>
        ) : (
          <div className="relative mt-6 space-y-4 pl-4 sm:pl-6 before:absolute before:top-2 before:bottom-2 before:left-2 before:w-0.5 before:bg-ink/30">
            {timelineEvents.map((t) => {
              const eventDate = t.event?.startsAt
                ? new Date(t.event.startsAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Date TBA";

              const isCheckedIn = t.state === "checked_in" || Boolean(t.attendedAt);
              const isCancelled = t.state === "cancelled" || t.state === "event_cancelled";
              const isFuture = t.event?.startsAt && new Date(t.event.startsAt) >= now;

              return (
                <div
                  key={t.ticketId}
                  className="relative flex flex-col justify-between gap-2 border-2 border-ink bg-bg p-3.5 shadow-[3px_3px_0_var(--color-ink)] sm:flex-row sm:items-center"
                >
                  {/* Timeline dot marker */}
                  <span
                    className={`absolute -left-[21px] sm:-left-[29px] top-4.5 h-3 w-3 rounded-full border-2 border-ink ${
                      isCheckedIn
                        ? "bg-ggreen"
                        : isCancelled
                        ? "bg-gred"
                        : isFuture
                        ? "bg-gyellow"
                        : "bg-panel2"
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-muted uppercase">
                        {eventDate}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-[10px] text-muted">
                        {t.event?.venue || "Campus Venue"}
                      </span>
                    </div>

                    <h4 className="mt-1 font-display text-sm font-bold text-ink truncate">
                      {t.event?.title || "GDGoC Campus Event"}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Pill */}
                    {isCheckedIn ? (
                      <span className="border border-ink bg-wash-green px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#137333]">
                        ✓ Checked In
                      </span>
                    ) : isCancelled ? (
                      <span className="border border-ink bg-wash-red px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#C5221F]">
                        ✕ Cancelled
                      </span>
                    ) : isFuture ? (
                      <span className="border border-ink bg-wash-yellow px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#B06000]">
                        ● Registered
                      </span>
                    ) : (
                      <span className="border border-ink bg-panel px-2.5 py-0.5 font-mono text-[10px] font-bold text-muted">
                        Past Event
                      </span>
                    )}

                    <a
                      href={`#/tickets/${t.ticketId}`}
                      className="border border-ink bg-panel px-2 py-0.5 text-xs font-bold text-ink hover:bg-gyellow"
                      title="View ticket pass"
                    >
                      Ticket →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

