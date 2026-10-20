import React, { useEffect, useRef } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "../../utils/cn";

// ----------------------------------------------------
// Skeleton Loader (Zero Layout Shift)
// ----------------------------------------------------
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn("animate-pulse bg-line/60 rounded-sm", className)}
      style={style}
      aria-hidden="true"
    />
  );
}

// ----------------------------------------------------
// Status Badges (Never rely on color alone)
// ----------------------------------------------------
export type BadgeVariant =
  | "published"
  | "draft"
  | "upcoming"
  | "completed"
  | "cancelled"
  | "ongoing"
  | "archived"
  | "active"
  | "used"
  | "checked_in"
  | "confirmed";

export function StatusBadge({
  status,
  className,
}: {
  status: BadgeVariant | string;
  className?: string;
}) {
  const norm = String(status).toLowerCase().replace(/-/g, "_");

  switch (norm) {
    case "published":
    case "active":
    case "confirmed":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-wash-green text-ink",
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-ggreen shrink-0" aria-hidden="true" />
          <span className="capitalize">{status}</span>
        </span>
      );

    case "draft":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-panel2 text-muted",
            className
          )}
        >
          <Clock className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
          <span>Draft</span>
        </span>
      );

    case "upcoming":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-wash-blue text-ink",
            className
          )}
        >
          <Calendar className="w-3.5 h-3.5 text-gblue shrink-0" aria-hidden="true" />
          <span>Upcoming</span>
        </span>
      );

    case "ongoing":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-wash-blue text-ink",
            className
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-gblue shrink-0" aria-hidden="true" />
          <span>Ongoing</span>
        </span>
      );

    case "completed":
    case "used":
    case "checked_in":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-wash-green text-ink",
            className
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-ggreen shrink-0" aria-hidden="true" />
          <span className="capitalize">{status.replace(/_/g, " ")}</span>
        </span>
      );

    case "cancelled":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-wash-red text-ink",
            className
          )}
        >
          <XCircle className="w-3.5 h-3.5 text-gred shrink-0" aria-hidden="true" />
          <span>Cancelled</span>
        </span>
      );

    case "archived":
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold border border-ink bg-panel text-muted",
            className
          )}
        >
          <Layers className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
          <span>Archived</span>
        </span>
      );

    default:
      return (
        <span
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold border border-ink bg-panel text-ink",
            className
          )}
        >
          <span>{status}</span>
        </span>
      );
  }
}

// ----------------------------------------------------
// Empty State with Clear Call-to-Action
// ----------------------------------------------------
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Layers,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-panel border-2 border-dashed border-line rounded-sm">
      <div className="w-12 h-12 mb-3 grid place-items-center bg-bg border-2 border-ink shadow-[2px_2px_0_#202124]">
        <Icon className="w-6 h-6 text-muted" aria-hidden="true" />
      </div>
      <h3 className="font-display text-lg font-bold text-ink mb-1">{title}</h3>
      <p className="text-sm text-muted max-w-md mb-5">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="hard-button inline-flex items-center gap-2 px-4 py-2 bg-gblue text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Error Alert with Retry
// ----------------------------------------------------
export function ErrorAlert({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="p-4 bg-wash-red border-2 border-gred text-ink flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-[3px_3px_0_#EA4335]"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-gred shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <h4 className="font-display font-bold text-sm">Action Failed</h4>
          <p className="text-xs sm:text-sm text-ink-2">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold font-display bg-white border border-ink text-ink shadow-[2px_2px_0_#202124] hover:bg-panel self-end sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      )}
    </div>
  );
}

// ----------------------------------------------------
// Accessible Modal with Focus Management & Escape Key
// ----------------------------------------------------
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-2xl",
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus first focusable element
    const timeout = setTimeout(() => {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      clearTimeout(timeout);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        ref={modalRef}
        className={cn(
          "relative w-full bg-white border-[3px] border-ink shadow-[6px_6px_0_#202124] my-8 overflow-hidden",
          maxWidth
        )}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b-2 border-ink bg-panel">
          <h2 id="modal-title" className="font-display text-xl font-bold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 hover:bg-line/50 rounded-xs transition-colors border border-transparent hover:border-ink"
          >
            <X className="w-5 h-5 text-ink" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
