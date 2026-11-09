import { useState } from "react";
import {
  api,
  type Profile,
  BANNER_THEMES,
  ACCENT_COLORS,
  CARD_THEMES,
} from "../../lib/profile";

export default function ProfilePreferences({
  user,
  onUpdated,
}: {
  user: Profile;
  onUpdated: (u: Profile) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [privacy, setPrivacy] = useState({
    showEmail: Boolean(user.privacy?.showEmail),
    showAttendance: user.privacy?.showAttendance !== false,
    showProjects: user.privacy?.showProjects !== false,
  });
  const [accentColor, setAccentColor] = useState(user.accentColor || "gblue");
  const [cardTheme, setCardTheme] = useState(user.cardTheme || "default");
  const [bannerTheme, setBannerTheme] = useState(user.bannerTheme || "google-brand");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const currentBannerLabel =
    BANNER_THEMES.find((t) => t.id === (user.bannerTheme || "google-brand"))?.label || "Google Brand";
  const currentCardLabel =
    CARD_THEMES.find((t) => t.id === (user.cardTheme || "default"))?.label || "Standard Brand";
  const currentAccent =
    ACCENT_COLORS.find((c) => c.id === (user.accentColor || "gblue")) || ACCENT_COLORS[0];

  const startEditing = () => {
    setPrivacy({
      showEmail: Boolean(user.privacy?.showEmail),
      showAttendance: user.privacy?.showAttendance !== false,
      showProjects: user.privacy?.showProjects !== false,
    });
    setAccentColor(user.accentColor || "gblue");
    setCardTheme(user.cardTheme || "default");
    setBannerTheme(user.bannerTheme || "google-brand");
    setMsg(null);
    setEditing(true);
  };

  const savePreferences = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api<Profile>("/users/me", "PATCH", {
        privacy,
        accentColor,
        cardTheme,
        bannerTheme,
      });
      onUpdated(updated);
      setEditing(false);
      setMsg({ ok: true, text: "Preferences saved successfully." });
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message || "Failed to save preferences." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <h2 className="font-display text-xl font-black text-ink sm:text-2xl">
            Privacy & Account Preferences
          </h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Appearance settings, visibility controls, and account verification overview.
          </p>
        </div>

        <button
          type="button"
          onClick={() => (editing ? setEditing(false) : startEditing())}
          className="hard-button border-2 border-ink bg-panel px-3.5 py-1.5 font-display text-xs font-bold text-ink hover:bg-gyellow shadow-[2px_2px_0_var(--color-ink)]"
        >
          {editing ? "Cancel" : "⚙ Configure"}
        </button>
      </div>

      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`mt-4 border-2 border-ink p-2.5 text-xs font-bold ${
            msg.ok ? "bg-wash-green text-[#137333]" : "bg-wash-red text-[#C5221F]"
          }`}
        >
          {msg.text}
        </p>
      )}

      {!editing ? (
        /* VIEW MODE: Clean status summary */
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="border-2 border-ink bg-panel p-4 shadow-[3px_3px_0_var(--color-ink)]">
            <h3 className="font-mono text-[11px] font-bold tracking-wider text-muted uppercase">
              Identity Visuals
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted font-medium">Banner Theme:</dt>
                <dd className="font-bold text-ink">{currentBannerLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted font-medium">Card Theme:</dt>
                <dd className="font-bold text-ink">{currentCardLabel}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted font-medium">Accent Color:</dt>
                <dd className="flex items-center gap-1.5 font-bold text-ink">
                  <span
                    className="h-3 w-3 rounded-full border border-ink"
                    style={{ backgroundColor: currentAccent.bg }}
                  />
                  {currentAccent.label}
                </dd>
              </div>
            </dl>
          </div>

          <div className="border-2 border-ink bg-panel p-4 shadow-[3px_3px_0_var(--color-ink)]">
            <h3 className="font-mono text-[11px] font-bold tracking-wider text-muted uppercase">
              Privacy & Security
            </h3>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <dt className="text-muted font-medium">Public Email:</dt>
                <dd className={`font-bold ${user.privacy?.showEmail ? "text-gblue" : "text-ink"}`}>
                  {user.privacy?.showEmail ? "Visible" : "Hidden (Private)"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted font-medium">Attendance Stats:</dt>
                <dd className="font-bold text-ink">
                  {user.privacy?.showAttendance !== false ? "Visible" : "Hidden"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted font-medium">Projects Showcase:</dt>
                <dd className="font-bold text-ink">
                  {user.privacy?.showProjects !== false ? "Visible" : "Hidden"}
                </dd>
              </div>
            </dl>
            <div className="mt-3 border-t border-ink/15 pt-2 text-[11px] text-muted">
              Need to change your password? Use{" "}
              <a href="#/forgot-password" className="font-bold text-gblue hover:underline">
                email password recovery →
              </a>
            </div>
          </div>
        </div>
      ) : (
        /* EDIT MODE: Interactive appearance & privacy controls */
        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
              Cover Banner Theme
            </h3>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              {BANNER_THEMES.filter((t) => t.id !== "custom" || user.bannerUrl).map((theme) => {
                const active = bannerTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setBannerTheme(theme.id)}
                    className={`border-2 p-3 text-left transition-all ${
                      active
                        ? "border-ink bg-wash-blue shadow-[3px_3px_0_var(--color-ink)] font-bold text-ink"
                        : "border-ink/40 bg-panel text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    <span className="block text-xs font-bold text-ink">{theme.label}</span>
                    <span className="mt-1 block text-[10px] text-muted line-clamp-1">{theme.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-ink/20 pt-5">
            <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
              Digital Membership Card Theme
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {CARD_THEMES.map((theme) => {
                const active = cardTheme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setCardTheme(theme.id)}
                    className={`border-2 p-2.5 text-center text-xs font-bold transition-all ${
                      active
                        ? "border-ink bg-gyellow shadow-[2px_2px_0_var(--color-ink)] text-ink"
                        : "border-ink/40 bg-panel text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-ink/20 pt-5">
            <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
              Profile Accent Color
            </h3>
            <div className="mt-3 flex flex-wrap gap-3">
              {ACCENT_COLORS.map((col) => {
                const active = accentColor === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setAccentColor(col.id)}
                    className={`flex items-center gap-2 border-2 px-3 py-1.5 text-xs font-bold transition-transform ${
                      active
                        ? "border-ink bg-bg shadow-[3px_3px_0_var(--color-ink)] -translate-y-0.5 text-ink"
                        : "border-ink/30 bg-panel text-muted hover:border-ink hover:text-ink"
                    }`}
                  >
                    <span
                      className="h-3.5 w-3.5 border border-ink rounded-full"
                      style={{ backgroundColor: col.bg }}
                    />
                    <span>{col.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-ink/20 pt-5">
            <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
              Privacy & Information Sharing
            </h3>
            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between border-2 border-ink bg-panel p-3 shadow-[2px_2px_0_var(--color-ink)] cursor-pointer">
                <div>
                  <span className="block text-xs font-bold text-ink">Show Email Publicly</span>
                  <span className="block text-[11px] text-muted">
                    When turned off, your email address is hidden from public display.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showEmail}
                  onChange={(e) => setPrivacy((p) => ({ ...p, showEmail: e.target.checked }))}
                  className="h-5 w-5 accent-ink cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between border-2 border-ink bg-panel p-3 shadow-[2px_2px_0_var(--color-ink)] cursor-pointer">
                <div>
                  <span className="block text-xs font-bold text-ink">
                    Display Verified Attendance Counts
                  </span>
                  <span className="block text-[11px] text-muted">
                    Show attended workshop and event counts on your member card.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showAttendance}
                  onChange={(e) => setPrivacy((p) => ({ ...p, showAttendance: e.target.checked }))}
                  className="h-5 w-5 accent-ink cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between border-2 border-ink bg-panel p-3 shadow-[2px_2px_0_var(--color-ink)] cursor-pointer">
                <div>
                  <span className="block text-xs font-bold text-ink">
                    Display Featured Projects Section
                  </span>
                  <span className="block text-[11px] text-muted">
                    Showcase your featured projects on your member identity hub.
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.showProjects}
                  onChange={(e) => setPrivacy((p) => ({ ...p, showProjects: e.target.checked }))}
                  className="h-5 w-5 accent-ink cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-ink/20 pt-5">
            <button
              type="button"
              onClick={savePreferences}
              disabled={saving}
              className="hard-button border-2 border-ink bg-gyellow px-5 py-2 font-display text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Preferences"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="hard-button border-2 border-ink bg-bg px-4 py-2 font-display text-sm font-bold text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
