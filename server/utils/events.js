import { eventStatus, registrationDeadline } from "./domain.js";

export function seatsLeft(event) {
  if (!event.capacity) {
    return null;
  }
  return Math.max(event.capacity - event.registeredCount, 0);
}

export function statusOf(event, now = new Date()) {
  return eventStatus({ ...event.toObject(), seatsLeft: seatsLeft(event) }, now);
}

export function publicEvent(event, now = new Date()) {
  return {
    id: event.id,
    title: event.title,
    summary: event.summary,
    poster: event.poster,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    category: event.category,
    format: event.format,
    venue: event.venue,
    capacity: event.capacity ?? null,
    seatsLeft: seatsLeft(event),
    registrationDeadline: registrationDeadline(event),
    status: statusOf(event, now),
    createdAt: event.createdAt,
  };
}

export function publicEventDetail(event, now = new Date()) {
  return {
    ...publicEvent(event, now),
    description: event.description,
    host: event.host,
    prerequisites: event.prerequisites,
  };
}

export const CLOSED_MESSAGES = {
  full: "This event is full.",
  closed: "Registration for this event has closed.",
  ongoing: "This event has already started.",
  completed: "This event has ended.",
  cancelled: "This event was cancelled.",
};
