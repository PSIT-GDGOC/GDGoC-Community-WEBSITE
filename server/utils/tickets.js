import { eventEndsAt } from "./domain.js";

export const TICKET_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/;

export function ticketState(registration, event, now = new Date()) {
  if (registration.status === "cancelled") {
    return "cancelled";
  }
  if (event.cancelled) {
    return "event_cancelled";
  }
  if (registration.attendedAt) {
    return "checked_in";
  }
  if (registration.status === "pending") {
    return "pending";
  }

  if (eventEndsAt(event) < now) {
    return "expired";
  }
  return "confirmed";
}

export function canAdmit(registration, event, now = new Date()) {
  return ticketState(registration, event, now) === "confirmed";
}

export function publicTicket(registration, now = new Date()) {
  const event = registration.event;

  return {
    ticketId: registration.ticketId,
    state: ticketState(registration, event, now),
    registeredAt: registration.createdAt,
    attendedAt: registration.attendedAt,
    event: {
      id: event.id,
      title: event.title,
      summary: event.summary,
      startsAt: event.startsAt,
      endsAt: event.endsAt ?? null,
      venue: event.venue,
      poster: event.poster,
    },
  };
}
