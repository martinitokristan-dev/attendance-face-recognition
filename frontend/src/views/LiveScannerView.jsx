import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  VideoOff,
  Square,
  Pause,
  Play,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  User,
  ArrowLeft,
  Check,
  XCircle,
  ScanLine,
  RotateCcw
} from 'lucide-react';
import { Api } from '../api';

const BOX_COLOR = {
  scanning: '#ffffff',
  verifying: '#10b981',
  verified: '#10b981',
  error: '#ef4444',
};

const DETECT_CANVAS_W = 256;
const FACE_MODEL_URI = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model/';

export default function LiveScannerView({ user, onNavigate, activeSessionId, onSetHeaderInfo }) {
  const [session, setSession] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [statusText, setStatusText] = useState('Camera off');
  const [statusState, setStatusState] = useState('off'); // 'off' | 'scanning' | 'verifying' | 'success' | 'error' | 'ready'
  const [searchQuery, setSearchQuery] = useState('');
  const [justMarkedId, setJustMarkedId] = useState(null);

  const videoRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const captureCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanTimerRef = useRef(null);
  const animFrameRef = useRef(null);
  const isRecognizingRef = useRef(false);
  const isRequestPendingRef = useRef(false);
  const isPausedRef = useRef(false);

  // Overlay state refs for smooth 60fps face box lerp tracking
  const faceBoxTargetRef = useRef(null);
  const faceBoxSmoothRef = useRef(null);
  const lastFaceSeenRef = useRef(0);
  const overlayStateRef = useRef('idle'); // 'idle' | 'verifying' | 'verified' | 'error'
  const overlayLabelRef = useRef('');
  const verifiedFlashTimerRef = useRef(null);
  const markedStudentIdsRef = useRef(new Set());

  // Client-side local face tracking references
  const faceDetectorNativeRef = useRef(null);
  const faceApiReadyRef = useRef(false);
  const faceApiLoadingRef = useRef(false);
  const detectCanvasRef = useRef(null);
  const detectCtxRef = useRef(null);
  const lastDetectAtRef = useRef(0);

  // Audio Chime on Verification
  const playAttendanceChime = (isLate = false) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      if (!isLate) {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.1);
      } else {
        osc.frequency.setValueAtTime(660, ctx.currentTime);
        osc.frequency.setValueAtTime(550, ctx.currentTime + 0.12);
      }
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch {
      // Audio policy catch
    }
  };

  // Helper to dynamically load face-api script if needed
  const loadScript = (src) => {
    return new Promise((resolve) => {
      if (window.faceapi || document.querySelector(`script[src="${src}"]`)) {
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  };

  // Initialize local high-speed face detection
  const initLocalFaceDetector = async () => {
    if (faceDetectorNativeRef.current || faceApiReadyRef.current) return true;
    if (faceApiLoadingRef.current) return false;
    faceApiLoadingRef.current = true;

    // 1. Native Chrome / Edge FaceDetector API (runs directly on GPU in <3ms)
    if ('FaceDetector' in window && !faceDetectorNativeRef.current) {
      try {
        faceDetectorNativeRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        faceApiLoadingRef.current = false;
        return true;
      } catch (e) {
        console.debug('Native FaceDetector init error:', e);
      }
    }

    // 2. Fallback to @vladmandic/face-api TinyFaceDetector
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/dist/face-api.js');
      if (window.faceapi && !faceApiReadyRef.current) {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODEL_URI);
        faceApiReadyRef.current = true;
      }
    } catch (e) {
      console.debug('face-api init error:', e);
    }

    faceApiLoadingRef.current = false;
    return !!(faceDetectorNativeRef.current || faceApiReadyRef.current);
  };

  // Run fast face detection frame on video element
  const detectLocalFace = async (video) => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    if (faceDetectorNativeRef.current) {
      try {
        const faces = await faceDetectorNativeRef.current.detect(video);
        if (faces && faces.length > 0) {
          const bb = faces[0].boundingBox;
          return { left: bb.x, top: bb.y, right: bb.x + bb.width, bottom: bb.y + bb.height };
        }
      } catch {
        // Fallback
      }
    }

    if (faceApiReadyRef.current && window.faceapi) {
      try {
        if (!detectCanvasRef.current) {
          detectCanvasRef.current = document.createElement('canvas');
          detectCtxRef.current = detectCanvasRef.current.getContext('2d', { willReadFrequently: true });
        }
        const dh = Math.round((DETECT_CANVAS_W * vh) / vw);
        detectCanvasRef.current.width = DETECT_CANVAS_W;
        detectCanvasRef.current.height = dh;
        detectCtxRef.current.drawImage(video, 0, 0, DETECT_CANVAS_W, dh);

        const det = await window.faceapi.detectSingleFace(
          detectCanvasRef.current,
          new window.faceapi.TinyFaceDetectorOptions({ inputSize: 160, scoreThreshold: 0.28 })
        );
        if (det) {
          const sx = vw / DETECT_CANVAS_W;
          const sy = vh / dh;
          const r = det.box;
          return {
            left: r.x * sx,
            top: r.y * sy,
            right: (r.x + r.width) * sx,
            bottom: (r.y + r.height) * sy,
          };
        }
      } catch {
        // Continue
      }
    }
    return null;
  };

  // Initialize Session & Records
  useEffect(() => {
    async function initSession() {
      try {
        setLoading(true);
        const sessions = await Api.getSessions();
        let target = null;
        if (activeSessionId) {
          target = sessions.find((s) => s.id === activeSessionId);
        }
        if (!target) {
          target = sessions.find((s) => s.status === 'open') || sessions[0];
        }

        if (target) {
          const detail = await Api.getSessionDetail(target.id);
          setSession(detail.session);
          const recs = detail.records || [];
          setRecords(recs);

          markedStudentIdsRef.current.clear();
          recs.forEach((r) => {
            if (r.status === 'present' || r.status === 'late') {
              const sid = r.student || r.student_details?.id;
              if (sid) markedStudentIdsRef.current.add(sid);
            }
          });
        }
      } catch (err) {
        console.error('Failed to init live session:', err);
      } finally {
        setLoading(false);
      }
    }
    initSession();

    // Pre-load detector
    initLocalFaceDetector();

    return () => {
      stopCamera();
    };
  }, [activeSessionId]);

  // Header Title & Actions
  useEffect(() => {
    if (onSetHeaderInfo) {
      onSetHeaderInfo({
        title: `Live Attendance${session?.schedule_details?.section_name ? ` – ${session.schedule_details.section_name}` : ''}`,
        subtitle: session
          ? `${session.schedule_details?.subject_code || '—'} | ${session.date} | Room ${session.schedule_details?.room || 'Main Hall'}`
          : 'Live Camera Scanner',
        headerActions: (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => {
                stopCamera();
                onNavigate('sections');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <ArrowLeft size={14} /> <span>Back to Sections</span>
            </button>
            {session && session.status === 'open' && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={async () => {
                  if (confirm('Close this attendance session?')) {
                    await Api.closeSession(session.id);
                    stopCamera();
                    setSession((prev) => ({ ...prev, status: 'closed' }));
                    onNavigate('dashboard');
                  }
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Square size={14} /> <span>Close Session</span>
              </button>
            )}
            {session && session.status === 'closed' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleReopenSession}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} /> <span>Reopen Session</span>
              </button>
            )}
          </div>
        ),
      });
    }
  }, [session?.id, session?.status, onSetHeaderInfo]);

  // Coordinate normalizer & lerp
  function normalizeBox(box) {
    if (!box) return null;
    if (box.left !== undefined) {
      return { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
    }
    if (box.x !== undefined) {
      return { left: box.x, top: box.y, right: box.x + box.w, bottom: box.y + box.h };
    }
    return null;
  }

  function lerpBox(a, b, t) {
    return {
      left: a.left + (b.left - a.left) * t,
      top: a.top + (b.top - a.top) * t,
      right: a.right + (b.right - a.right) * t,
      bottom: a.bottom + (b.bottom - a.bottom) * t,
    };
  }

  function mapBoxToDisplay(box, vw, vh, cw, ch) {
    const videoAR = vw / vh;
    const canvasAR = cw / ch;
    let scale, offsetX, offsetY;
    if (videoAR > canvasAR) {
      scale = ch / vh;
      offsetX = (cw - vw * scale) / 2;
      offsetY = 0;
    } else {
      scale = cw / vw;
      offsetX = 0;
      offsetY = (ch - vh * scale) / 2;
    }
    const rawLeft = box.left * scale + offsetX;
    const rawRight = box.right * scale + offsetX;
    // Mirrored display because video has transform: scaleX(-1)
    const dispLeft = cw - rawRight;
    const dispTop = box.top * scale + offsetY;
    const dispW = Math.max(30, rawRight - rawLeft);
    const dispH = Math.max(30, (box.bottom - box.top) * scale);
    return { left: dispLeft, top: dispTop, width: dispW, height: dispH };
  }

  // Draw enhanced real-time high-tech corner brackets and face frame on canvas
  const drawOverlay = () => {
    const overlay = overlayCanvasRef.current;
    const video = videoRef.current;
    if (!overlay || !video) return;

    const ctx = overlay.getContext('2d');
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cw = overlay.parentElement?.clientWidth || vw;
    const ch = overlay.parentElement?.clientHeight || vh;

    if (overlay.width !== cw || overlay.height !== ch) {
      overlay.width = cw;
      overlay.height = ch;
    }
    ctx.clearRect(0, 0, cw, ch);

    if (!faceBoxSmoothRef.current) return;

    const disp = mapBoxToDisplay(faceBoxSmoothRef.current, vw, vh, cw, ch);
    const state = overlayStateRef.current;
    const isVerified = state === 'verified';
    const isVerifying = state === 'verifying';
    const isError = state === 'error';

    // Solid green for verified & verifying, error red for mismatch/spoof, clean white for idle
    let strokeColor = (isVerified || isVerifying) ? BOX_COLOR.verified : isError ? BOX_COLOR.error : BOX_COLOR.scanning;

    ctx.save();

    // 1. Subtle glow on verified/verifying
    if (isVerifying || isVerified) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 12;
    } else if (isError) {
      ctx.shadowColor = '#ef4444';
      ctx.shadowBlur = 10;
    }

    // 2. Subtle translucent inner tint
    ctx.fillStyle = isVerified
      ? 'rgba(16, 185, 129, 0.08)'
      : isVerifying
      ? 'rgba(16, 185, 129, 0.04)'
      : isError
      ? 'rgba(239, 68, 68, 0.05)'
      : 'rgba(255, 255, 255, 0.02)';
    ctx.fillRect(disp.left, disp.top, disp.width, disp.height);

    // 3. Crisp, non-blinking solid frame border
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(disp.left, disp.top, disp.width, disp.height);

    // 4. Sleek corner bracket reticles
    const bracketLen = Math.min(20, Math.min(disp.width, disp.height) / 4);
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = strokeColor;
    ctx.lineCap = 'round';

    // Top-Left
    ctx.beginPath();
    ctx.moveTo(disp.left, disp.top + bracketLen);
    ctx.lineTo(disp.left, disp.top);
    ctx.lineTo(disp.left + bracketLen, disp.top);
    ctx.stroke();

    // Top-Right
    ctx.beginPath();
    ctx.moveTo(disp.left + disp.width - bracketLen, disp.top);
    ctx.lineTo(disp.left + disp.width, disp.top);
    ctx.lineTo(disp.left + disp.width, disp.top + bracketLen);
    ctx.stroke();

    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(disp.left, disp.top + disp.height - bracketLen);
    ctx.lineTo(disp.left, disp.top + disp.height);
    ctx.lineTo(disp.left + bracketLen, disp.top + disp.height);
    ctx.stroke();

    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(disp.left + disp.width - bracketLen, disp.top + disp.height);
    ctx.lineTo(disp.left + disp.width, disp.top + disp.height);
    ctx.lineTo(disp.left + disp.width, disp.top + disp.height - bracketLen);
    ctx.stroke();

    ctx.restore();

    // 5. Floating Status Pill Label attached above face box
    // Small font size (11px), strictly NO checkmark, NO "Scanning..." text
    const label = overlayLabelRef.current;
    if (label && !label.toLowerCase().includes('scanning')) {
      ctx.font = '600 11px Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
      const textMetrics = ctx.measureText(label);
      const tagW = textMetrics.width + 16;
      const tagH = 21;
      const tagX = Math.max(6, Math.min(disp.left + (disp.width - tagW) / 2, cw - tagW - 6));
      const tagY = disp.top > tagH + 8 ? disp.top - tagH - 6 : disp.top + disp.height + 6;

      ctx.fillStyle = isVerified
        ? 'rgba(6, 78, 59, 0.94)'
        : isVerifying
        ? 'rgba(6, 78, 59, 0.88)'
        : isError
        ? 'rgba(127, 29, 29, 0.94)'
        : 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(tagX, tagY, tagW, tagH, [4]);
      } else {
        ctx.rect(tagX, tagY, tagW, tagH);
      }
      ctx.fill();

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.2;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, tagX + 8, tagY + tagH / 2);
    }
  };

  // 60FPS Smooth Lerp and Real-Time Face Detection Animation Loop
  useEffect(() => {
    let active = true;

    async function renderLoop() {
      if (!active) return;

      const video = videoRef.current;
      if (isCameraActive && video && video.readyState >= 2) {
        // Real-time client-side face detection every ~40ms
        const now = performance.now();
        if (now - lastDetectAtRef.current > 40) {
          lastDetectAtRef.current = now;
          detectLocalFace(video)
            .then((localBox) => {
              if (localBox && active) {
                faceBoxTargetRef.current = localBox;
                lastFaceSeenRef.current = Date.now();
              }
            })
            .catch(() => {});
        }

        // Interpolate Box Position smoothly (no blinking)
        if (faceBoxTargetRef.current && faceBoxSmoothRef.current) {
          faceBoxSmoothRef.current = lerpBox(faceBoxSmoothRef.current, faceBoxTargetRef.current, 0.45);
        } else if (faceBoxTargetRef.current) {
          faceBoxSmoothRef.current = { ...faceBoxTargetRef.current };
        } else if (Date.now() - lastFaceSeenRef.current > 1200) {
          faceBoxSmoothRef.current = null;
        }

        drawOverlay();
      }

      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    if (isCameraActive) {
      animFrameRef.current = requestAnimationFrame(renderLoop);
    }

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isCameraActive]);

  // Handle server recognition response
  const applyRecognition = (data, captureW, captureH) => {
    const video = videoRef.current;
    if (!video) return;
    const vw = video.videoWidth || captureW;
    const vh = video.videoHeight || captureH;

    if (data.recognized && data.recognized.length > 0) {
      const r = data.recognized[0];
      if (r.box) {
        const raw = normalizeBox(r.box);
        if (raw) {
          const sx = vw / captureW;
          const sy = vh / captureH;
          faceBoxTargetRef.current = {
            left: raw.left * sx,
            top: raw.top * sy,
            right: raw.right * sx,
            bottom: raw.bottom * sy,
          };
          lastFaceSeenRef.current = Date.now();
        }
      }

      const sid = r.student_id;
      const isAlreadyPresent = r.already_marked || (sid && markedStudentIdsRef.current.has(sid));

      if (isAlreadyPresent) {
        // Retain verified state without blinking back to white!
        overlayStateRef.current = 'verified';
        overlayLabelRef.current = r.name ? `${r.name} — Present` : 'Present';
        setStatusText(`Already Verified: ${r.name || 'Student'}`);
        setStatusState('success');
        // Rescan after short delay to check for next queued student in line
        scheduleScan(100);
        return;
      }

      if (r.matched) {
        // Verified mark - no checkmark character, clean small font
        overlayStateRef.current = 'verified';
        overlayLabelRef.current = `${r.name} — Present`;
        setStatusText(`Recorded: ${r.name}`);
        setStatusState('success');

        if (sid) markedStudentIdsRef.current.add(sid);

        const targetStatus = r.new_status || 'present';
        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setRecords((prev) =>
          prev.map((rec) => {
            const matchId = rec.student || rec.student_details?.id;
            const matchNum = rec.student_id_number || rec.student_details?.student_id;
            if (matchId === sid || (matchNum && matchNum === r.student_number)) {
              return {
                ...rec,
                status: targetStatus,
                recognized_at: new Date().toISOString(),
                display_time: formattedTime,
              };
            }
            return rec;
          })
        );

        if (sid) {
          setJustMarkedId(sid);
          setTimeout(() => setJustMarkedId(null), 2000);
        }

        playAttendanceChime(targetStatus === 'late');

        // Continuous 1.5s queuing mode: rescan immediately after 40ms so the next student in line (up to 40-50 students) is processed seamlessly!
        scheduleScan(40);
      } else if (r.verifying) {
        overlayStateRef.current = 'verifying';
        overlayLabelRef.current = r.name ? `Verifying ${r.name}...` : 'Verifying...';
        setStatusText(`Verifying: ${r.name || 'Face'}`);
        setStatusState('verifying');
        // Fast followup to complete consensus in ~1.5s
        scheduleScan(60);
      } else if (r.wrong_section) {
        overlayStateRef.current = 'error';
        overlayLabelRef.current = 'Wrong Section';
        setStatusText(`${r.name} — wrong section`);
        setStatusState('error');
        scheduleScan(250);
      } else if (r.liveness_failed) {
        overlayStateRef.current = 'error';
        overlayLabelRef.current = 'Spoof Detected';
        setStatusText('Spoof Detected: Photo/Screen');
        setStatusState('error');
        scheduleScan(250);
      } else if (r.name === 'Unknown') {
        overlayStateRef.current = 'error';
        overlayLabelRef.current = 'Not Enrolled';
        setStatusText('Face not enrolled in this section');
        setStatusState('error');
        scheduleScan(200);
      }
    } else {
      // Only reset when no face has been seen for over 1.2s to prevent flickering/blinking
      if (Date.now() - lastFaceSeenRef.current > 1200) {
        faceBoxTargetRef.current = null;
        overlayStateRef.current = 'idle';
        overlayLabelRef.current = '';
        setStatusText('Camera active');
        setStatusState('ready');
      }
    }
  };

  // Frame Capture and Server Recognition Loop
  const captureAndRecognize = async () => {
    if (!isRecognizingRef.current || isRequestPendingRef.current || isPausedRef.current) return;
    const video = videoRef.current;
    const canvas = captureCanvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;

    const srcW = video.videoWidth || 640;
    const srcH = video.videoHeight || 480;
    const maxDim = 480;
    let targetW = srcW;
    let targetH = srcH;
    if (targetW > maxDim) {
      targetH = Math.round(targetH * (maxDim / targetW));
      targetW = maxDim;
    }

    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, targetW, targetH);
    const frame = canvas.toDataURL('image/jpeg', 0.72);

    isRequestPendingRef.current = true;
    try {
      if (!session?.id) return;
      const res = await Api.recognizeFace(session.id, frame);

      if (res && res.session_closed) {
        stopCamera();
        setSession((prev) => ({ ...prev, status: 'closed' }));
        setStatusText('Session closed');
        setStatusState('off');
        return;
      }

      if (res && res.success) {
        applyRecognition(res, targetW, targetH);
      }
    } catch (err) {
      console.error('Scan recognition error:', err);
    } finally {
      isRequestPendingRef.current = false;
    }
  };

  // Schedule scan with interval
  const scheduleScan = (delayMs = 200) => {
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    if (!isRecognizingRef.current || isPausedRef.current) return;

    scanTimerRef.current = setTimeout(async () => {
      await captureAndRecognize();
      if (isRecognizingRef.current && !isPausedRef.current) {
        scheduleScan(200);
      }
    }, delayMs);
  };

  // Reopen closed session & launch camera
  const handleReopenSession = async () => {
    if (!session?.id) return;
    try {
      setStatusText('Reopening session...');
      setStatusState('ready');
      await Api.reopenSession(session.id);
      setSession((prev) => ({ ...prev, status: 'open', closed_at: null }));
      await startCamera();
    } catch (err) {
      console.error('Failed to reopen session:', err);
      alert(err.message || 'Failed to reopen attendance session.');
      setStatusText('Reopen failed');
      setStatusState('error');
    }
  };

  // Start Camera
  const startCamera = async () => {
    try {
      // If there's no session yet, create one first (this enforces time-window validation)
      if (!session?.id) {
        const scheduleId = activeSessionId; // activeSessionId holds section/schedule id
        if (!scheduleId) {
          alert('No schedule selected. Please go back and select a class schedule to start attendance.');
          return;
        }
        try {
          const newSession = await Api.startSession(scheduleId);
          setSession(newSession);
          // Pre-load student records
          try {
            const detail = await Api.getSessionDetail(newSession.id);
            setRecords(detail.records || []);
            markedStudentIdsRef.current.clear();
            (detail.records || []).forEach((r) => {
              if (r.status === 'present' || r.status === 'late') {
                const sid = r.student || r.student_details?.id;
                if (sid) markedStudentIdsRef.current.add(sid);
              }
            });
          } catch {
            // Records will load lazily
          }
        } catch (err) {
          alert(err.message || 'Cannot start attendance session.');
          return;
        }
      }

      // Auto-reopen session if it was marked closed
      if (session?.id && session.status === 'closed') {
        try {
          await Api.reopenSession(session.id);
          setSession((prev) => ({ ...prev, status: 'open', closed_at: null }));
        } catch (reopenErr) {
          console.warn('Auto-reopen on startCamera failed:', reopenErr);
        }
      }

      setStatusText('Starting camera & detector...');
      setStatusState('ready');
      await initLocalFaceDetector();

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 },
          facingMode: 'user',
          frameRate: { ideal: 30, max: 30 },
        },
      });

      streamRef.current = mediaStream;
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setIsPaused(false);
      isPausedRef.current = false;
      isRecognizingRef.current = true;
      setStatusText('Camera active');
      setStatusState('ready');
      overlayStateRef.current = 'idle';
      overlayLabelRef.current = '';

      scheduleScan(150);
    } catch (err) {
      console.error('Failed to start camera:', err);
      alert('Camera error: ' + err.message);
      setStatusText('Camera error');
      setStatusState('error');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    isRecognizingRef.current = false;
    isRequestPendingRef.current = false;
    if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
    if (verifiedFlashTimerRef.current) clearTimeout(verifiedFlashTimerRef.current);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    faceBoxTargetRef.current = null;
    faceBoxSmoothRef.current = null;
    overlayStateRef.current = 'idle';
    overlayLabelRef.current = '';

    const overlay = overlayCanvasRef.current;
    if (overlay) {
      const ctx = overlay.getContext('2d');
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }

    setIsCameraActive(false);
    setIsPaused(false);
    setStatusText('Camera off');
    setStatusState('off');
  };

  // Toggle Pause / Resume
  const togglePause = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setIsPaused(false);
      setStatusText('Camera active');
      setStatusState('ready');
      scheduleScan(100);
    } else {
      isPausedRef.current = true;
      setIsPaused(true);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      faceBoxTargetRef.current = null;
      faceBoxSmoothRef.current = null;
      overlayStateRef.current = 'scanning';
      overlayLabelRef.current = '';
      const overlay = overlayCanvasRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        ctx.clearRect(0, 0, overlay.width, overlay.height);
      }
      setStatusText('Paused');
      setStatusState('ready');
    }
  };

  // Manual mark attendance for absent students
  const handleManualMark = async (studentId, statusToMark = 'present') => {
    if (!session?.id) return;
    try {
      const res = await Api.markAttendance(session.id, studentId, statusToMark);
      if (res && res.success) {
        markedStudentIdsRef.current.add(studentId);
        const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        setRecords((prev) =>
          prev.map((rec) => {
            const sid = rec.student || rec.student_details?.id;
            if (sid === studentId) {
              return {
                ...rec,
                status: statusToMark,
                recognized_at: new Date().toISOString(),
                display_time: formattedTime,
              };
            }
            return rec;
          })
        );
        playAttendanceChime(statusToMark === 'late');
        setJustMarkedId(studentId);
        setTimeout(() => setJustMarkedId(null), 2500);
        setStatusText(`Recorded: ${res.student_name}`);
        setStatusState('success');
      }
    } catch (err) {
      alert(err.message || 'Failed to manually mark attendance');
    }
  };

  // Filtered Roster
  const filteredRecords = records.filter((r) => {
    const st = r.student_details || r.student_info || (typeof r.student === 'object' ? r.student : {}) || {};
    const name = (r.student_name || (st.user ? `${st.user.first_name || ''} ${st.user.last_name || ''}`.trim() : '')).toLowerCase();
    const idNum = (r.student_id_number || st.student_id || '').toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    return name.includes(q) || idNum.includes(q);
  });

  const presentCount = records.filter((r) => r.status === 'present').length;
  const lateCount = records.filter((r) => r.status === 'late').length;
  const absentCount = records.filter((r) => r.status === 'absent' || !r.status).length;

  const getStatusDotColor = () => {
    switch (statusState) {
      case 'scanning':
      case 'verifying':
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      default:
        return 'var(--text-muted)';
    }
  };

  return (
    <div className="page-content">
      {/* 2-Column Responsive View: Camera on Left, Student Roster on the Right */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.45fr) 400px',
          gap: '20px',
          alignItems: 'stretch',
        }}
      >
        {/* Left: Camera Viewport Panel */}
        <div
          className="card camera-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Camera Card Header */}
          <div
            style={{
              padding: '14px 20px',
              background: 'var(--bg-card)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Camera size={16} style={{ opacity: 0.8 }} /> Live Camera Feed
            </span>

            {/* Status indicator pill with pulse dot */}
            <div
              style={{
                padding: '5px 12px',
                fontSize: '12px',
                borderRadius: '9999px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: getStatusDotColor(),
                  display: 'inline-block',
                }}
              />
              <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>
                {statusText}
              </span>
            </div>
          </div>

          {/* Full-Width 16:9 Viewport */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              flex: 1,
              minHeight: '440px',
              aspectRatio: '16 / 9',
              background: '#090d16',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Mirrored Camera Video */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)',
                display: isCameraActive ? 'block' : 'none',
              }}
            />

            {/* Dynamic Real-Time Bounding Box Canvas Overlay */}
            <canvas
              ref={overlayCanvasRef}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                zIndex: 5,
                display: isCameraActive ? 'block' : 'none',
              }}
            />

            <canvas ref={captureCanvasRef} style={{ display: 'none' }} />

            {/* Standby View */}
            {!isCameraActive && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle at center, #111827 0%, #090d16 100%)',
                  textAlign: 'center',
                  padding: '24px',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '50%',
                    background: session?.status === 'closed' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${session?.status === 'closed' ? 'rgba(245, 158, 11, 0.35)' : 'rgba(255, 255, 255, 0.1)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px',
                  }}
                >
                  {session?.status === 'closed' ? (
                    <RotateCcw size={24} style={{ color: '#f59e0b' }} />
                  ) : (
                    <VideoOff size={24} style={{ color: '#94a3b8' }} />
                  )}
                </div>
                <div style={{ fontSize: '15px', fontWeight: '700', color: '#f1f5f9' }}>
                  {session?.status === 'closed' ? 'Attendance Session Closed' : 'Camera Feed Offline'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', maxWidth: '340px', lineHeight: 1.4 }}>
                  {session?.status === 'closed'
                    ? 'This attendance session is currently closed. Click "Reopen & Start Attendance" to resume live scanning.'
                    : 'Click "Start Camera" to initiate real-time face tracking & attendance verification.'}
                </div>
                {session?.status === 'closed' ? (
                  <button
                    type="button"
                    onClick={handleReopenSession}
                    style={{
                      marginTop: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      fontWeight: '700',
                      fontSize: '13px',
                      borderRadius: 'var(--radius)',
                      background: '#ffffff',
                      color: '#0f172a',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <RotateCcw size={15} style={{ color: '#0f172a' }} />
                    <span>Reopen &amp; Start Attendance</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={startCamera}
                    style={{
                      marginTop: '16px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 22px',
                      fontWeight: '700',
                      fontSize: '13px',
                      borderRadius: 'var(--radius)',
                      background: '#ffffff',
                      color: '#0f172a',
                      border: 'none',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f1f5f9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <Camera size={15} style={{ color: '#0f172a' }} />
                    <span>Start Camera</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Integrated Controls Footer */}
          <div
            style={{
              padding: '12px 18px',
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isCameraActive ? null : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={stopCamera}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                  >
                    <Square size={15} /> <span>Stop Camera</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={togglePause}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {isPaused ? <Play size={15} /> : <Pause size={15} />}
                    <span>{isPaused ? 'Resume Recognition' : 'Pause Recognition'}</span>
                  </button>
                </>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Info size={14} style={{ flexShrink: 0 }} />
              <span>Real-time face tracking • Auto-verifies (~1.5s)</span>
            </div>
          </div>
        </div>

        {/* Right: Attendance Roster List Panel with Prominent Time on the Side */}
        <div
          className="card roster-card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              background: 'var(--bg-card)',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Students ({records.length})
            </span>
            <span className="badge badge-success" style={{ fontSize: '11px', padding: '4px 8px', fontWeight: '700' }}>
              <CheckCircle2 size={12} style={{ marginRight: '4px' }} /> Present: {presentCount + lateCount}
            </span>
          </div>

          {/* Quick Search Input */}
          <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Search size={13} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Quick search student..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  fontSize: '12px',
                  border: '1px solid var(--border)',
                  borderRadius: '6px',
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Scrollable Student List */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              maxHeight: '520px',
            }}
          >
            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                Loading section roster...
              </div>
            ) : filteredRecords.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No students enrolled in this section.
              </div>
            ) : (
              filteredRecords.map((r) => {
                const isPresent = r.status === 'present';
                const isLate = r.status === 'late';
                const isMarked = isPresent || isLate;
                const st = r.student_details || r.student_info || (typeof r.student === 'object' ? r.student : {}) || {};
                const studentName = r.student_name || (st.user ? `${st.user.first_name || ''} ${st.user.last_name || ''}`.trim() : '') || 'Student';
                const studentIdNum = r.student_id_number || st.student_id || '—';
                const studentPk = r.student || st.id;
                const isJustMarked = justMarkedId === studentPk;

                // Time on the side: formatted timestamp or default session time
                const timeStr = r.display_time
                  ? r.display_time
                  : r.recognized_at
                  ? new Date(r.recognized_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                  : isMarked
                  ? 'Class time'
                  : '';

                return (
                  <div
                    key={r.id || studentPk}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: 'var(--radius)',
                      background: isJustMarked
                        ? 'rgba(16, 185, 129, 0.18)'
                        : isPresent
                        ? 'rgba(16, 185, 129, 0.08)'
                        : isLate
                        ? 'rgba(245, 158, 11, 0.08)'
                        : 'var(--bg-card)',
                      border: `1px solid ${
                        isJustMarked
                          ? '#10b981'
                          : isPresent
                          ? 'rgba(16, 185, 129, 0.35)'
                          : isLate
                          ? 'rgba(245, 158, 11, 0.35)'
                          : 'var(--border)'
                      }`,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {/* Student Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: 'var(--bg-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: 'var(--primary)',
                          flexShrink: 0,
                        }}
                      >
                        {(studentName.charAt(0) || 'S').toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: '700',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {studentName}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {studentIdNum}
                        </div>
                      </div>
                    </div>

                    {/* Status & Time on the Side */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                        {isPresent ? (
                          <span
                            className="badge badge-success"
                            style={{ fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <CheckCircle2 size={11} /> Present
                          </span>
                        ) : isLate ? (
                          <span
                            className="badge badge-warning"
                            style={{ fontSize: '10.5px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                          >
                            <Clock size={11} /> Late
                          </span>
                        ) : (
                          <span className="badge badge-muted" style={{ fontSize: '10.5px', fontWeight: '600' }}>
                            Absent
                          </span>
                        )}

                        {/* TIME ON THE SIDE */}
                        {isMarked && (
                          <div
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              color: isPresent ? 'var(--success)' : 'var(--warning)',
                              fontFamily: 'monospace',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <Clock size={10} style={{ opacity: 0.7 }} />
                            <span>{timeStr}</span>
                          </div>
                        )}
                      </div>

                      {/* Manual Mark Actions (shown if absent) */}
                      {!isMarked && (
                        <div style={{ display: 'flex', gap: '3px', marginLeft: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleManualMark(studentPk, 'present')}
                            title="Mark Present"
                            style={{ padding: '3px 6px', color: 'var(--success)', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => handleManualMark(studentPk, 'late')}
                            title="Mark Late"
                            style={{ padding: '3px 6px', color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.4)' }}
                          >
                            <Clock size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary Counters Footer */}
          <div
            style={{
              borderTop: '1px solid var(--border)',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: '6px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: '700',
                color: 'var(--success)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <CheckCircle2 size={13} /> Present: {presentCount}
            </div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: '700',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <Clock size={13} /> Late: {lateCount}
            </div>
            <div
              style={{
                fontSize: '11.5px',
                fontWeight: '700',
                color: 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
            >
              <XCircle size={13} /> Absent: {absentCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
