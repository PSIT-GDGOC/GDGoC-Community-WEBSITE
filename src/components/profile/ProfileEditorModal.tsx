import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  api,
  BRANCHES,
  YEARS,
  BANNER_THEMES,
  CURATED_SKILLS,
  CARD_THEMES,
  ACCENT_COLORS,
  validateProfile,
  resolveImageUrl,
  type Profile,
  type SkillItem,
  type ProjectItem,
  type BannerTheme,
  type CardTheme,
  type AccentColor,
} from "../../lib/profile";
import AvatarCropModal from "./AvatarCropModal";
import { BannerBackground } from "./ProfileHero";

export type EditorTab = "personal" | "media" | "skills" | "projects" | "socials";

const TABS: { id: EditorTab; label: string; icon: string }[] = [
  { id: "personal", label: "Identity & Bio", icon: "👤" },
  { id: "media", label: "Photo & Banner", icon: "🖼️" },
  { id: "skills", label: "Skills", icon: "⚡" },
  { id: "projects", label: "Projects", icon: "🚀" },
  { id: "socials", label: "Socials & Style", icon: "🔗" },
];

const inputCls =
  "w-full border-[2px] border-ink bg-bg px-3 py-2 text-sm text-ink disabled:bg-panel2 disabled:text-muted focus:outline-none focus:ring-2 focus:ring-gblue";
const labelCls = "block text-xs font-bold uppercase tracking-wider text-muted mb-1";

type SavedEditorBaseline = {
  name: string;
  headline: string;
  specialization: string;
  bio: string;
  branch: string;
  year: number | undefined;
  college: string;
  bannerTheme: BannerTheme;
  cardTheme: CardTheme;
  accentColor: AccentColor;
  socials: {
    github: string;
    linkedin: string;
    portfolio: string;
    website: string;
    twitter: string;
  };
  skills: SkillItem[];
};

function buildEditorBaseline(u: Profile): SavedEditorBaseline {
  return {
    name: u.name,
    headline: u.headline || "",
    specialization: u.specialization || "",
    bio: u.bio || "",
    branch: u.branch || "",
    year: u.year,
    college: u.college || "PSIT Kanpur",
    bannerTheme: u.bannerTheme || "google-brand",
    cardTheme: u.cardTheme || "default",
    accentColor: u.accentColor || "gblue",
    socials: {
      github: u.socials?.github || "",
      linkedin: u.socials?.linkedin || "",
      portfolio: u.socials?.portfolio || "",
      website: u.socials?.website || "",
      twitter: u.socials?.twitter || "",
    },
    skills: (u.skills || []).map((s) => ({ name: s.name, category: s.category || "Other" })),
  };
}

