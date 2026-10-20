import { useState, useEffect, useRef } from "react";
import jsQR from "jsqr";
import {
  QrCode,
  Camera,
  CameraOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  adminApi,
  type AdminEvent,
  type VerificationResult,
} from "../../lib/admin";
import { Modal, ErrorAlert } from "./AdminUi";

export default function AttendanceSection() {
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");

  // Manual verification
  const [manualCode, setManualCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  // Outcome Card
  const [result, setResult] = useState<VerificationResult | null>(null);

  // Camera QR Scanner State
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Mistaken Check-in Correction State
  const [undoTarget, setUndoTarget] = useState<VerificationResult | null>(null);
  const [undoReason, setUndoReason] = useState("");
  const [correcting, setCorrecting] = useState(false);
  const [undoSuccess, setUndoSuccess] = useState<string | null>(null);

  // Recent local check-in log during this session
  const [sessionCheckIns, setSessionCheckIns] = useState<VerificationResult[]>([]);

  // Load events
  useEffect(() => {
    adminApi<{ events: AdminEvent[] }>("/events?limit=100")
      .then((res) => {
        setEvents(res.events);
        if (res.events.length > 0) {
          setSelectedEventId(res.events[0]._id || res.events[0].id || "");
        }
      })
      .catch((err) => {
        console.error("Failed to load events for attendance scanner:", err);
      });
  }, []);

  // Stop camera tracks cleanly on unmount or when stopping
  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScanning(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Verification request helper
  const verifyTicket = async (ticketOrRef: string) => {
    const code = ticketOrRef.trim();
    if (!code) return;

    setVerifying(true);
    setResult(null);

    try {
      const res = await adminApi<VerificationResult>("/attendance/verify", "POST", {
        ticketCode: code,
        eventId: selectedEventId || undefined,
      });

      setResult(res);
      if (res.valid) {
        setSessionCheckIns((prev) => [res, ...prev.slice(0, 9)]);
      }
    } catch (err: any) {
      if (err.status === 409) {
        setResult({
          valid: false,
          status: "already-used",
          message: err.message || "Ticket has already been checked in.",
          participant: err.participant,
          checkedInAt: err.checkedInAt,
          ticketId: code,
        });
      } else if (err.status === 400) {
        setResult({
          valid: false,
          status: "ineligible",
          message: err.message || "Ticket or event is cancelled and ineligible for check-in.",
          participant: err.participant,
          ticketId: code,
        });
      } else if (err.status === 404) {
        setResult({
          valid: false,
          status: "invalid",
          message: err.message || "Ticket not found or does not belong to this event.",
          ticketId: code,
        });
      } else {
        setResult({
          valid: false,
          status: "network-error",
          message: err.message || "Network error. Check-in was not recorded.",
          ticketId: code,
        });
      }
    } finally {
      setVerifying(false);
      setManualCode("");
    }
  };

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera API is not supported in this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });

      streamRef.current = stream;
      setScanning(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        scanVideoFrames();
      }
    } catch (err: any) {
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission denied. Please allow camera access in your browser settings or use manual ticket verification."
          : err.message || "Unable to access camera hardware."
      );
      stopCamera();
    }
  };

  // Scan Video Frames Loop
  const scanVideoFrames = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanVideoFrames);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    let detectedCode: string | null = null;

    // 1. Try native BarcodeDetector if available
    if ("BarcodeDetector" in window) {
      try {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ["qr_code"],
        });
        barcodeDetector.detect(canvas).then((barcodes: any[]) => {
          if (barcodes.length > 0 && barcodes[0].rawValue) {
            const raw = String(barcodes[0].rawValue);
            stopCamera();
            verifyTicket(raw);
          }
        });
      } catch {
        // Fall back to jsqr
      }
    }

    // 2. Fallback to jsQR on canvas pixel data
    if (!detectedCode) {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      if (code && code.data) {
        detectedCode = code.data;
        stopCamera();
        verifyTicket(detectedCode);
        return;
      }
    }

    animationFrameRef.current = requestAnimationFrame(scanVideoFrames);
  };

  // Revert Mistaken Check-in
  const handleConfirmUndo = async () => {
    if (!undoTarget || !undoReason.trim()) return;
    setCorrecting(true);

    try {
      const targetId =
        undoTarget.registrationReference || undoTarget.ticketId || undoTarget.participant?.email;

      await adminApi(`/attendance/${targetId}/correct`, "PATCH", {
        reason: undoReason.trim(),
      });

      setUndoSuccess(`Check-in for ${undoTarget.participant?.name || "attendee"} successfully reverted.`);
      setResult(null);
      setUndoTarget(null);
      setUndoReason("");

      // Remove from session check-ins
      setSessionCheckIns((prev) =>
        prev.filter((p) => p.registrationReference !== undoTarget.registrationReference)
      );
    } catch (err: any) {
      alert(err.message || "Failed to revert check-in.");
    } finally {
      setCorrecting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-ink pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-ink tracking-tight">
            Attendance & QR Scanner
          </h1>
          <p className="text-sm text-muted mt-1">
            Real-time event entrance check-in with high-contrast authoritative verification.
          </p>
        </div>

        {/* Event scope selector */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <label htmlFor="scan-event-selector" className="text-xs font-bold text-ink uppercase">
            Event:
          </label>
          <select
            id="scan-event-selector"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="px-3 py-1.5 bg-panel border-2 border-ink text-xs font-bold text-ink focus:outline-hidden focus:ring-2 focus:ring-gblue"
          >
            {events.map((ev) => (
              <option key={ev._id || ev.id} value={ev._id || ev.id}>
                {ev.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {undoSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="p-3 bg-wash-green border-2 border-ggreen text-ink text-sm font-bold flex items-center justify-between shadow-[3px_3px_0_#34A853]"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-ggreen shrink-0" />
            <span>{undoSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setUndoSuccess(null)}
            className="text-xs underline font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Verification Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Camera Scanner & Manual Input */}
        <div className="space-y-6">
          {/* Camera QR Scanner Box */}
          <div className="p-6 bg-white border-[3px] border-ink shadow-[4px_4px_0_#202124] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-gblue" aria-hidden="true" />
                <h2 className="font-display text-lg font-bold text-ink">Camera QR Scanner</h2>
              </div>
              <span className="text-xs font-mono px-2 py-0.5 bg-panel border border-ink">
                {scanning ? "Camera Active" : "Standby"}
              </span>
            </div>

            {/* Permission Explainer / Video Canvas */}
            {!scanning ? (
              <div className="p-5 bg-panel border-2 border-dashed border-line text-center space-y-3">
                <Camera className="w-8 h-8 text-muted mx-auto" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-sm font-bold text-ink">Camera Permissions</h3>
                  <p className="text-xs text-muted max-w-sm mx-auto mt-1">
                    Your browser will request temporary access to your camera to scan attendees' ticket QR codes. No video footage is stored or transmitted.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={startCamera}
                  className="hard-button inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[44px] min-w-[44px] bg-gblue text-white font-display text-sm font-bold border-2 border-ink shadow-[3px_3px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform"
                >
                  <Camera className="w-4 h-4" aria-hidden="true" />
                  <span>Start Camera Scanner</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative aspect-square max-h-[300px] w-full bg-black border-2 border-ink overflow-hidden mx-auto">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* QR Aiming Reticle */}
                  <div className="absolute inset-0 border-2 border-white/30 pointer-events-none flex items-center justify-center">
                    <div className="w-48 h-48 border-2 border-ggreen rounded-sm animate-pulse" />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={stopCamera}
                  className="hard-button w-full inline-flex items-center justify-center gap-2 py-3 min-h-[44px] bg-gred text-white font-display text-sm font-bold border-2 border-ink shadow-[2px_2px_0_#202124] hover:bg-red-700"
                >
                  <CameraOff className="w-4 h-4" aria-hidden="true" />
                  <span>Stop Camera Scanner</span>
                </button>
              </div>
            )}

            {cameraError && <ErrorAlert message={cameraError} onRetry={startCamera} />}
          </div>

          {/* Manual Ticket Verification Input */}
          <div className="p-6 bg-panel border-[3px] border-ink shadow-[4px_4px_0_#202124] space-y-4">
            <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <Search className="w-4 h-4 text-ink" aria-hidden="true" />
              <span>Manual Ticket Code Verification</span>
            </h2>
            <p className="text-xs text-muted">
              Verify an attendee using their alphanumeric Ticket Code or Registration Reference without a camera.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                verifyTicket(manualCode);
              }}
              className="flex gap-2"
            >
              <label htmlFor="manual-ticket-input" className="sr-only">
                Enter ticket code or reference
              </label>
              <input
                id="manual-ticket-input"
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. REG-ABC12 or Ticket Code"
                className="flex-1 px-3 py-2.5 bg-white border-2 border-ink font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue min-h-[44px]"
              />
              <button
                type="submit"
                disabled={verifying || !manualCode.trim()}
                className="hard-button px-5 py-2.5 min-h-[44px] bg-ink text-white font-display text-sm font-bold border-2 border-ink shadow-[2px_2px_0_#202124] hover:translate-x-0.5 hover:translate-y-0.5 transition-transform disabled:opacity-50"
              >
                {verifying ? "Checking..." : "Verify"}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Authoritative Outcome Card & Recent Stream */}
        <div className="space-y-6">
          {/* Authoritative Outcome Card */}
          <div
            className="p-6 bg-white border-[3px] border-ink shadow-[4px_4px_0_#202124] space-y-4"
            aria-live="polite"
          >
            <h2 className="font-display text-lg font-bold text-ink">
              Authoritative Verification Result
            </h2>

            {!result ? (
              <div className="p-8 text-center bg-panel border border-dashed border-line">
                <ShieldCheck className="w-10 h-10 text-muted mx-auto mb-2" aria-hidden="true" />
                <p className="font-display text-sm font-bold text-ink">Awaiting Ticket Scan</p>
                <p className="text-xs text-muted mt-1">
                  Point the camera at an attendee's QR ticket or enter a reference code to confirm entrance.
                </p>
              </div>
            ) : result.status === "valid" ? (
              /* VALID CHECK-IN OUTCOME CARD */
              <div className="p-5 bg-wash-green border-2 border-ggreen shadow-[3px_3px_0_#34A853] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-6 h-6 text-ggreen" aria-hidden="true" />
                    <span className="font-display text-lg font-black text-ink uppercase tracking-wide">
                      Valid Check-In
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 text-xs font-bold font-mono border border-ink bg-white text-ggreen">
                    ADMITTED
                  </span>
                </div>

                <div className="p-3 bg-white border border-ink space-y-1 text-xs">
                  <div className="font-bold text-sm text-ink">{result.participant?.name}</div>
                  <div className="text-muted font-mono">{result.participant?.email}</div>
                  {result.participant?.enrollmentNo && (
                    <div className="text-ink-2 font-mono">Roll: {result.participant.enrollmentNo}</div>
                  )}
                  {result.checkedInAt && (
                    <div className="text-muted text-[11px] font-mono mt-1 pt-1 border-t border-line">
                      Checked in at {new Date(result.checkedInAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>

                <p className="text-xs font-bold text-ink">{result.message}</p>

                {/* Undo Mistaken Check-in Button */}
                <button
                  type="button"
                  onClick={() => setUndoTarget(result)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink text-xs font-bold text-ink hover:bg-panel shadow-[1px_1px_0_#202124]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-muted" aria-hidden="true" />
                  <span>Undo Check-In (Correction)</span>
                </button>
              </div>
            ) : result.status === "already-used" ? (
              /* ALREADY USED DUPLICATE CARD */
              <div className="p-5 bg-wash-yellow border-2 border-gyellow shadow-[3px_3px_0_#FBBC04] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-ink" aria-hidden="true" />
                    <span className="font-display text-lg font-black text-ink uppercase tracking-wide">
                      Already Checked In
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 text-xs font-bold font-mono border border-ink bg-white text-ink">
                    DUPLICATE
                  </span>
                </div>

                <div className="p-3 bg-white border border-ink space-y-1 text-xs">
                  <div className="font-bold text-sm text-ink">{result.participant?.name || "Participant"}</div>
                  <div className="text-muted font-mono">{result.participant?.email}</div>
                  {result.checkedInAt && (
                    <div className="text-gred font-bold font-mono text-xs mt-1">
                      Previously checked in at: {new Date(result.checkedInAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <p className="text-xs font-bold text-ink">{result.message}</p>

                {/* Option to correct if this was a mistake */}
                <button
                  type="button"
                  onClick={() => setUndoTarget(result)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-ink text-xs font-bold text-ink hover:bg-panel shadow-[1px_1px_0_#202124]"
                >
                  <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Correct Mistaken Check-In</span>
                </button>
              </div>
            ) : (
              /* INVALID / INELIGIBLE / NETWORK ERROR CARD */
              <div className="p-5 bg-wash-red border-2 border-gred shadow-[3px_3px_0_#EA4335] space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-6 h-6 text-gred" aria-hidden="true" />
                    <span className="font-display text-lg font-black text-gred uppercase tracking-wide">
                      {result.status === "network-error" ? "Network Failure" : "Access Denied"}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 text-xs font-bold font-mono border border-ink bg-white text-gred">
                    REJECTED
                  </span>
                </div>

                <p className="text-sm font-bold text-ink">{result.message}</p>

                {result.participant?.name && (
                  <div className="text-xs text-muted">
                    Record found for: {result.participant.name}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Session Verified Attendees Feed */}
          <div className="p-6 bg-white border-[3px] border-ink shadow-[4px_4px_0_#202124] space-y-4">
            <h2 className="font-display text-base font-bold text-ink flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-ggreen" aria-hidden="true" />
              <span>Recently Admitted in this Session</span>
            </h2>

            {sessionCheckIns.length === 0 ? (
              <p className="text-xs text-muted italic">No attendees checked in during this session yet.</p>
            ) : (
              <div className="divide-y divide-line">
                {sessionCheckIns.map((ci, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-ink">{ci.participant?.name}</span>
                      <span className="text-muted font-mono block text-[11px]">{ci.participant?.email}</span>
                    </div>
                    <time className="font-mono text-muted text-[11px]">
                      {ci.checkedInAt ? new Date(ci.checkedInAt).toLocaleTimeString() : "Just now"}
                    </time>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MISTAKEN CHECK-IN CORRECTION MODAL */}
      <Modal
        isOpen={Boolean(undoTarget)}
        onClose={() => {
          setUndoTarget(null);
          setUndoReason("");
        }}
        title="Undo / Correct Mistaken Check-In"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-panel border border-ink text-xs space-y-1">
            <div className="font-bold text-ink">
              Participant: {undoTarget?.participant?.name || "Attendee"}
            </div>
            <div className="text-muted font-mono">
              Reference: {undoTarget?.registrationReference || undoTarget?.ticketId}
            </div>
          </div>

          <div>
            <label htmlFor="undo-reason" className="block text-xs font-bold text-ink uppercase mb-1">
              Reason for Correction <span className="text-gred">*</span>
            </label>
            <textarea
              id="undo-reason"
              rows={3}
              required
              value={undoReason}
              onChange={(e) => setUndoReason(e.target.value)}
              placeholder="e.g. Scanned wrong QR code, student stepped out temporarily..."
              className="w-full px-3 py-2 bg-white border border-ink text-sm focus:outline-hidden focus:ring-2 focus:ring-gblue"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-line">
            <button
              type="button"
              onClick={() => {
                setUndoTarget(null);
                setUndoReason("");
              }}
              disabled={correcting}
              className="px-4 py-2 border border-ink text-sm font-bold text-ink hover:bg-panel"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmUndo}
              disabled={correcting || !undoReason.trim()}
              className="hard-button inline-flex items-center gap-1.5 px-4 py-2 bg-ink text-white text-sm font-bold border-2 border-ink shadow-[2px_2px_0_#202124] disabled:opacity-50"
            >
              {correcting ? "Reverting..." : "Confirm Correction"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
