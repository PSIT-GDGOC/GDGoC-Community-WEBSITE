import { useEffect, useRef, useState, type FormEvent, type PointerEvent, type ReactNode } from "react";
import MemberCard from "./MemberCard";
import MemberNav from "./MemberNav";
import { PageHeader } from "./ui";
import {
  api,
  BRANCHES,
  validateProfile,
  resolveImageUrl,
  YEARS,
  type Profile as P,
  type ProfileEdit,
} from "../lib/profile";
import { ticketSummary } from "../lib/dashboard";
import type { Ticket } from "../lib/tickets";

type Msg = { ok: boolean; text: string } | null;

export const input =
  "w-full border-[3px] border-ink bg-bg px-3 py-2 text-ink disabled:bg-panel2 disabled:text-muted";
export const button =
  "hard-button bg-gyellow px-5 py-2.5 font-display font-bold text-ink disabled:opacity-60";
const ghost = "hard-button bg-bg px-5 py-2.5 font-display font-bold text-ink";

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [status, setStatus] = useState<"loading" | "error" | "ready">("loading");

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
  const registeredCount = tickets.filter((t) => t.state !== "cancelled").length;

  return (
    <main className="mx-auto max-w-6xl px-4 pt-28 pb-24 sm:px-6">
      {user && <MemberNav active="profile" />}
      <PageHeader tag="Member area" title="Your profile" color="gblue">
        Your member card, account details and community presence in one place.
      </PageHeader>
      {user?.role === "admin" && (
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href="#/admin"
            className="hard-button inline-flex items-center gap-1.5 border-2 border-ink bg-gred px-4 py-2 font-display text-sm font-bold text-white shadow-[4px_4px_0_var(--color-ink)]"
          >
            <span>⚡</span>
            <span>Admin Console →</span>
          </a>
        </div>
      )}

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
            <MemberCard
              user={user}
              upcoming={upcomingCount}
              attended={attendedCount}
              registered={registeredCount}
            />
          </aside>

          <div className="min-w-0 space-y-8">
            <ProfilePhoto user={user} onSaved={setUser} />
            <EditProfile user={user} onSaved={setUser} />
          </div>
        </div>
      )}
    </main>
  );
}

