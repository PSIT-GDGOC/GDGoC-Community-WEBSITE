import { useEffect, useRef, useState } from "react";
import MemberCard from "./MemberCard";
import MemberNav from "./MemberNav";
import ProfileHero from "./profile/ProfileHero";
import ProfileSkills from "./profile/ProfileSkills";
import ProfileProjects from "./profile/ProfileProjects";
import CommunityJourney from "./profile/CommunityJourney";
import ProfilePreferences from "./profile/ProfilePreferences";
import ProfileEditorModal, { type EditorTab } from "./profile/ProfileEditorModal";
import AvatarCropModal from "./profile/AvatarCropModal";
import { api, type Profile as P } from "../lib/profile";
import { ticketSummary } from "../lib/dashboard";
import type { Ticket } from "../lib/tickets";

export const input =
  "w-full border-[3px] border-ink bg-bg px-3 py-2 text-ink disabled:bg-panel2 disabled:text-muted";
export const button =
  "hard-button bg-gyellow px-5 py-2.5 font-display font-bold text-ink disabled:opacity-60";

export default function Profile() {
  const [user, setUser] = useState<P | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorTab, setEditorTab] = useState<EditorTab>("personal");

  const openEditor = (tab: EditorTab = "personal") => {
    setEditorTab(tab);
    setEditorOpen(true);
  };

  const loadUser = async () => {
    setStatus("loading");
    try {
      const [me, ticketData] = await Promise.all([
        api<P>("/users/me"),
        api<{ tickets: Ticket[] }>("/tickets").catch(() => ({ tickets: [] })),
      ]);

      if (!me?.name) {
        throw new Error("bad response");
      }
      setUser(me);
      setTickets(ticketData?.tickets || []);
      setStatus("ready");
    } catch (error) {
      if ((error as Error).message === "401") {
        location.hash = "#/login?next=/profile";
      } else {
        setStatus("error");
      }
    }
  };

  useEffect(() => {
    loadUser();
  }, []);

  const summary = ticketSummary(tickets);
  const upcomingCount = summary.upcoming.length;
  const attendedCount = summary.attended;
  const registeredCount = tickets.filter(
    (t) => t.state !== "cancelled" && t.state !== "event_cancelled"
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      {user && <MemberNav active="profile" />}

      {user?.role === "admin" && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-wash-red p-3 shadow-[3px_3px_0_var(--color-ink)]">
          <span className="font-mono text-xs font-bold text-[#C5221F] uppercase">
            ⚡ Chapter Administrator Privileges Active
          </span>
          <a
            href="#/admin"
            className="hard-button inline-flex items-center gap-1.5 border-2 border-ink bg-gred px-3.5 py-1.5 font-display text-xs font-bold text-white shadow-[3px_3px_0_var(--color-ink)]"
          >
            <span>Open Admin Console →</span>
          </a>
        </div>
      )}

      {status === "loading" && (
        <div className="mt-10 border-[3px] border-ink bg-panel p-8 text-center shadow-[6px_6px_0_var(--color-ink)]" role="status">
          <p className="font-display text-lg font-bold">Loading your Developer Identity Hub…</p>
        </div>
      )}

      {status === "error" && (
        <div role="alert" className="mt-10 max-w-xl border-[3px] border-ink bg-bg p-6 shadow-[6px_6px_0_var(--color-ink)]">
          <p className="font-bold">We couldn't load your profile.</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <button type="button" className={`${button} mt-4`} onClick={loadUser}>
            Try again
          </button>
        </div>
      )}

      {user && status === "ready" && (
        <div className="space-y-10">
          {/* AREA 1: PROFILE HERO & IDENTITY */}
          <ProfileHero user={user} onOpenEditor={() => openEditor("personal")} />

          {/* MAIN HUB GRID: LEFT SHOWCASE COLUMN + RIGHT STICKY MEMBERSHIP CARD */}
          <div className="grid items-start gap-8 lg:grid-cols-[1fr_360px] lg:gap-10">
            {/* LEFT SHOWCASE FEED */}
            <div className="min-w-0 space-y-8">
              {/* AREA 2: ABOUT & TECHNICAL SKILLS */}
              <ProfileSkills user={user} onOpenSkillsEditor={() => openEditor("skills")} />

              {/* AREA 3: FEATURED PROJECTS */}
              <div>
                {user.privacy?.showProjects === false && (
                  <div className="mb-2 border-2 border-ink bg-wash-yellow px-3 py-1.5 font-mono text-[11px] font-bold text-[#B06000]">
                    👁 Private: Featured Projects are currently hidden from public view.
                  </div>
                )}
                <ProfileProjects
                  user={user}
                  onOpenProjectsEditor={() => openEditor("projects")}
                  onAddProject={() => openEditor("projects")}
                />
              </div>

              {/* AREA 4: COMMUNITY PARTICIPATION & TIMELINE */}
              <CommunityJourney tickets={tickets} />

              {/* AREA 6: PRIVACY & ACCOUNT PREFERENCES */}
              <ProfilePreferences user={user} onUpdated={setUser} />
            </div>

            {/* RIGHT SIDEBAR: AREA 5 (DIGITAL MEMBER CARD) & QUICK PHOTO CONTROL */}
            <aside className="mx-auto w-full max-w-[360px] space-y-6 lg:sticky lg:top-28">
              <MemberCard
                user={user}
                upcoming={upcomingCount}
                attended={user.privacy?.showAttendance !== false ? attendedCount : undefined}
                registered={registeredCount}
              />

              <QuickPhotoControl user={user} onSaved={setUser} onOpenMediaTab={() => openEditor("media")} />
            </aside>
          </div>
        </div>
      )}

      {/* TABBED PROFILE EDITOR MODAL */}
      {user && editorOpen && (
        <ProfileEditorModal
          user={user}
          initialTab={editorTab}
          onUpdated={setUser}
          onClose={() => setEditorOpen(false)}
        />
      )}
    </main>
  );
}

