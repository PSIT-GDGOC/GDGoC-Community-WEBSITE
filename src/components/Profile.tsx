import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import MemberCard from "./MemberCard";
import { PageHeader } from "./ui";
import {
  api,
  BRANCHES,
  PASSWORD_RULE,
  validatePassword,
  validateProfile,
  YEARS,
  type Profile as P,
  type ProfileEdit,
} from "../lib/profile";

type Msg = { ok: boolean; text: string } | null;

export const input =
  "w-full border-[3px] border-ink bg-bg px-3 py-2 text-ink disabled:bg-panel2 disabled:text-muted";
export const button =
  "hard-button bg-gyellow px-5 py-2.5 font-display font-bold text-ink disabled:opacity-60";
const ghost = "hard-button bg-bg px-5 py-2.5 font-display font-bold text-ink";

function Card({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7">
      <h2 className="font-display text-xl font-extrabold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-bold">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Note({ msg }: { msg: Msg }) {
  if (!msg) {
    return null;
  }

  return (
    <p
      role={msg.ok ? "status" : "alert"}
      className={`mt-4 text-sm font-bold ${msg.ok ? "text-ggreen" : "text-gred"}`}
    >
      {msg.text}
    </p>
  );
}

export default function Profile() {
  const [user, setUser] = useState<P | null>(null);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");
  const [logoutMsg, setLogoutMsg] = useState<Msg>(null);

  const loadUser = async () => {
    setStatus("loading");
    try {
      const me = await api<P>("/users/me");
      if (!me?.name) {
        throw new Error("bad response");
      }
      setUser(me);
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

  const logout = async () => {
    try {
      await api("/auth/logout", "POST");
      location.hash = "#/login";
    } catch {
      setLogoutMsg({ ok: false, text: "Couldn't log out. Try again." });
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      <PageHeader tag="Member area" title="Your profile" color="gblue">
        Your member card, account details and security settings in one place.
      </PageHeader>
      <div className="mt-6 flex flex-wrap gap-3">
        <a href="#/tickets" className="hard-button inline-block bg-gyellow px-4 py-2 font-display text-sm font-bold">
          My tickets →
        </a>
        {user?.role === "admin" && (
          <a
            href="#/admin"
            className="hard-button inline-flex items-center gap-1.5 border-2 border-ink bg-gred px-4 py-2 font-display text-sm font-bold text-white shadow-[4px_4px_0_var(--color-ink)]"
          >
            <span>⚡</span>
            <span>Admin Console →</span>
          </a>
        )}
      </div>

      {status === "loading" && (
        <p className="mt-10" role="status">
          Loading your profile…
        </p>
      )}

      {status === "error" && (
        <div role="alert" className="mt-10 max-w-xl border-[3px] border-ink bg-bg p-6">
          <p className="font-bold">We couldn't load your profile.</p>
          <p className="mt-1 text-sm text-muted">Check your connection and try again.</p>
          <button type="button" className={`${button} mt-4`} onClick={loadUser}>
            Try again
          </button>
        </div>
      )}

      {user && (
        <div className="mt-12 grid items-start gap-10 lg:grid-cols-[minmax(0,360px)_1fr] lg:gap-14">
          <aside className="mx-auto w-full max-w-[360px] space-y-6 lg:sticky lg:top-28">
            <MemberCard user={user} />
            <div className="flex flex-wrap gap-3">
              <button type="button" className={ghost} onClick={logout}>
                Log out
              </button>
            </div>
            <Note msg={logoutMsg} />
          </aside>

          <div className="min-w-0 space-y-8">
            <EditProfile user={user} onSaved={setUser} />
            <ChangePassword />
          </div>
        </div>
      )}
    </main>
  );
}

function EditProfile({ user, onSaved }: { user: P; onSaved: (u: P) => void }) {
  const initial: ProfileEdit = {
    name: user.name,
    branch: user.branch ?? "",
    year: user.year,
    bio: user.bio ?? "",
  };
  const [form, setForm] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const set = (patch: Partial<ProfileEdit>) => setForm((prev) => ({ ...prev, ...patch }));

  useEffect(() => {
    setForm({
      name: user.name,
      branch: user.branch ?? "",
      year: user.year,
      bio: user.bio ?? "",
    });
  }, [user]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateProfile(form);
    if (err) {
      setMsg({ ok: false, text: err });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      const saved = await api<P>("/users/me", "PATCH", { ...form, name: form.name.trim() });
      onSaved(saved);
      setEditing(false);
      setMsg({ ok: true, text: "Profile saved." });
    } catch (e) {
      const message = (e as Error).message;
      const text = message === "401" ? "Your session expired. Log in again." : message;
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setForm({
      name: user.name,
      branch: user.branch ?? "",
      year: user.year,
      bio: user.bio ?? "",
    });
    setEditing(false);
    setMsg(null);
  };

  const startEditing = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditing(true);
    setMsg(null);
  };

  return (
    <Card
      title="Personal & academic details"
      desc="Email and enrollment number are managed by the community team. To correct them, contact a core team member."
    >
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="Full name">
            <input
              className={input}
              value={form.name}
              disabled={!editing}
              required
              maxLength={60}
              autoComplete="name"
              onChange={(e) => set({ name: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Branch">
          <select
            className={input}
            value={form.branch}
            disabled={!editing}
            onChange={(e) => set({ branch: e.target.value })}
          >
            <option value="">Not set</option>
            {BRANCHES.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
        </Field>
        <Field label="Year">
          <select
            className={input}
            value={form.year ?? ""}
            disabled={!editing}
            onChange={(e) => set({ year: Number(e.target.value) || undefined })}
          >
            <option value="">Not set</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field
            label="Bio (optional)"
            hint={`${(form.bio ?? "").length}/280 · your tech interests, in a line or two`}
          >
            <textarea
              className={input}
              rows={3}
              maxLength={280}
              value={form.bio}
              disabled={!editing}
              onChange={(e) => set({ bio: e.target.value })}
            />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          {editing ? (
            <>
              <button key="save-button" type="submit" className={button} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </button>
              <button key="cancel-button" type="button" className={ghost} onClick={cancel} disabled={saving}>
                Cancel
              </button>
            </>
          ) : (
            <button key="edit-button" type="button" className={button} onClick={startEditing}>
              Edit profile
            </button>
          )}
        </div>
      </form>
      <Note msg={msg} />
    </Card>
  );
}

function ChangePassword() {
  const empty = { current: "", next: "", confirm: "" };
  const [pw, setPw] = useState(empty);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const type = show ? "text" : "password";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const err = validatePassword(pw.current, pw.next, pw.confirm);
    if (err) {
      setMsg({ ok: false, text: err });
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      await api("/users/me/password", "PATCH", { currentPassword: pw.current, newPassword: pw.next });
      setPw(empty);
      setMsg({ ok: true, text: "Password changed." });
    } catch (e) {
      const message = (e as Error).message;
      const text = message === "401" ? "Your session expired. Log in again." : message;
      setMsg({ ok: false, text });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card title="Password & security" desc={PASSWORD_RULE}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Current password">
          <input
            className={input}
            type={type}
            autoComplete="current-password"
            value={pw.current}
            onChange={(e) => setPw({ ...pw, current: e.target.value })}
          />
        </Field>
        <Field label="New password">
          <input
            className={input}
            type={type}
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
          />
        </Field>
        <Field label="Confirm new password">
          <input
            className={input}
            type={type}
            autoComplete="new-password"
            value={pw.confirm}
            onChange={(e) => setPw({ ...pw, confirm: e.target.value })}
          />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show passwords
        </label>
        <div>
          <button type="submit" className={button} disabled={saving}>
            {saving ? "Updating…" : "Change password"}
          </button>
        </div>
      </form>
      <Note msg={msg} />
    </Card>
  );
}