export default function ProfileEditorModal({
  user,
  initialTab = "personal",
  onUpdated,
  onClose,
}: {
  user: Profile;
  initialTab?: EditorTab;
  onUpdated: (u: Profile) => void;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<EditorTab>(initialTab);
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const keepEditingRef = useRef<HTMLButtonElement>(null);
  const [baseline, setBaseline] = useState<SavedEditorBaseline>(() => buildEditorBaseline(user));

  // Form states initialized from user
  const [name, setName] = useState(user.name);
  const [headline, setHeadline] = useState(user.headline || "");
  const [specialization, setSpecialization] = useState(user.specialization || "");
  const [bio, setBio] = useState(user.bio || "");
  const [branch, setBranch] = useState(user.branch || "");
  const [year, setYear] = useState<number | undefined>(user.year);
  const [college, setCollege] = useState(user.college || "PSIT Kanpur");

  // Appearance & Socials state
  const [bannerTheme, setBannerTheme] = useState<BannerTheme>(user.bannerTheme || "google-brand");
  const [cardTheme, setCardTheme] = useState<CardTheme>(user.cardTheme || "default");
  const [accentColor, setAccentColor] = useState<AccentColor>(user.accentColor || "gblue");
  const [socials, setSocials] = useState({
    github: user.socials?.github || "",
    linkedin: user.socials?.linkedin || "",
    portfolio: user.socials?.portfolio || "",
    website: user.socials?.website || "",
    twitter: user.socials?.twitter || "",
  });

  // Skills state
  const [skills, setSkills] = useState<SkillItem[]>(user.skills || []);
  const [skillCategoryFilter, setSkillCategoryFilter] = useState<string>("Programming");
  const [customSkillName, setCustomSkillName] = useState("");
  const [customSkillCategory, setCustomSkillCategory] = useState("Other");

  // Media upload state
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const projImageInputRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [mediaBusy, setMediaBusy] = useState(false);

  // Projects state
  const [editingProjId, setEditingProjId] = useState<string | null>(null);
  const [projTitle, setProjTitle] = useState("");
  const [projDesc, setProjDesc] = useState("");
  const [projStack, setProjStack] = useState("");
  const [projGithub, setProjGithub] = useState("");
  const [projLive, setProjLive] = useState("");
  const [projImage, setProjImage] = useState("");
  const [projFeatured, setProjFeatured] = useState(false);
  const [editingProjBaseline, setEditingProjBaseline] = useState<{
    title: string;
    description: string;
    stack: string;
    github: string;
    live: string;
    image: string;
    featured: boolean;
  } | null>(null);

  const isDirty = useMemo(() => {
    const identityDirty =
      name.trim() !== baseline.name.trim() ||
      headline.trim() !== baseline.headline.trim() ||
      specialization.trim() !== baseline.specialization.trim() ||
      bio.trim() !== baseline.bio.trim() ||
      branch !== baseline.branch ||
      year !== baseline.year ||
      (college.trim() || "PSIT Kanpur") !== baseline.college;

    const appearanceDirty =
      bannerTheme !== baseline.bannerTheme ||
      cardTheme !== baseline.cardTheme ||
      accentColor !== baseline.accentColor ||
      socials.github.trim() !== baseline.socials.github.trim() ||
      socials.linkedin.trim() !== baseline.socials.linkedin.trim() ||
      socials.portfolio.trim() !== baseline.socials.portfolio.trim() ||
      socials.website.trim() !== baseline.socials.website.trim() ||
      socials.twitter.trim() !== baseline.socials.twitter.trim();

    const skillsDirty =
      customSkillName.trim().length > 0 ||
      skills.length !== baseline.skills.length ||
      skills.some(
        (s, i) =>
          s.name !== baseline.skills[i]?.name ||
          (s.category || "Other") !== (baseline.skills[i]?.category || "Other")
      );

    const projectDirty = editingProjId && editingProjBaseline
      ? projTitle !== editingProjBaseline.title ||
        projDesc !== editingProjBaseline.description ||
        projStack !== editingProjBaseline.stack ||
        projGithub !== editingProjBaseline.github ||
        projLive !== editingProjBaseline.live ||
        projImage !== editingProjBaseline.image ||
        projFeatured !== editingProjBaseline.featured
      : Boolean(
          projTitle.trim() ||
            projDesc.trim() ||
            projStack.trim() ||
            projGithub.trim() ||
            projLive.trim() ||
            projImage.trim() ||
            projFeatured
        );

    return identityDirty || appearanceDirty || skillsDirty || projectDirty;
  }, [
    name,
    headline,
    specialization,
    bio,
    branch,
    year,
    college,
    bannerTheme,
    cardTheme,
    accentColor,
    socials,
    skills,
    customSkillName,
    editingProjId,
    editingProjBaseline,
    projTitle,
    projDesc,
    projStack,
    projGithub,
    projLive,
    projImage,
    projFeatured,
    baseline,
  ]);

  useEffect(() => {
    if (!isDirty && confirmDiscard) {
      setConfirmDiscard(false);
    }
  }, [isDirty, confirmDiscard]);

  useEffect(() => {
    if (confirmDiscard) {
      keepEditingRef.current?.focus();
    }
  }, [confirmDiscard]);

  const requestClose = useCallback(() => {
    if (saving || mediaBusy) return;
    if (isDirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }, [saving, mediaBusy, isDirty, onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    modalRef.current?.focus();
    return () => {
      try {
        previouslyFocused?.focus?.();
      } catch {}
    };
  }, []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (cropSrc) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (confirmDiscard) {
          setConfirmDiscard(false);
        } else {
          requestClose();
        }
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => el.offsetParent !== null || el === document.activeElement);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && (document.activeElement === first || document.activeElement === modalRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [cropSrc, confirmDiscard, requestClose]);

  const showStatus = (ok: boolean, text: string) => setMsg({ ok, text });

  // ============================================================================
  // Save Personal / Socials / Skills Handlers
  // ============================================================================

  const handleSaveIdentity = async (e: FormEvent) => {
    e.preventDefault();
    const err = validateProfile({ name, branch, year, bio });
    if (err) {
      showStatus(false, err);
      return;
    }
    setSaving(true);
    setMsg(null);
    const trimmedPayload = {
      name: name.trim(),
      headline: headline.trim(),
      specialization: specialization.trim(),
      bio: bio.trim(),
      branch,
      year,
      college: college.trim() || "PSIT Kanpur",
    };
    try {
      const updated = await api<Profile>("/users/me", "PATCH", trimmedPayload);
      onUpdated(updated);
      setBaseline((b) => ({ ...b, ...trimmedPayload }));
      showStatus(true, "Personal and academic profile updated.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSocialsAndAppearance = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    const nextSocials = {
      github: socials.github.trim(),
      linkedin: socials.linkedin.trim(),
      portfolio: socials.portfolio.trim(),
      website: socials.website.trim(),
      twitter: socials.twitter.trim(),
    };
    try {
      const updated = await api<Profile>("/users/me", "PATCH", {
        socials: nextSocials,
        accentColor,
        cardTheme,
        bannerTheme,
      });
      onUpdated(updated);
      setSocials(nextSocials);
      setBaseline((b) => ({
        ...b,
        socials: nextSocials,
        accentColor,
        cardTheme,
        bannerTheme,
      }));
      showStatus(true, "Social links and appearance saved.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to save links and appearance.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSkill = (skillName: string, category: string) => {
    const exists = skills.some((s) => s.name.toLowerCase() === skillName.toLowerCase());
    if (exists) {
      setSkills(skills.filter((s) => s.name.toLowerCase() !== skillName.toLowerCase()));
    } else {
      if (skills.length >= 25) {
        showStatus(false, "Maximum 25 skills allowed.");
        return;
      }
      setSkills([...skills, { name: skillName, category }]);
    }
  };

  const handleAddCustomSkill = () => {
    const clean = customSkillName.trim();
    if (!clean) return;
    if (clean.length > 40) {
      showStatus(false, "Skill name must be 40 characters or fewer.");
      return;
    }
    if (skills.some((s) => s.name.toLowerCase() === clean.toLowerCase())) {
      showStatus(false, `"${clean}" is already in your skill list.`);
      return;
    }
    if (skills.length >= 25) {
      showStatus(false, "Maximum 25 skills allowed.");
      return;
    }
    setSkills([...skills, { name: clean, category: customSkillCategory }]);
    setCustomSkillName("");
    setMsg(null);
  };

  const handleSaveSkills = async () => {
    setSaving(true);
    setMsg(null);
    const cleanSkills = skills.map((s) => ({ name: s.name, category: s.category || "Other" }));
    try {
      const updated = await api<Profile>("/users/me", "PATCH", { skills: cleanSkills });
      onUpdated(updated);
      setBaseline((b) => ({ ...b, skills: cleanSkills }));
      showStatus(true, "Technical skills updated.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to update skills.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Media Handlers (Avatar & Custom Banner)
  // ============================================================================

  const handleAvatarFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 2 * 1024 * 1024) {
      showStatus(false, "Avatar image exceeds 2MB limit.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showStatus(false, "Only JPEG, PNG, and WebP images are supported.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedAvatar = async (dataUrl: string) => {
    setMediaBusy(true);
    setMsg(null);
    try {
      const res = await api<{ user: Profile }>("/users/me/avatar", "POST", { dataUrl });
      onUpdated(res.user);
      setCropSrc(null);
      showStatus(true, "Profile photo updated.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Avatar upload failed.");
    } finally {
      setMediaBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setMediaBusy(true);
    setMsg(null);
    try {
      const res = await api<{ user: Profile }>("/users/me/avatar", "DELETE");
      onUpdated(res.user);
      showStatus(true, "Profile photo removed.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to remove photo.");
    } finally {
      setMediaBusy(false);
    }
  };

  const handleBannerFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 3 * 1024 * 1024) {
      showStatus(false, "Banner image exceeds 3MB limit.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showStatus(false, "Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setMediaBusy(true);
      setMsg(null);
      try {
        const res = await api<{ user: Profile }>("/users/me/banner", "POST", {
          dataUrl: reader.result as string,
        });
        onUpdated(res.user);
        setBannerTheme("custom");
        setBaseline((b) => ({ ...b, bannerTheme: "custom" }));
        showStatus(true, "Custom cover banner uploaded.");
      } catch (error) {
        showStatus(false, (error as Error).message || "Banner upload failed.");
      } finally {
        setMediaBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveBanner = async () => {
    setMediaBusy(true);
    setMsg(null);
    try {
      const res = await api<{ user: Profile }>("/users/me/banner", "DELETE");
      onUpdated(res.user);
      setBannerTheme("google-brand");
      setBaseline((b) => ({ ...b, bannerTheme: "google-brand" }));
      showStatus(true, "Cover banner reset to Google Brand.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to remove custom banner.");
    } finally {
      setMediaBusy(false);
    }
  };

  const applyBannerPreset = async (theme: BannerTheme) => {
    setBannerTheme(theme);
    setSaving(true);
    setMsg(null);
    try {
      const updated = await api<Profile>("/users/me", "PATCH", { bannerTheme: theme });
      onUpdated(updated);
      setBaseline((b) => ({ ...b, bannerTheme: theme }));
      showStatus(true, "Banner theme applied.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to update banner theme.");
    } finally {
      setSaving(false);
    }
  };

  // ============================================================================
  // Projects CRUD Handlers
  // ============================================================================

  const resetProjectForm = () => {
    setEditingProjId(null);
    setEditingProjBaseline(null);
    setProjTitle("");
    setProjDesc("");
    setProjStack("");
    setProjGithub("");
    setProjLive("");
    setProjImage("");
    setProjFeatured(false);
  };

  const handleProjectImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    if (file.size > 2 * 1024 * 1024) {
      showStatus(false, "Project image exceeds 2MB limit.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      showStatus(false, "Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setMediaBusy(true);
      setMsg(null);
      try {
        const res = await api<{ url: string }>("/users/me/projects/image", "POST", {
          dataUrl: reader.result as string,
        });
        setProjImage(res.url);
        showStatus(true, "Project preview image uploaded.");
      } catch (error) {
        showStatus(false, (error as Error).message || "Failed to upload project image.");
      } finally {
        setMediaBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const startEditProject = (p: ProjectItem) => {
    const snapshot = {
      title: p.title,
      description: p.description || "",
      stack: (p.techStack || []).join(", "),
      github: p.githubUrl || "",
      live: p.liveUrl || "",
      image: p.imageUrl || "",
      featured: Boolean(p.featured),
    };
    setEditingProjId(p.id || p._id || null);
    setEditingProjBaseline(snapshot);
    setProjTitle(snapshot.title);
    setProjDesc(snapshot.description);
    setProjStack(snapshot.stack);
    setProjGithub(snapshot.github);
    setProjLive(snapshot.live);
    setProjImage(snapshot.image);
    setProjFeatured(snapshot.featured);
    setMsg(null);
  };

  const handleSaveProject = async (e: FormEvent) => {
    e.preventDefault();
    const stackArray = projStack
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      title: projTitle.trim(),
      description: projDesc.trim(),
      techStack: stackArray,
      githubUrl: projGithub.trim(),
      liveUrl: projLive.trim(),
      imageUrl: projImage.trim() || null,
      featured: projFeatured,
    };

    setSaving(true);
    setMsg(null);
    try {
      if (editingProjId) {
        const res = await api<{ user: Profile }>(`/users/me/projects/${editingProjId}`, "PATCH", payload);
        onUpdated(res.user);
        showStatus(true, "Project updated.");
      } else {
        const res = await api<{ user: Profile }>("/users/me/projects", "POST", payload);
        onUpdated(res.user);
        showStatus(true, "Project added to showcase.");
      }
      resetProjectForm();
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to save project.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await api<{ user: Profile }>(`/users/me/projects/${projectId}`, "DELETE");
      onUpdated(res.user);
      if (editingProjId === projectId) resetProjectForm();
      showStatus(true, "Project deleted.");
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to delete project.");
    } finally {
      setSaving(false);
    }
  };

  const handleMoveProject = async (index: number, direction: -1 | 1) => {
    const list = [...(user.projects || [])];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const [item] = list.splice(index, 1);
    list.splice(targetIndex, 0, item);
    const order = list.map((p) => String(p.id || p._id));

    setSaving(true);
    setMsg(null);
    try {
      const res = await api<{ user: Profile }>("/users/me/projects/reorder", "PUT", { order });
      onUpdated(res.user);
    } catch (error) {
      showStatus(false, (error as Error).message || "Failed to reorder projects.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="editor-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-2 sm:p-6 backdrop-blur-xs overflow-y-auto"
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col border-[3px] border-ink bg-bg shadow-[10px_10px_0_var(--color-ink)] outline-none"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-ink bg-panel px-4 sm:px-5 py-4">
          <div className="min-w-0">
            <h2 id="editor-modal-title" className="font-display text-lg font-black text-ink sm:text-xl">
              Customize Developer Identity Hub
            </h2>
            <p className="text-xs text-muted">
              Update your profile hero, technical skills, projects, and appearance preferences.
            </p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink bg-bg font-bold text-ink hover:bg-gred hover:text-white shadow-[2px_2px_0_var(--color-ink)]"
            aria-label="Close profile editor"
          >
            ✕
          </button>
        </div>

        {/* Unsaved Changes Confirmation */}
        {confirmDiscard && (
          <div
            role="alertdialog"
            aria-modal="false"
            aria-labelledby="discard-confirm-title"
            className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-wash-yellow px-4 sm:px-5 py-3"
          >
            <div className="min-w-0">
              <p id="discard-confirm-title" className="font-display text-xs font-black text-ink">
                Discard unsaved changes?
              </p>
              <p className="text-[11px] text-ink/80">
                You have un-saved edits in this editor. Save them first or discard to close.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                ref={keepEditingRef}
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="border-2 border-ink bg-bg px-3 py-1.5 font-display text-xs font-bold text-ink hover:bg-panel"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={onClose}
                className="hard-button border-2 border-ink bg-gred px-3 py-1.5 font-display text-xs font-bold text-white shadow-[2px_2px_0_var(--color-ink)]"
              >
                Discard &amp; Close
              </button>
            </div>
          </div>
        )}

        {/* Navigation Tabs Bar */}
        <div
          role="tablist"
          aria-label="Profile editor sections"
          className="flex overflow-x-auto sm:flex-wrap gap-1 border-b-2 border-ink bg-panel2 px-3 sm:px-4 pt-3"
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                role="tab"
                aria-selected={active}
                aria-controls="editor-tabpanel"
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  setMsg(null);
                }}
                className={`inline-flex shrink-0 items-center gap-1.5 border-t-2 border-l-2 border-r-2 px-3.5 py-2 font-display text-xs font-bold transition-colors ${
                  active
                    ? "border-ink bg-bg text-ink -mb-[2px] border-b-2 border-b-bg"
                    : "border-transparent text-muted hover:text-ink"
                }`}
              >
                <span aria-hidden="true">{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Editor Body */}
        <div
          id="editor-tabpanel"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          className="flex-1 overflow-y-auto p-4 sm:p-7"
        >
          {msg && (
            <div
              role={msg.ok ? "status" : "alert"}
              className={`mb-5 border-2 border-ink p-3 text-xs font-bold shadow-[3px_3px_0_var(--color-ink)] ${
                msg.ok ? "bg-wash-green text-[#137333]" : "bg-wash-red text-[#C5221F]"
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* TAB 1: PERSONAL & ACADEMIC */}
          {activeTab === "personal" && (
            <form onSubmit={handleSaveIdentity} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="edit-name" className={labelCls}>Full Display Name</label>
                  <input
                    id="edit-name"
                    className={inputCls}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={60}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="edit-headline" className={labelCls}>Professional Headline</label>
                  <input
                    id="edit-headline"
                    className={inputCls}
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="e.g. Full-Stack Engineer | Open Source Contributor | AI Enthusiast"
                    maxLength={120}
                  />
                  <span className="mt-1 block text-[11px] text-muted">{headline.length}/120 characters</span>
                </div>

                <div>
                  <label htmlFor="edit-specialization" className={labelCls}>Primary Focus / Specialization</label>
                  <input
                    id="edit-specialization"
                    className={inputCls}
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    placeholder="e.g. Cloud Native & Distributed Systems"
                    maxLength={60}
                  />
                </div>

                <div>
                  <label htmlFor="edit-college" className={labelCls}>College / Campus</label>
                  <input
                    id="edit-college"
                    className={inputCls}
                    value={college}
                    onChange={(e) => setCollege(e.target.value)}
                    placeholder="PSIT Kanpur"
                    maxLength={120}
                  />
                </div>

                <div>
                  <label htmlFor="edit-branch" className={labelCls}>Branch</label>
                  <select id="edit-branch" className={inputCls} value={branch} onChange={(e) => setBranch(e.target.value)}>
                    <option value="">Not specified</option>
                    {BRANCHES.map((b) => (
                      <option key={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-year" className={labelCls}>Academic Year</label>
                  <select
                    id="edit-year"
                    className={inputCls}
                    value={year ?? ""}
                    onChange={(e) => setYear(Number(e.target.value) || undefined)}
                  >
                    <option value="">Not specified</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </div>

                {user.enrollmentNo && (
                  <div className="sm:col-span-2">
                    <label htmlFor="edit-enrollment" className={labelCls}>Enrollment Number (Admin Controlled)</label>
                    <input id="edit-enrollment" className={inputCls} value={user.enrollmentNo} disabled />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label htmlFor="edit-bio" className={labelCls}>Short Biography</label>
                  <textarea
                    id="edit-bio"
                    className={inputCls}
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    maxLength={280}
                    placeholder="Share your developer story, hackathon experiences, or what you're currently learning…"
                  />
                  <span className="mt-1 block text-[11px] text-muted">{bio.length}/280 characters</span>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="hard-button border-2 border-ink bg-gyellow px-5 py-2.5 font-display text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Identity Details"}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: PHOTO & BANNER */}
          {activeTab === "media" && (
            <div className="space-y-8">
              {/* Profile Photo Card */}
              <div className="border-2 border-ink bg-panel p-4 shadow-[3px_3px_0_var(--color-ink)]">
                <h3 className="font-display text-base font-bold text-ink">Profile Picture</h3>
                <p className="mt-0.5 text-xs text-muted">
                  PNG, JPG, or WebP up to 2MB. Automatically cropped and optimized.
                </p>

                <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="h-24 w-24 shrink-0 overflow-hidden border-[3px] border-ink bg-bg shadow-[3px_3px_0_var(--color-ink)]">
                    {user.avatarUrl ? (
                      <img
                        src={resolveImageUrl(user.avatarUrl)}
                        alt={user.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center font-display text-2xl font-black text-muted">
                        NO PHOTO
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleAvatarFile}
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={() => avatarInputRef.current?.click()}
                      className="hard-button border-2 border-ink bg-gyellow px-4 py-2 font-display text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)]"
                    >
                      {user.avatarUrl ? "Replace Avatar" : "Upload Avatar"}
                    </button>
                    {user.avatarUrl && (
                      <button
                        type="button"
                        disabled={mediaBusy}
                        onClick={handleRemoveAvatar}
                        className="hard-button border-2 border-gred bg-bg px-4 py-2 font-display text-xs font-bold text-gred hover:bg-wash-red"
                      >
                        Remove Avatar
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Cover Banner Presets & Custom Upload */}
              <div className="border-2 border-ink bg-panel p-4 shadow-[3px_3px_0_var(--color-ink)]">
                <h3 className="font-display text-base font-bold text-ink">Cover Banner & Artwork</h3>
                <p className="mt-0.5 text-xs text-muted">
                  Select a designer preset or upload custom banner artwork (max 3MB).
                </p>

                <div className="mt-3 overflow-hidden border-2 border-ink">
                  <BannerBackground user={{ ...user, bannerTheme }} />
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {BANNER_THEMES.filter((t) => t.id !== "custom").map((theme) => {
                    const active = bannerTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        type="button"
                        disabled={saving}
                        onClick={() => applyBannerPreset(theme.id)}
                        className={`border-2 p-2.5 text-left text-xs font-bold transition-all ${
                          active
                            ? "border-ink bg-wash-blue shadow-[2px_2px_0_var(--color-ink)] text-ink"
                            : "border-ink/40 bg-bg text-muted hover:border-ink hover:text-ink"
                        }`}
                      >
                        {theme.label}
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink/20 pt-4">
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleBannerFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={mediaBusy}
                    onClick={() => bannerInputRef.current?.click()}
                    className="hard-button border-2 border-ink bg-bg px-4 py-2 font-display text-xs font-bold text-ink hover:bg-gyellow shadow-[2px_2px_0_var(--color-ink)]"
                  >
                    {mediaBusy ? "Uploading…" : "↑ Upload Custom Banner"}
                  </button>
                  {user.bannerUrl && (
                    <button
                      type="button"
                      disabled={mediaBusy}
                      onClick={handleRemoveBanner}
                      className="border-2 border-gred bg-bg px-3 py-2 text-xs font-bold text-gred hover:bg-wash-red"
                    >
                      Reset Custom Banner
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SKILLS MANAGER */}
          {activeTab === "skills" && (
            <div className="space-y-6">
              {/* Selected Skills Summary */}
              <div>
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-bold text-ink">
                    Your Selected Skills ({skills.length}/25)
                  </span>
                </div>
                {skills.length === 0 ? (
                  <p className="mt-2 text-xs text-muted italic">
                    Pick skills from the curated catalog below or add custom skills.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {skills.map((s) => (
                      <span
                        key={s.name}
                        className="inline-flex items-center gap-1.5 border-2 border-ink bg-wash-blue px-2.5 py-1 text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)]"
                      >
                        <span>{s.name}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleSkill(s.name, s.category)}
                          className="ml-1 font-black text-gred hover:text-ink"
                          aria-label={`Remove ${s.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Curated Categories Browser */}
              <div className="border-2 border-ink bg-panel p-4 shadow-[3px_3px_0_var(--color-ink)]">
                <div className="flex flex-wrap gap-1.5 border-b border-ink/20 pb-3">
                  {Object.keys(CURATED_SKILLS).map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSkillCategoryFilter(cat)}
                      className={`border px-2.5 py-1 text-xs font-bold transition-colors ${
                        skillCategoryFilter === cat
                          ? "border-ink bg-ink text-white"
                          : "border-ink/30 bg-bg text-muted hover:text-ink"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(CURATED_SKILLS[skillCategoryFilter] || []).map((skill) => {
                    const selected = skills.some((s) => s.name.toLowerCase() === skill.toLowerCase());
                    return (
                      <button
                        key={skill}
                        type="button"
                        onClick={() => handleToggleSkill(skill, skillCategoryFilter)}
                        className={`border-2 px-3 py-1 text-xs font-bold transition-all ${
                          selected
                            ? "border-ink bg-ggreen text-white shadow-[2px_2px_0_var(--color-ink)]"
                            : "border-ink/50 bg-bg text-ink hover:border-ink hover:bg-gyellow"
                        }`}
                      >
                        {selected ? `✓ ${skill}` : `+ ${skill}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Add Custom Skill */}
              <div className="border-2 border-ink bg-panel p-4">
                <label className={labelCls}>Add Custom Skill</label>
                <div className="flex flex-wrap gap-2">
                  <input
                    className={`${inputCls} min-w-0 w-full sm:w-auto sm:flex-1`}
                    placeholder="e.g. WebAssembly, CUDA, Terraform..."
                    value={customSkillName}
                    onChange={(e) => setCustomSkillName(e.target.value)}
                    maxLength={40}
                  />
                  <select
                    className={`${inputCls} w-full sm:w-auto`}
                    value={customSkillCategory}
                    onChange={(e) => setCustomSkillCategory(e.target.value)}
                  >
                    {Object.keys(CURATED_SKILLS).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    <option value="Other">Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleAddCustomSkill}
                    className="hard-button border-2 border-ink bg-bg px-4 py-2 text-xs font-bold hover:bg-gyellow"
                  >
                    + Add
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveSkills}
                  className="hard-button border-2 border-ink bg-gyellow px-5 py-2.5 font-display text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Skills"}
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: FEATURED PROJECTS */}
          {activeTab === "projects" && (
            <div className="space-y-6">
              {/* Project Form */}
              <form
                onSubmit={handleSaveProject}
                className="border-2 border-ink bg-panel p-4 shadow-[3px_3px_0_var(--color-ink)] space-y-4"
              >
                <div className="flex items-center justify-between border-b border-ink/20 pb-2">
                  <h3 className="font-display text-sm font-bold text-ink">
                    {editingProjId ? "✎ Edit Project" : "+ Add Featured Project"}
                  </h3>
                  {editingProjId && (
                    <button
                      type="button"
                      onClick={resetProjectForm}
                      className="text-xs font-bold text-gred hover:underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="proj-title" className={labelCls}>Project Title *</label>
                    <input
                      id="proj-title"
                      className={inputCls}
                      value={projTitle}
                      onChange={(e) => setProjTitle(e.target.value)}
                      required
                      maxLength={80}
                      placeholder="e.g. GDGoC Event Portal"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="proj-desc" className={labelCls}>Short Description</label>
                    <textarea
                      id="proj-desc"
                      className={inputCls}
                      rows={2}
                      value={projDesc}
                      onChange={(e) => setProjDesc(e.target.value)}
                      maxLength={280}
                      placeholder="What problem does it solve? Key technical highlight..."
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="proj-stack" className={labelCls}>Tech Stack (Comma separated, max 10)</label>
                    <input
                      id="proj-stack"
                      className={inputCls}
                      value={projStack}
                      onChange={(e) => setProjStack(e.target.value)}
                      placeholder="React, TypeScript, Node.js, MongoDB"
                    />
                  </div>

                  <div>
                    <label htmlFor="proj-github" className={labelCls}>GitHub Repository URL</label>
                    <input
                      id="proj-github"
                      type="url"
                      className={inputCls}
                      value={projGithub}
                      onChange={(e) => setProjGithub(e.target.value)}
                      placeholder="https://github.com/..."
                    />
                  </div>

                  <div>
                    <label htmlFor="proj-live" className={labelCls}>Live Demo URL</label>
                    <input
                      id="proj-live"
                      type="url"
                      className={inputCls}
                      value={projLive}
                      onChange={(e) => setProjLive(e.target.value)}
                      placeholder="https://my-project.vercel.app"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="proj-image" className={labelCls}>Optional Project Cover Image (max 2MB)</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="proj-image"
                        className={`${inputCls} min-w-0 w-full sm:w-auto sm:flex-1`}
                        value={projImage}
                        onChange={(e) => setProjImage(e.target.value)}
                        placeholder="https://... or upload an image"
                      />
                      <input
                        ref={projImageInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleProjectImageFile}
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={mediaBusy}
                        onClick={() => projImageInputRef.current?.click()}
                        className="hard-button border-2 border-ink bg-bg px-3 py-2 text-xs font-bold hover:bg-gyellow"
                      >
                        {mediaBusy ? "Uploading…" : "↑ Upload"}
                      </button>
                      {projImage && (
                        <button
                          type="button"
                          onClick={() => setProjImage("")}
                          className="border-2 border-gred bg-bg px-2.5 py-2 text-xs font-bold text-gred hover:bg-wash-red"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2 flex items-center gap-2 pt-1">
                    <input
                      id="proj-featured"
                      type="checkbox"
                      checked={projFeatured}
                      onChange={(e) => setProjFeatured(e.target.checked)}
                      className="h-4 w-4 accent-ink"
                    />
                    <label htmlFor="proj-featured" className="text-xs font-bold text-ink cursor-pointer">
                      Highlight with Featured ★ badge
                    </label>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    disabled={saving}
                    className="hard-button border-2 border-ink bg-gyellow px-4 py-2 font-display text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] disabled:opacity-60"
                  >
                    {saving ? "Saving…" : editingProjId ? "Update Project" : "Add Project"}
                  </button>
                </div>
              </form>

              {/* Existing Projects List */}
              <div className="space-y-3">
                <h3 className="font-display text-sm font-bold text-ink">
                  Saved Projects ({(user.projects || []).length}/6)
                </h3>
                {(user.projects || []).map((proj, index) => {
                  const pid = String(proj.id || proj._id);
                  return (
                    <div
                      key={pid}
                      className="flex flex-wrap items-center justify-between gap-3 border-2 border-ink bg-bg p-3 shadow-[2px_2px_0_var(--color-ink)]"
                    >
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-sm font-bold text-ink truncate">
                          {proj.title}
                        </h4>
                        <p className="text-xs text-muted truncate">
                          {(proj.techStack || []).join(" · ") || "No stack tags"}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={index === 0 || saving}
                          onClick={() => handleMoveProject(index, -1)}
                          className="border border-ink bg-panel px-2 py-1 text-xs font-bold disabled:opacity-40 hover:bg-gyellow"
                          title="Move up"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === (user.projects?.length || 0) - 1 || saving}
                          onClick={() => handleMoveProject(index, 1)}
                          className="border border-ink bg-panel px-2 py-1 text-xs font-bold disabled:opacity-40 hover:bg-gyellow"
                          title="Move down"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          onClick={() => startEditProject(proj)}
                          className="border border-ink bg-wash-blue px-2.5 py-1 text-xs font-bold text-ink hover:bg-gyellow"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleDeleteProject(pid)}
                          className="border border-gred bg-bg px-2.5 py-1 text-xs font-bold text-gred hover:bg-wash-red"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: SOCIAL LINKS & STYLE */}
          {activeTab === "socials" && (
            <form onSubmit={handleSaveSocialsAndAppearance} className="space-y-6">
              <div className="space-y-4">
                <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
                  Social & Developer Profiles
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="social-github" className={labelCls}>GitHub URL</label>
                    <input
                      id="social-github"
                      type="url"
                      className={inputCls}
                      value={socials.github}
                      onChange={(e) => setSocials({ ...socials, github: e.target.value })}
                      placeholder="https://github.com/username"
                    />
                  </div>
                  <div>
                    <label htmlFor="social-linkedin" className={labelCls}>LinkedIn URL</label>
                    <input
                      id="social-linkedin"
                      type="url"
                      className={inputCls}
                      value={socials.linkedin}
                      onChange={(e) => setSocials({ ...socials, linkedin: e.target.value })}
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                  <div>
                    <label htmlFor="social-portfolio" className={labelCls}>Portfolio URL</label>
                    <input
                      id="social-portfolio"
                      type="url"
                      className={inputCls}
                      value={socials.portfolio}
                      onChange={(e) => setSocials({ ...socials, portfolio: e.target.value })}
                      placeholder="https://yourportfolio.dev"
                    />
                  </div>
                  <div>
                    <label htmlFor="social-website" className={labelCls}>Personal Website</label>
                    <input
                      id="social-website"
                      type="url"
                      className={inputCls}
                      value={socials.website}
                      onChange={(e) => setSocials({ ...socials, website: e.target.value })}
                      placeholder="https://blog.example.com"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="social-twitter" className={labelCls}>Twitter / X URL</label>
                    <input
                      id="social-twitter"
                      type="url"
                      className={inputCls}
                      value={socials.twitter}
                      onChange={(e) => setSocials({ ...socials, twitter: e.target.value })}
                      placeholder="https://x.com/handle"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-ink/20 pt-5 space-y-4">
                <h3 className="font-display text-sm font-bold text-ink uppercase tracking-wider">
                  Membership Card & Accent Appearance
                </h3>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CARD_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setCardTheme(theme.id)}
                      className={`border-2 p-2.5 text-center text-xs font-bold ${
                        cardTheme === theme.id
                          ? "border-ink bg-gyellow shadow-[2px_2px_0_var(--color-ink)] text-ink"
                          : "border-ink/40 bg-panel text-muted"
                      }`}
                    >
                      {theme.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAccentColor(c.id)}
                      className={`flex items-center gap-2 border-2 px-3 py-1.5 text-xs font-bold ${
                        accentColor === c.id
                          ? "border-ink bg-bg shadow-[2px_2px_0_var(--color-ink)] text-ink"
                          : "border-ink/40 bg-panel text-muted"
                      }`}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-ink"
                        style={{ backgroundColor: c.bg }}
                      />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="hard-button border-2 border-ink bg-gyellow px-5 py-2.5 font-display text-sm font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Socials & Styling"}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 border-ink bg-panel2 px-4 sm:px-5 py-3">
          <span className="text-[11px] font-medium text-muted">
            {isDirty ? "You have unsaved edits." : "Changes update immediately on your live hub."}
          </span>
          <button
            type="button"
            onClick={requestClose}
            className="hard-button border-2 border-ink bg-bg px-4 py-1.5 font-display text-xs font-bold text-ink hover:bg-panel"
          >
            Done
          </button>
        </div>
      </div>

      {/* Cropping Sub-Modal */}
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          uploading={mediaBusy}
          onSave={handleSaveCroppedAvatar}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  );
}