function ProfilePhoto({ user, onSaved }: { user: P; onSaved: (u: P) => void }) {
  const [imgError, setImgError] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setImgError(false);
  }, [user.avatarUrl]);

  const initials = initialsOf(user.name);

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
    reader.onload = () => {
      setCropSrc(reader.result as string);
    };
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
    <Card
      title="Profile photo"
      desc="Your picture appears on your digital member card, attendee badge, and event check-ins."
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div
          className="relative grid h-28 w-28 shrink-0 place-items-center overflow-hidden border-[3px] border-ink bg-panel2 font-display text-4xl font-extrabold shadow-[4px_4px_0_var(--color-ink)]"
          aria-label="Profile photo preview"
        >
          {user.avatarUrl && !imgError ? (
            <img
              src={resolveImageUrl(user.avatarUrl)}
              alt={user.name}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span className="text-ink/60">{initials}</span>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <p className="text-sm text-muted">
            Upload a square picture (JPG, PNG or WebP, up to 2 MB). You can crop and position it before saving.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
            aria-label="Upload profile photo"
          />

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={button}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || removing}
            >
              {user.avatarUrl ? "Replace photo" : "Upload photo"}
            </button>

            {user.avatarUrl && (
              <button
                type="button"
                className="hard-button border-[3px] border-gred bg-bg px-4 py-2 font-display text-sm font-bold text-gred hover:bg-gred/10 disabled:opacity-60"
                onClick={handleRemove}
                disabled={uploading || removing}
              >
                {removing ? "Removing…" : "Remove photo"}
              </button>
            )}
          </div>
        </div>
      </div>

      <Note msg={msg} />

      {cropSrc && (
        <CropModal
          imageSrc={cropSrc}
          uploading={uploading}
          onSave={handleCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </Card>
  );
}

function CropModal({
  imageSrc,
  uploading,
  onSave,
  onCancel,
}: {
  imageSrc: string;
  uploading: boolean;
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ width: 0, height: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const BOX_SIZE = 260;

  useEffect(() => {
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (uploading) return;

      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y - (e.shiftKey ? 25 : 10) }));
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setPan((p) => ({ ...p, y: p.y + (e.shiftKey ? 25 : 10) }));
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x - (e.shiftKey ? 25 : 10) }));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setPan((p) => ({ ...p, x: p.x + (e.shiftKey ? 25 : 10) }));
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setZoom((z) => Math.min(3, Number((z + 0.1).toFixed(2))));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setZoom((z) => Math.max(1, Number((z - 0.1).toFixed(2))));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [uploading, onCancel]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const target = e.currentTarget;
    setImgSize({ width: target.naturalWidth, height: target.naturalHeight });
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleSave = () => {
    const img = imgRef.current;
    if (!img) return;

    try {
      const canvas = document.createElement("canvas");
      const CROP_DIM = 400;
      canvas.width = CROP_DIM;
      canvas.height = CROP_DIM;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        onSave(imageSrc);
        return;
      }

      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CROP_DIM, CROP_DIM);

      const scaleMultiplier = CROP_DIM / BOX_SIZE;
      const cx = CROP_DIM / 2;
      const cy = CROP_DIM / 2;

      ctx.save();
      ctx.translate(cx + pan.x * scaleMultiplier, cy + pan.y * scaleMultiplier);
      ctx.scale(zoom * scaleMultiplier, zoom * scaleMultiplier);

      const aspect = img.naturalWidth / img.naturalHeight;
      let drawW = BOX_SIZE;
      let drawH = BOX_SIZE;
      if (aspect >= 1) {
        drawW = BOX_SIZE * aspect;
        drawH = BOX_SIZE;
      } else {
        drawW = BOX_SIZE;
        drawH = BOX_SIZE / aspect;
      }

      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();

      const dataUrl = canvas.toDataURL("image/webp", 0.9);
      onSave(dataUrl);
    } catch {
      onSave(imageSrc);
    }
  };

  const aspect = imgSize.width && imgSize.height ? imgSize.width / imgSize.height : 1;
  let displayW = BOX_SIZE;
  let displayH = BOX_SIZE;
  if (aspect >= 1) {
    displayW = BOX_SIZE * aspect;
    displayH = BOX_SIZE;
  } else {
    displayW = BOX_SIZE;
    displayH = BOX_SIZE / aspect;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="crop-modal-title"
      aria-describedby="crop-modal-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md border-[3px] border-ink bg-bg p-6 shadow-[8px_8px_0_var(--color-ink)] outline-none"
      >
        <div className="flex items-center justify-between border-b-[3px] border-ink pb-3">
          <h3 id="crop-modal-title" className="font-display text-lg font-extrabold">
            Crop profile photo
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-panel font-bold text-ink hover:bg-gred hover:text-white"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <p id="crop-modal-desc" className="mt-3 text-xs text-muted">
          Drag the image or use arrow keys to center your photo. Use the slider or +/- to zoom.
        </p>

        <div className="mt-4 flex justify-center">
          <div
            className="relative h-[260px] w-[260px] overflow-hidden border-[3px] border-ink bg-black/5 shadow-[4px_4px_0_var(--color-ink)] select-none touch-none cursor-grab active:cursor-grabbing"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          >
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: "center center",
              }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop preview"
                onLoad={onImageLoad}
                style={{ width: `${displayW}px`, height: `${displayH}px`, maxWidth: "none" }}
                draggable={false}
              />
            </div>

            <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 border border-white/30">
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-r border-b border-white/20" />
              <div className="border-b border-white/20" />
              <div className="border-r border-white/20" />
              <div className="border-r border-white/20" />
              <div />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span>Zoom</span>
            <span>{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-panel font-bold hover:bg-gyellow"
              onClick={() => setZoom((z) => Math.max(1, Number((z - 0.2).toFixed(2))))}
              aria-label="Zoom out"
            >
              −
            </button>
            <input
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="h-2 flex-1 cursor-pointer accent-ink"
              aria-label="Zoom level"
            />
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-panel font-bold hover:bg-gyellow"
              onClick={() => setZoom((z) => Math.min(3, Number((z + 0.2).toFixed(2))))}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="border-2 border-ink bg-bg px-2 py-1 text-xs font-bold hover:bg-panel"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t-[3px] border-ink pt-4">
          <button
            type="button"
            className="hard-button border-2 border-ink bg-bg px-4 py-2 font-display text-sm font-bold"
            onClick={onCancel}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="hard-button border-2 border-ink bg-gyellow px-5 py-2 font-display text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-60"
            onClick={handleSave}
            disabled={uploading}
          >
            {uploading ? "Saving photo…" : "Save photo"}
          </button>
        </div>
      </div>
    </div>
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
