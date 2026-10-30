import mongoose from "mongoose";
import Event from "./models/Event.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

await mongoose.connect(process.env.MONGO_URI);

const now = Date.now();
const at = (days, hour) => {
  const date = new Date(now + days * DAY_MS);
  date.setUTCHours(hour - 5, 30, 0, 0);
  return date;
};

const samples = [
  {
    title: "Sample: Cloud Study Jam #3",
    summary: "Hands-on Google Cloud labs with mentors in the room.",
    description:
      "Bring a laptop and work through guided Google Cloud labs.\n\nMentors from the core team will help you set up your account, finish the labs and earn the skill badges.",
    category: "Study Jam",
    format: "in_person",
    venue: "Block C Lab",
    host: "Cloud lane, GDGoC PSIT",
    prerequisites: "A laptop and a Google account.",
    capacity: 60,
    startsAt: at(6, 16),
    endsAt: at(6, 18),
  },
  {
    title: "Sample: Intro to Flutter",
    summary: "Build and run your first Flutter app in one evening.",
    description: "We start from an empty project and finish with an app running on your phone.",
    category: "Workshop",
    format: "in_person",
    venue: "Seminar Hall",
    host: "Android & Flutter lane",
    prerequisites: "Flutter SDK installed. Setup guide is shared after you register.",
    capacity: 2,
    startsAt: at(10, 15),
    endsAt: at(10, 17),
  },
  {
    title: "Sample: GenAI Office Hours",
    summary: "Ask anything about Gemini, prompting and building with LLMs.",
    description: "An open online session. Drop in with questions or a project you're stuck on.",
    category: "Talk",
    format: "online",
    venue: "Google Meet",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    host: "AI/ML lane",
    startsAt: at(3, 19),
    endsAt: at(3, 20),
  },
  {
    title: "Open Source October 2026",
    summary: "Find a first issue and open your first pull request. 24 days of open contributions.",
    category: "Open Source",
    format: "in_person",
    venue: "Auditorium & Online",
    startsAt: at(-22, 10),
    endsAt: at(-1, 23),
    registrationDeadline: at(-23, 18),
  },
  {
    title: "Sample: DevFest Watch Party",
    summary: "Watching the DevFest keynote together.",
    category: "Meetup",
    format: "in_person",
    venue: "Auditorium",
    startsAt: at(14, 17),
    cancelled: true,
  },
  {
    title: "Sample: Git & GitHub Basics",
    summary: "Branches, commits and pull requests without the fear.",
    category: "Workshop",
    format: "in_person",
    venue: "Block C Lab",
    startsAt: at(-12, 16),
    endsAt: new Date(at(-12, 16).getTime() + 2 * HOUR_MS),
  },
];

for (const sample of samples) {
  await Event.create({ ...sample, published: true });
}

console.log(`Added ${samples.length} sample events.`);
await mongoose.disconnect();
