import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Globe,
  FileText,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  CheckCircle,
  Code2,
} from "lucide-react";
import {
  adminApi,
  type AdminProject,
  type ProjectStatus,
  type ProjectPublication,
} from "../../lib/admin";
import { StatusBadge, Skeleton, EmptyState, ErrorAlert, Modal } from "./AdminUi";

interface ProjectFormData {
  title: string;
  shortDescription: string;
  fullDescription: string;
  domain: string;
  techStack: string;
  githubUrl: string;
  liveDemoUrl: string;
  docsUrl: string;
  coverImage: string;
  status: ProjectStatus;
  publicationStatus: ProjectPublication;
}

const initialForm: ProjectFormData = {
  title: "",
  shortDescription: "",
  fullDescription: "",
  domain: "Web Development",
  techStack: "React, TypeScript, Node.js",
  githubUrl: "",
  liveDemoUrl: "",
  docsUrl: "",
  coverImage: "",
  status: "ongoing",
  publicationStatus: "published",
};

export default function ProjectsSection({
  createOpen,
  onCloseCreate,
}: {
  createOpen: boolean;
  onCloseCreate: () => void;
}) {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [domainFilter, setDomainFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Modal State
  const [editProject, setEditProject] = useState<AdminProject | null>(null);
  const [formData, setFormData] = useState<ProjectFormData>(initialForm);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Delete Confirmation Modal
  const [projectToDelete, setProjectToDelete] = useState<AdminProject | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchProjects = (targetPage = page) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("page", String(targetPage));
    params.set("limit", "8");
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter) params.set("status", statusFilter);
    if (domainFilter) params.set("domain", domainFilter);
    if (sortBy) params.set("sortBy", sortBy);
    if (sortOrder) params.set("sortOrder", sortOrder);

    adminApi<{
      projects: AdminProject[];
      total: number;
      page: number;
      totalPages: number;
    }>(`/projects?${params.toString()}`, "GET", undefined, abortControllerRef.current.signal)
      .then((res) => {
        setProjects(res.projects);
        setTotal(res.total);
        setTotalPages(res.totalPages);
        setPage(res.page);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message || "Failed to load projects.");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchProjects(1);
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [search, statusFilter, domainFilter, sortBy, sortOrder]);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  useEffect(() => {
    if (createOpen) {
      setEditProject(null);
      setFormData(initialForm);
      setFormErrors({});
      setServerError(null);
    }
  }, [createOpen]);

  const handleOpenEdit = (p: AdminProject) => {
    setEditProject(p);
    setFormData({
      title: p.title || "",
      shortDescription: p.shortDescription || "",
      fullDescription: p.fullDescription || "",
      domain: p.domain || p.category || "Web Development",
      techStack: Array.isArray(p.techStack) ? p.techStack.join(", ") : "",
      githubUrl: p.githubUrl || "",
      liveDemoUrl: p.liveDemoUrl || "",
      docsUrl: p.docsUrl || "",
      coverImage: p.coverImage || "",
      status: p.status || "ongoing",
      publicationStatus: p.publicationStatus || "published",
    });
    setFormErrors({});
    setServerError(null);
  };

  const handleCloseModal = () => {
    setEditProject(null);
    onCloseCreate();
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!formData.title.trim() || formData.title.trim().length < 2) {
      errs.title = "Project title is required (min 2 characters).";
    }
    if (!formData.shortDescription.trim() || formData.shortDescription.trim().length < 5) {
      errs.shortDescription = "Short description must be at least 5 characters.";
    }
    if (!formData.domain.trim()) {
      errs.domain = "Domain/category is required.";
    }
    const urlCheck = (url: string, name: string) => {
      if (url && !/^https?:\/\/\S+$/i.test(url.trim())) {
        errs[name] = `${name} must start with http:// or https://`;
      }
    };
    urlCheck(formData.githubUrl, "githubUrl");
    urlCheck(formData.liveDemoUrl, "liveDemoUrl");
    urlCheck(formData.docsUrl, "docsUrl");
    urlCheck(formData.coverImage, "coverImage");

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setServerError(null);

    const techStackArray = formData.techStack
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const payload = {
      ...formData,
      techStack: techStackArray,
    };

    try {
      if (editProject && editProject._id) {
        await adminApi(`/projects/${editProject._id || editProject.id}`, "PATCH", payload);
        showToast(`Project "${formData.title}" updated successfully.`);
      } else {
        await adminApi("/projects", "POST", payload);
        showToast(`Project "${formData.title}" created successfully.`);
      }
      handleCloseModal();
      fetchProjects();
    } catch (err: any) {
      setServerError(err.message || "Failed to save project.");
      if (err.errors) setFormErrors(err.errors);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectToDelete) return;
    setDeleting(true);
    try {
      await adminApi(`/projects/${projectToDelete._id || projectToDelete.id}`, "DELETE");
      showToast(`Project "${projectToDelete.title}" deleted.`);
      setProjectToDelete(null);
      fetchProjects();
    } catch (err: any) {
      alert(err.message || "Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {successToast && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-wash-green border-2 border-ggreen text-ink text-sm font-bold flex items-center gap-2 shadow-[3px_3px_0_#34A853]"
        >
          <CheckCircle className="w-5 h-5 text-ggreen shrink-0" aria-hidden="true" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Project Management
          </h1>
          <p className="text-sm text-muted mt-1">
            Maintain community open-source repositories, showcase student projects, and track technical domains ({total} total).
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditProject(null);
            setFormData(initialForm);
            setFormErrors({});
            setServerError(null);
            setEditProject({} as any);
          }}
          className="hard-button inline-flex items-center gap-1.5 px-4 py-2 bg-gyellow text-ink font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform self-start md:self-auto"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Add Project</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-panel border-2 border-ink shadow-[3px_3px_0_#202124] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <label htmlFor="proj-search" className="sr-only">
            Search projects
          </label>
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="proj-search"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, tech stack..."
            className="w-full pl-9 pr-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          />
        </div>

        <div>
          <label htmlFor="proj-status" className="sr-only">
            Filter by status
          </label>
          <select
            id="proj-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">All Statuses</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label htmlFor="proj-domain" className="sr-only">
            Filter by domain
          </label>
          <select
            id="proj-domain"
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="">All Domains</option>
            <option value="Web Development">Web Development</option>
            <option value="Mobile Development">Mobile Development</option>
            <option value="Cloud / DevOps">Cloud / DevOps</option>
            <option value="AI / Machine Learning">AI / Machine Learning</option>
            <option value="Cybersecurity">Cybersecurity</option>
            <option value="IoT">IoT</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="proj-sort" className="sr-only">
            Sort by
          </label>
          <select
            id="proj-sort"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            <option value="createdAt">Date Created</option>
            <option value="title">Project Title</option>
            <option value="status">Status</option>
          </select>
          <button
            type="button"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
            title={`Sort order: ${sortOrder}`}
            aria-label={`Toggle sort order, current ${sortOrder}`}
            className="p-2 bg-white border border-ink hover:bg-panel"
          >
            <ArrowUpDown className="w-4 h-4 text-ink" aria-hidden="true" />
          </button>
        </div>
      </div>

      {error && <ErrorAlert message={error} onRetry={() => fetchProjects()} />}

      {/* Projects Grid / Table */}
      <div className="bg-white border-2 border-ink shadow-[4px_4px_0_#202124] overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between py-3 border-b border-line">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No projects found"
              description="No community projects matched your current filters. Add a new project to showcase work."
              actionLabel="Add Project"
              onAction={() => {
                setEditProject({} as any);
                setFormData(initialForm);
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-panel border-b-2 border-ink text-xs font-bold text-muted uppercase tracking-wider">
                  <th className="py-3.5 px-4 font-bold text-ink">Project Title & Domain</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Tech Stack</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Status</th>
                  <th className="py-3.5 px-4 font-bold text-ink">Links</th>
                  <th className="py-3.5 px-4 font-bold text-ink text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-sm">
                {projects.map((p) => (
                  <tr key={p._id || p.id} className="hover:bg-panel/50 transition-colors">
                    {/* Title & Domain */}
                    <td className="py-3.5 px-4">
                      <div className="font-display font-bold text-ink">{p.title}</div>
                      <div className="text-xs text-muted mt-0.5 flex items-center gap-2">
                        <span className="font-semibold text-ink-2">{p.domain}</span>
                        {p.publicationStatus === "draft" && (
                          <span className="text-[10px] uppercase font-mono px-1 py-0.2 bg-panel2 text-muted border border-line">
                            Draft
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted line-clamp-1 max-w-sm mt-1">
                        {p.shortDescription}
                      </p>
                    </td>

                    {/* Tech Stack */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {p.techStack && p.techStack.length > 0 ? (
                          p.techStack.slice(0, 3).map((tech, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-[11px] font-mono bg-panel border border-line text-ink"
                            >
                              {tech}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted italic">None specified</span>
                        )}
                        {p.techStack && p.techStack.length > 3 && (
                          <span className="text-[10px] text-muted self-center">
                            +{p.techStack.length - 3}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} />
                    </td>

                    {/* External Links */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        {p.githubUrl && (
                          <a
                            href={p.githubUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:text-gblue"
                            title="GitHub Repository"
                            aria-label={`GitHub repository for ${p.title}`}
                          >
                            <Code2 className="w-4 h-4" />
                          </a>
                        )}
                        {p.liveDemoUrl && (
                          <a
                            href={p.liveDemoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:text-ggreen"
                            title="Live Demo"
                            aria-label={`Live demo for ${p.title}`}
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                        {p.docsUrl && (
                          <a
                            href={p.docsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 hover:text-gyellow"
                            title="Documentation"
                            aria-label={`Documentation for ${p.title}`}
                          >
                            <FileText className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(p)}
                          className="p-1.5 text-ink border border-ink hover:bg-panel shadow-[1px_1px_0_#202124]"
                          title="Edit Project"
                          aria-label={`Edit project ${p.title}`}
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setProjectToDelete(p)}
                          className="p-1.5 text-gred border border-ink hover:bg-wash-red shadow-[1px_1px_0_#202124]"
                          title="Delete Project"
                          aria-label={`Delete project ${p.title}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-4 border-t-2 border-ink bg-panel flex items-center justify-between text-xs">
            <span className="text-muted">
              Page {page} of {totalPages} ({total} projects)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchProjects(page - 1)}
                disabled={page <= 1}
                className="px-2.5 py-1.5 bg-white border border-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-panel flex items-center gap-1 font-bold"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Prev</span>
              </button>
              <button
                type="button"
                onClick={() => fetchProjects(page + 1)}
                disabled={page >= totalPages}
                className="px-2.5 py-1.5 bg-white border border-ink disabled:opacity-40 disabled:cursor-not-allowed hover:bg-panel flex items-center gap-1 font-bold"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CREATE / EDIT PROJECT MODAL */}
      <Modal
        isOpen={Boolean(editProject || createOpen)}
        onClose={handleCloseModal}
        title={editProject && editProject._id ? `Edit: ${editProject.title}` : "Add Community Project"}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {serverError && <ErrorAlert message={serverError} />}

          <div>
            <label htmlFor="proj-title" className="block text-xs font-bold text-ink uppercase mb-1">
              Project Title <span className="text-gred">*</span>
            </label>
            <input
              id="proj-title"
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g. GDGoC Attendance Scanner App"
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
            {formErrors.title && <p className="text-xs text-gred mt-1 font-semibold">{formErrors.title}</p>}
          </div>

          <div>
            <label htmlFor="proj-shortDesc" className="block text-xs font-bold text-ink uppercase mb-1">
              Short Description <span className="text-gred">*</span>
            </label>
            <textarea
              id="proj-shortDesc"
              rows={2}
              required
              value={formData.shortDescription}
              onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
              placeholder="A concise summary of the project purpose and architecture..."
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
            {formErrors.shortDescription && (
              <p className="text-xs text-gred mt-1 font-semibold">{formErrors.shortDescription}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-domain-select" className="block text-xs font-bold text-ink uppercase mb-1">
                Domain / Category <span className="text-gred">*</span>
              </label>
              <select
                id="proj-domain-select"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              >
                <option value="Web Development">Web Development</option>
                <option value="Mobile Development">Mobile Development</option>
                <option value="Cloud / DevOps">Cloud / DevOps</option>
                <option value="AI / Machine Learning">AI / Machine Learning</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="IoT">IoT</option>
              </select>
            </div>

            <div>
              <label htmlFor="proj-status-select" className="block text-xs font-bold text-ink uppercase mb-1">
                Status
              </label>
              <select
                id="proj-status-select"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as ProjectStatus })}
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              >
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="proj-techStack" className="block text-xs font-bold text-ink uppercase mb-1">
              Tech Stack (Comma-separated)
            </label>
            <input
              id="proj-techStack"
              type="text"
              value={formData.techStack}
              onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
              placeholder="React, TypeScript, Express, MongoDB, Tailwind CSS"
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="proj-github" className="block text-xs font-bold text-ink uppercase mb-1">
                GitHub Repository URL
              </label>
              <input
                id="proj-github"
                type="url"
                value={formData.githubUrl}
                onChange={(e) => setFormData({ ...formData, githubUrl: e.target.value })}
                placeholder="https://github.com/..."
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.githubUrl && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.githubUrl}</p>
              )}
            </div>

            <div>
              <label htmlFor="proj-liveDemo" className="block text-xs font-bold text-ink uppercase mb-1">
                Live Demo URL
              </label>
              <input
                id="proj-liveDemo"
                type="url"
                value={formData.liveDemoUrl}
                onChange={(e) => setFormData({ ...formData, liveDemoUrl: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
              />
              {formErrors.liveDemoUrl && (
                <p className="text-xs text-gred mt-1 font-semibold">{formErrors.liveDemoUrl}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="proj-coverImage" className="block text-xs font-bold text-ink uppercase mb-1">
              Cover Image URL
            </label>
            <input
              id="proj-coverImage"
              type="url"
              value={formData.coverImage}
              onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              placeholder="https://images.unsplash.com/... or screenshot URL"
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
            {formErrors.coverImage && (
              <p className="text-xs text-gred mt-1 font-semibold">{formErrors.coverImage}</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-line">
            <button
              type="button"
              onClick={handleCloseModal}
              disabled={submitting}
              className="px-4 py-2 border border-ink text-sm font-bold text-ink hover:bg-panel disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="hard-button inline-flex items-center gap-2 px-5 py-2 bg-gyellow text-ink font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50"
            >
              {submitting ? "Saving..." : editProject && editProject._id ? "Save Changes" : "Create Project"}
            </button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE MODAL */}
      <Modal
        isOpen={Boolean(projectToDelete)}
        onClose={() => setProjectToDelete(null)}
        title="Delete Project"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">
            Are you sure you want to delete the project{" "}
            <strong>"{projectToDelete?.title}"</strong>? This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => setProjectToDelete(null)}
              disabled={deleting}
              className="px-4 py-2 border border-ink text-sm font-bold text-ink hover:bg-panel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={deleting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gred text-white text-sm font-bold border-2 border-ink shadow-[2px_2px_0_#202124] hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete Project"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
