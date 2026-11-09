import { useEffect, useRef, useState, type PointerEvent } from "react";

export default function AvatarCropModal({
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
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

