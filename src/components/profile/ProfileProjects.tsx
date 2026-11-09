import { useState } from "react";
import { type Profile, type ProjectItem, resolveImageUrl, safeExternalUrl } from "../../lib/profile";

function ProjectCard({ proj }: { proj: ProjectItem }) {
  const [imgFailed, setImgFailed] = useState(false);
  const githubHref = safeExternalUrl(proj.githubUrl);
  const liveHref = safeExternalUrl(proj.liveUrl);

  return (
    <div className="flex flex-col justify-between border-2 border-ink bg-panel p-4 shadow-[4px_4px_0_var(--color-ink)] transition-transform hover:-translate-y-1">
      <div>
        {/* Project Optional Image Banner */}
        {proj.imageUrl && !imgFailed && (
          <div className="mb-3 h-32 w-full overflow-hidden border border-ink bg-bg">
            <img
              src={resolveImageUrl(proj.imageUrl)}
              alt={proj.title}
              className="h-full w-full object-cover"
              onError={() => setImgFailed(true)}
            />
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-lg font-bold text-ink break-words">
            {proj.title}
          </h3>
          {proj.featured && (
            <span className="shrink-0 border border-ink bg-gyellow px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink uppercase">
              ★ Featured
            </span>
          )}
        </div>

        {proj.description && (
          <p className="mt-2 text-xs text-muted leading-relaxed line-clamp-3">
            {proj.description}
          </p>
        )}

        {/* Tech Stack Chips */}
        {proj.techStack && proj.techStack.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {proj.techStack.map((tech) => (
              <span
                key={tech}
                className="border border-ink/40 bg-bg px-2 py-0.5 font-mono text-[10px] font-bold text-ink/80"
              >
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Project Action Links */}
      {(githubHref || liveHref) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink/20 pt-3 text-xs font-bold">
          {githubHref && (
            <a
              href={githubHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-ink bg-bg px-2.5 py-1 text-ink shadow-[2px_2px_0_var(--color-ink)] hover:bg-gyellow"
            >
              <span>GitHub →</span>
            </a>
          )}
          {liveHref && (
            <a
              href={liveHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 border border-ink bg-bg px-2.5 py-1 text-gblue shadow-[2px_2px_0_var(--color-ink)] hover:bg-gblue hover:text-white"
            >
              <span>Live Demo ↗</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProfileProjects({
  user,
  onOpenProjectsEditor,
  onAddProject,
}: {
  user: Profile;
  onOpenProjectsEditor?: () => void;
  onAddProject?: () => void;
}) {
  const projects: ProjectItem[] = user.projects || [];

  return (
    <section className="border-[3px] border-ink bg-bg p-5 shadow-[6px_6px_0_var(--color-ink)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-black text-ink sm:text-2xl">
              Featured Projects & Work
            </h2>
            <span className="border border-ink bg-panel px-2 py-0.5 font-mono text-xs font-bold text-ink">
              {projects.length}/6
            </span>
          </div>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            Showcase your open source tools, campus hacks, side projects, and apps.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenProjectsEditor && projects.length > 0 && (
            <button
              type="button"
              onClick={onOpenProjectsEditor}
              className="hard-button border-2 border-ink bg-panel px-3 py-1.5 font-display text-xs font-bold text-ink hover:bg-gyellow shadow-[2px_2px_0_var(--color-ink)]"
            >
              ⚙ Reorder / Edit
            </button>
          )}
          {onAddProject && projects.length < 6 && (
            <button
              type="button"
              onClick={onAddProject}
              className="hard-button border-2 border-ink bg-gyellow px-3.5 py-1.5 font-display text-xs font-extrabold text-ink shadow-[2px_2px_0_var(--color-ink)] hover:bg-gyellow/90"
            >
              + Add Project
            </button>
          )}
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="mt-6 border-2 border-dashed border-ink/40 bg-panel/30 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center border-2 border-ink bg-wash-blue text-2xl shadow-[3px_3px_0_var(--color-ink)]">
            🚀
          </div>
          <p className="mt-3 font-display text-base font-extrabold text-ink">
            No projects featured yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted sm:text-sm">
            Highlight your best applications, GitHub repositories, or open-source contributions to share with the community.
          </p>
          {onAddProject && (
            <button
              type="button"
              onClick={onAddProject}
              className="hard-button mt-4 border-2 border-ink bg-gyellow px-5 py-2 font-display text-xs font-bold text-ink shadow-[3px_3px_0_var(--color-ink)] hover:bg-gyellow/80"
            >
              + Feature Your First Project
            </button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {projects.map((proj) => (
            <ProjectCard key={proj.id || proj._id || proj.title} proj={proj} />
          ))}
        </div>
      )}
    </section>
  );
}