function QuickPhotoControl({
  user,
  onSaved,
  onOpenMediaTab,
}: {
  user: P;
  onSaved: (u: P) => void;
  onOpenMediaTab: () => void;
}) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (file.size > 2 * 1024 * 1024) {
      setMsg({ ok: false, text: "Image exceeds 2MB limit. Please choose a smaller photo." });
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMsg({ ok: false, text: "Only JPEG, PNG, and WebP images are allowed." });
      return;
    }

    setMsg(null);
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleCropComplete = async (dataUrl: string) => {
    setUploading(true);
    setMsg(null);
    try {
      const res = await api<{ message: string; user: P }>("/users/me/avatar", "POST", { dataUrl });
      onSaved(res.user || (res as unknown as P));
      setCropSrc(null);
      setMsg({ ok: true, text: "Profile photo updated." });
    } catch (err) {
      const message = (err as Error).message;
      const text = message === "401" ? "Your session expired. Log in again." : message;
      setMsg({ ok: false, text });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setRemoving(true);
    setMsg(null);
    try {
      const res = await api<{ message: string; user: P }>("/users/me/avatar", "DELETE");
      onSaved(res.user || (res as unknown as P));
      setMsg({ ok: true, text: "Profile photo removed." });
    } catch (err) {
      const message = (err as Error).message;
      const text = message === "401" ? "Your session expired. Log in again." : message;
      setMsg({ ok: false, text });
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="border-[3px] border-ink bg-bg p-4 shadow-[4px_4px_0_var(--color-ink)]">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-sm font-extrabold text-ink">Profile photo</h3>
        <button
          type="button"
          onClick={onOpenMediaTab}
          className="text-[11px] font-bold text-gblue hover:underline"
        >
          Banner settings →
        </button>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Displayed on your card, hero header, and event check-ins.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload profile photo"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="hard-button border-2 border-ink bg-gyellow px-3.5 py-1.5 font-display text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] disabled:opacity-60"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || removing}
        >
          {user.avatarUrl ? "Replace photo" : "Upload photo"}
        </button>

        {user.avatarUrl && (
          <button
            type="button"
            className="hard-button border-2 border-gred bg-bg px-3.5 py-1.5 font-display text-xs font-bold text-gred hover:bg-wash-red disabled:opacity-60"
            onClick={handleRemove}
            disabled={uploading || removing}
          >
            {removing ? "Removing…" : "Remove photo"}
          </button>
        )}
      </div>

      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`mt-3 text-xs font-bold ${msg.ok ? "text-ggreen" : "text-gred"}`}
        >
          {msg.text}
        </p>
      )}

      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          uploading={uploading}
          onSave={handleCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </section>
  );
}
