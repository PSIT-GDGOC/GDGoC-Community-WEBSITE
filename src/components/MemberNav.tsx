import { useState } from "react";
import { api } from "../lib/profile";

const TABS = [
  { id: "dashboard", label: "Dashboard", href: "#/dashboard" },
  { id: "events", label: "Events", href: "#/events" },
  { id: "projects", label: "Projects", href: "#/projects" },
  { id: "tickets", label: "My tickets", href: "#/tickets" },
  { id: "profile", label: "Profile", href: "#/profile" },
] as const;

export type MemberTab = (typeof TABS)[number]["id"];

function tabClass(active: boolean) {
  return `inline-block border-[3px] border-ink px-3 py-1.5 text-sm font-bold ${active ? "bg-ink text-white" : "bg-bg hover:bg-panel"}`;
}

export default function MemberNav({ active }: { active: MemberTab }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const logout = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/auth/logout", "POST");
      location.hash = "#/login";
    } catch {
      setError("Couldn't log out. Try again.");
      setBusy(false);
    }
  };

  return (
    <nav aria-label="Member area" className="mb-10 flex flex-wrap items-center gap-2">
      <ul className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <li key={tab.id}>
            <a href={tab.href} aria-current={active === tab.id ? "page" : undefined} className={tabClass(active === tab.id)}>
              {tab.label}
            </a>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="hard-button ml-auto bg-bg px-3 py-1.5 text-sm font-bold disabled:opacity-60"
        onClick={logout}
        disabled={busy}
      >
        {busy ? "Logging out…" : "Log out"}
      </button>
      {error && (
        <p role="alert" className="w-full text-sm font-bold text-gred">
          {error}
        </p>
      )}
    </nav>
  );
}
