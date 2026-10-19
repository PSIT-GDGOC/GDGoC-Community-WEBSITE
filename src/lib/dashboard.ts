import { applyQuery, DEFAULT_QUERY, type EventSummary } from "./events.ts";
import type { Profile } from "./profile.ts";
import { isActive, sortTickets, type Ticket } from "./tickets.ts";

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

export function missingDetails(user: Profile) {
  const missing: string[] = [];

  if (!user.branch) {
    missing.push("branch");
  }
  if (!user.year) {
    missing.push("year");
  }
  if (!user.bio?.trim()) {
    missing.push("short bio");
  }
  return missing;
}

export function listText(items: string[]) {
  if (items.length < 2) {
    return items.join("");
  }
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function upcomingEvents(events: EventSummary[]) {
  return applyQuery(events, DEFAULT_QUERY);
}

export function ticketSummary(tickets: Ticket[], now = new Date()) {
  const upcoming = sortTickets(tickets.filter((ticket) => isActive(ticket, now)), now);
  const attended = tickets.filter((ticket) => ticket.state === "checked_in").length;

  return { upcoming, attended };
}
