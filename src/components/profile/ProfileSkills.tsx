import { type Profile, type SkillItem } from "../../lib/profile";

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Programming: { bg: "#E8F0FE", text: "#174EA6", border: "#4285F4" },
  Frontend: { bg: "#E6F4EA", text: "#137333", border: "#34A853" },
  Backend: { bg: "#FEF7E0", text: "#B06000", border: "#FBBC04" },
  Databases: { bg: "#FCE8E6", text: "#C5221F", border: "#EA4335" },
  "Cloud & DevOps": { bg: "#E8F0FE", text: "#174EA6", border: "#4285F4" },
  "AI & ML": { bg: "#F3E8FD", text: "#7627BB", border: "#A142F4" },
  Design: { bg: "#FEF7E0", text: "#B06000", border: "#FBBC04" },
  "Developer Tools": { bg: "#F1F3F4", text: "#202124", border: "#5F6368" },
  Other: { bg: "#F1F3F4", text: "#202124", border: "#BDC1C6" },
};

export default function ProfileSkills({
  user,
  onOpenSkillsEditor,
}: {
  user: Profile;
  onOpenSkillsEditor?: () => void;
}) {
  const skills: SkillItem[] = user.skills || [];

  // Group skills by category
  const grouped = skills.reduce<Record<string, SkillItem[]>>((acc, s) => {
    const cat = s.category || "Other";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  const categoryNames = Object.keys(grouped);

  return (
    <section className="border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-black text-ink sm:text-2xl">
              Technical Skills & Tooling
            </h2>
            <span className="border border-ink bg-panel px-2 py-0.5 font-mono text-xs font-bold text-ink">
              {skills.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Technologies, frameworks, and developer tools in your daily workflow.
          </p>
        </div>

        {onOpenSkillsEditor && (
          <button
            type="button"
            onClick={onOpenSkillsEditor}
            className="hard-button border-2 border-ink bg-panel px-3.5 py-1.5 font-display text-xs font-bold text-ink hover:bg-gyellow shadow-[2px_2px_0_var(--color-ink)]"
          >
            ⚡ Manage Skills
          </button>
        )}
      </div>

      {skills.length === 0 ? (
        <div className="mt-6 border-2 border-dashed border-ink/40 bg-panel/40 p-6 text-center">
          <p className="font-display text-sm font-bold text-ink">
            No technical skills added yet.
          </p>
          <p className="mt-1 text-xs text-muted">
            Add programming languages, frameworks, cloud platforms, and developer tools to showcase your capabilities.
          </p>
          {onOpenSkillsEditor && (
            <button
              type="button"
              onClick={onOpenSkillsEditor}
              className="hard-button mt-4 border-2 border-ink bg-gyellow px-4 py-2 font-display text-xs font-bold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:bg-gyellow/80"
            >
              + Add Skills from Catalog
            </button>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {categoryNames.map((cat) => {
            const items = grouped[cat];
            const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.Other;
            return (
              <div key={cat} className="space-y-2">
                <h3 className="font-mono text-xs font-bold tracking-wider text-muted uppercase">
                  {cat}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span
                      key={item.name}
                      className="inline-flex items-center gap-1.5 border-2 border-ink px-3 py-1 text-xs font-bold shadow-[2px_2px_0_var(--color-ink)] transition-transform hover:-translate-y-0.5"
                      style={{
                        backgroundColor: color.bg,
                        color: color.text,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color.border }} />
                      <span>{item.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

