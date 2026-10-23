/**
 * LIVE AI-PROCTORED SKILL VERIFICATION FRONTEND CONTROLLER
 * 
 * Features:
 * 1. Pre-Test Consent & Camera Permission Check (getUserMedia)
 * 2. Full-Screen Assessment Mode (Fullscreen API with exit tracking & warnings)
 * 3. Tab-Switch & Visibility Detection (document.visibilitychange, blur, focus)
 * 4. Continuous Live Camera Preview PIP with Disconnect Detection
 * 5. Weighted Multi-Stage Assessment:
 *    - MCQs (30%)
 *    - Practical Task (50%)
 *    - AI Follow-Up Questions (20%) generated from practical code solution
 * 6. Non-Misleading Verification Level (Quiz Assessed vs Practically Assessed)
 * 7. Privacy-Conscious: No local footage upload, camera tracks released upon completion
 */

let activeAssessment = null;
let currentQuestionIndex = 0;
let userAnswers = {};

// Proctoring State
let proctoringMediaStream = null;
let proctoringEvents = [];
let fullscreenExitCount = 0;
let visibilityChangeCount = 0;
let windowBlurCount = 0;
let cameraDisconnectCount = 0;
let isAssessmentPaused = false;
let warningToastTimeout = null;
let followUpQuestions = [];
let inFollowUpStage = false;
let currentFollowUpIdx = 0;

// Maximum warning thresholds before pausing test
const MAX_SUSPICIOUS_THRESHOLD = 5;

/**
 * Initiates the proctored assessment flow with Pre-Test Instructions & Consent
 * @param {string} skill - The skill to be evaluated
 */
async function startSkillVerification(skill) {
    const token = localStorage.getItem("token");
    if (!token) {
        showToast("Please log in to take a skill assessment.", "error");
        return;
    }

    // Reset proctoring state
    cleanupProctoringMedia();
    proctoringEvents = [];
    fullscreenExitCount = 0;
    visibilityChangeCount = 0;
    windowBlurCount = 0;
    cameraDisconnectCount = 0;
    isAssessmentPaused = false;
    followUpQuestions = [];
    inFollowUpStage = false;
    currentFollowUpIdx = 0;

    // Show Pre-Test Instructions & Consent Modal
    renderPreTestConsentModal(skill);
}

/**
 * Stage 1: Pre-Test Instructions, Consent, and Camera Permission Check
 */
function renderPreTestConsentModal(skill) {
    let modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (!modalBackdrop) {
        modalBackdrop = document.createElement("div");
        modalBackdrop.id = "assessment-modal-backdrop";
        modalBackdrop.className = "assessment-modal-backdrop";
        document.body.appendChild(modalBackdrop);
    }

    modalBackdrop.innerHTML = `
        <div class="assessment-modal-content" style="max-width:620px;">
            <div class="assessment-modal-header">
                <div>
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="color:var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span>Live AI-Proctored Verification: ${escapeHtml(skill)}</span>
                    </h3>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        Pre-Test Instructions, Monitoring Consent & System Verification
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeAssessmentModal()">✕</button>
            </div>

            <div class="assessment-modal-body">
                <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5; margin-bottom:14px;">
                    To establish genuine peer trust and prevent unauthorized assistance, this assessment operates under live AI-assisted browser proctoring.
                </p>

                <!-- Consent Checklist -->
                <div class="consent-checklist">
                    <div class="consent-checklist-item">
                        <span style="font-size:1.1rem; color:var(--primary);">📷</span>
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">Camera Monitoring:</strong>
                            <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted);">
                                Your webcam preview remains active locally on your screen throughout the test. No footage is stored or uploaded. Camera track must remain connected.
                            </p>
                        </div>
                    </div>
                    <div class="consent-checklist-item">
                        <span style="font-size:1.1rem; color:var(--warning);">🖥️</span>
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">Full-Screen Mode:</strong>
                            <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted);">
                                The test initiates in browser full-screen. Exiting full-screen triggers a warning and logs an event. Repeated exits will pause the test.
                            </p>
                        </div>
                    </div>
                    <div class="consent-checklist-item">
                        <span style="font-size:1.1rem; color:var(--danger);">👁️</span>
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">Tab-Switch & Window Blur Detection:</strong>
                            <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted);">
                                Switching tabs, minimizing windows, or opening external tools is detected and recorded with timestamps.
                            </p>
                        </div>
                    </div>
                    <div class="consent-checklist-item">
                        <span style="font-size:1.1rem; color:var(--success);">⚖️</span>
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">Weighted Assessment Rubric:</strong>
                            <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted);">
                                MCQ Benchmark: 30% • Practical Coding Task: 50% • Dynamic AI Follow-Up: 20%.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Camera Test & Preview Container -->
                <div id="consent-camera-container" style="background:#0f172a; border-radius:var(--radius-md); padding:16px; text-align:center; margin-bottom:16px; border:1px solid #334155;">
                    <div id="consent-cam-placeholder">
                        <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:12px;">Webcam permission required before test initiation.</p>
                        <button type="button" class="btn btn-secondary btn-sm" id="btn-request-cam" onclick="requestProctoringCamera()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            Grant Camera Access & Preview
                        </button>
                    </div>
                    <video id="consent-cam-preview" autoplay playsinline muted style="width:200px; height:150px; object-fit:cover; border-radius:8px; border:2px solid #34d399; display:none; margin:0 auto; transform:scaleX(-1);"></video>
                    <div id="cam-permission-status" style="font-size:0.78rem; margin-top:8px; color:#94a3b8;"></div>
                </div>

                <!-- Explicit Consent Checkbox -->
                <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:0.85rem; color:var(--text-primary); margin-bottom:14px;">
                    <input type="checkbox" id="proctoring-consent-check" style="margin-top:3px; accent-color:var(--primary);" onchange="toggleConsentButton()">
                    <span>I understand the proctoring rules and give explicit consent for camera monitoring and browser visibility tracking during this assessment.</span>
                </label>

                <div class="disclaimer-callout">
                    <strong>Notice:</strong> Browser APIs record environment visibility events, but cannot detect secondary devices. Occasional window blur does not constitute conclusive proof of cheating. All tracks are released on test completion.
                </div>
            </div>

            <div class="assessment-modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeAssessmentModal()">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="btn-begin-proctored-test" disabled style="opacity:0.4; cursor:not-allowed;" onclick="launchProctoredAssessment('${escapeHtml(skill)}')">
                    Enter Full-Screen & Start Assessment
                </button>
            </div>
        </div>
    `;
    modalBackdrop.style.display = "flex";
}

/**
 * Requests camera permission using navigator.mediaDevices.getUserMedia()
 */
async function requestProctoringCamera() {
    const statusEl = document.getElementById("cam-permission-status");
    const placeholder = document.getElementById("consent-cam-placeholder");
    const videoPreview = document.getElementById("consent-cam-preview");

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (statusEl) {
            statusEl.style.color = "#ef4444";
            statusEl.textContent = "Webcam API is not supported in this browser environment.";
        }
        return false;
    }

    try {
        if (statusEl) {
            statusEl.style.color = "#94a3b8";
            statusEl.textContent = "Requesting camera permissions...";
        }

        proctoringMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false
        });

        if (videoPreview) {
            videoPreview.srcObject = proctoringMediaStream;
            videoPreview.style.display = "block";
        }
        if (placeholder) {
            placeholder.style.display = "none";
        }
        if (statusEl) {
            statusEl.style.color = "#34d399";
            statusEl.textContent = "✓ Camera active. Preview verified.";
        }

        // Attach track disconnect handler
        attachCameraDisconnectListener(proctoringMediaStream);

        toggleConsentButton();
        return true;
    } catch (err) {
        console.error("Camera access error:", err);
        if (statusEl) {
            statusEl.style.color = "#ef4444";
            statusEl.innerHTML = `Camera access denied or unavailable: <strong>${escapeHtml(err.message)}</strong>. The proctored assessment cannot start without camera access. <button class="btn btn-secondary btn-sm" style="margin-left:8px; padding:2px 8px; font-size:0.75rem;" onclick="requestProctoringCamera()">Retry</button>`;
        }
        return false;
    }
}

function attachCameraDisconnectListener(stream) {
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => {
        track.onended = () => {
            console.warn("Proctoring camera stream ended!");
            handleCameraDisconnection();
        };
    });
}

function toggleConsentButton() {
    const consentBox = document.getElementById("proctoring-consent-check");
    const beginBtn = document.getElementById("btn-begin-proctored-test");
    const hasCamera = Boolean(proctoringMediaStream && proctoringMediaStream.active);

    if (consentBox && beginBtn) {
        if (consentBox.checked && hasCamera) {
            beginBtn.disabled = false;
            beginBtn.style.opacity = "1";
            beginBtn.style.cursor = "pointer";
        } else {
            beginBtn.disabled = true;
            beginBtn.style.opacity = "0.4";
            beginBtn.style.cursor = "not-allowed";
        }
    }
}

/**
 * Stage 2: Enters Full-screen and fetches backend questions
 */
async function launchProctoredAssessment(skill) {
    const token = localStorage.getItem("token");
    if (!token) return;

    // Request browser full-screen
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            await document.documentElement.webkitRequestFullscreen();
        }
    } catch (fsErr) {
        console.warn("Fullscreen permission note:", fsErr);
    }

    // Attach full-screen & visibility listeners
    setupProctoringEventListeners();

    // Show initial loading state
    showAssessmentLoadingModal(skill);

    try {
        const response = await fetch("/api/assessments/start", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ skill })
        });

        const data = await response.json();

        if (!response.ok) {
            closeAssessmentModal();
            showToast(data.message || "Failed to start assessment.", "error");
            return;
        }

        activeAssessment = data;
        currentQuestionIndex = 0;
        userAnswers = {};

        // Mount PIP live camera preview on DOM
        mountPipCameraPreview();

        renderAssessmentQuestion(0);
    } catch (err) {
        console.error("Assessment start error:", err);
        closeAssessmentModal();
        showToast("Network error. Please try again.", "error");
    }
}

/**
 * Mounts the floating live camera PIP on the bottom-right corner of the assessment
 */
function mountPipCameraPreview() {
    let pip = document.getElementById("proctoring-pip-preview");
    if (!pip) {
        pip = document.createElement("div");
        pip.id = "proctoring-pip-preview";
        pip.className = "proctoring-camera-preview";
        document.body.appendChild(pip);
    }

    pip.innerHTML = `
        <div class="proctoring-camera-badge">
            <span class="pulse-dot"></span>
            <span>LIVE PROCTOR</span>
        </div>
        <video id="proctoring-pip-video" autoplay playsinline muted></video>
    `;

    const pipVideo = document.getElementById("proctoring-pip-video");
    if (pipVideo && proctoringMediaStream) {
        pipVideo.srcObject = proctoringMediaStream;
    }
    pip.style.display = "flex";
}

/**
 * Attaches browser event listeners for full-screen exit, visibilitychange, and window blur
 */
function setupProctoringEventListeners() {
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    document.removeEventListener("visibilitychange", handleVisibilityChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    window.removeEventListener("blur", handleWindowBlur);
    window.addEventListener("blur", handleWindowBlur);
}

function handleFullscreenChange() {
    if (!document.fullscreenElement) {
        fullscreenExitCount++;
        recordProctoringTelemetry("fullscreen_exit", `Exited full-screen mode (count: ${fullscreenExitCount})`);
        showProctoringWarning(`Warning: Full-screen mode was exited (${fullscreenExitCount}x). Please return to full-screen.`);

        if (fullscreenExitCount >= 3) {
            pauseAssessmentDueToProctoring("Assessment Paused: Repeated Full-Screen Exits Detected", "You have exited full-screen mode multiple times. Please resume full-screen to proceed with your verification.");
        }
    }
}

function handleVisibilityChange() {
    if (document.hidden) {
        visibilityChangeCount++;
        recordProctoringTelemetry("visibility_hidden", `Tab switched or hidden (count: ${visibilityChangeCount})`);
        showProctoringWarning(`Warning: Assessment window hidden or tab switched (${visibilityChangeCount}x). Focus required.`);

        if (visibilityChangeCount >= 4) {
            pauseAssessmentDueToProctoring("Assessment Paused: Tab Switching Detected", "The test window became inactive multiple times. Focus must remain on the assessment window.");
        }
    }
}

function handleWindowBlur() {
    windowBlurCount++;
    recordProctoringTelemetry("window_blur", `Window focus lost (count: ${windowBlurCount})`);
}

function handleCameraDisconnection() {
    cameraDisconnectCount++;
    recordProctoringTelemetry("camera_disconnect", `Camera stream interrupted (count: ${cameraDisconnectCount})`);
    showProctoringWarning("Camera disconnected! Your live webcam stream must remain active.");
    pauseAssessmentDueToProctoring("Camera Feed Interrupted", "Your camera feed became unavailable. Please re-enable camera access to resume your assessment.");
}

async function recordProctoringTelemetry(eventType, details) {
    proctoringEvents.push({ type: eventType, timestamp: new Date(), details });
    const token = localStorage.getItem("token");

    if (activeAssessment && activeAssessment.sessionId && token) {
        try {
            await fetch("/api/assessments/proctoring-event", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    sessionId: activeAssessment.sessionId,
                    eventType,
                    details
                })
            });
        } catch (e) {
            console.warn("Telemetry post failed:", e);
        }
    }
}

function showProctoringWarning(msg) {
    let warning = document.getElementById("proctoring-warning-toast");
    if (!warning) {
        warning = document.createElement("div");
        warning.id = "proctoring-warning-toast";
        warning.className = "proctoring-warning-toast";
        document.body.appendChild(warning);
    }

    warning.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span>${escapeHtml(msg)}</span>
    `;
    warning.style.display = "flex";

    if (warningToastTimeout) clearTimeout(warningToastTimeout);
    warningToastTimeout = setTimeout(() => {
        if (warning) warning.style.display = "none";
    }, 4500);
}

function pauseAssessmentDueToProctoring(title, description) {
    isAssessmentPaused = true;
    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (!modalBackdrop) return;

    let overlay = document.getElementById("proctoring-paused-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "proctoring-paused-overlay";
        overlay.className = "proctoring-paused-overlay";
        modalBackdrop.appendChild(overlay);
    }

    overlay.innerHTML = `
        <div style="max-width:440px; background:var(--bg-surface); padding:28px; border-radius:var(--radius-card); border:1px solid var(--border-subtle); color:var(--text-primary); box-shadow:var(--shadow-xl);">
            <div style="width:48px; height:48px; border-radius:50%; background:rgba(239,68,68,0.15); color:var(--danger); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; font-size:1.4rem;">⏸️</div>
            <h3 style="font-size:1.15rem; margin-bottom:8px;">${escapeHtml(title)}</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.5; margin-bottom:18px;">
                ${escapeHtml(description)}
            </p>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button type="button" class="btn btn-primary btn-sm" style="padding:10px; justify-content:center;" onclick="resumeProctoredAssessment()">
                    Re-Verify Status & Resume Test
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="confirmExitAssessment()">
                    Exit Assessment
                </button>
            </div>
        </div>
    `;
    overlay.style.display = "flex";
}

async function resumeProctoredAssessment() {
    // 1. Re-request full screen
    try {
        if (!document.fullscreenElement) {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
            }
        }
    } catch (e) {
        console.warn("Fullscreen retry:", e);
    }

    // 2. Re-verify camera
    if (!proctoringMediaStream || !proctoringMediaStream.active) {
        const camReady = await requestProctoringCamera();
        if (!camReady) {
            showToast("Camera stream is still unavailable. Please allow camera permissions.", "error");
            return;
        }
        mountPipCameraPreview();
    }

    isAssessmentPaused = false;
    const overlay = document.getElementById("proctoring-paused-overlay");
    if (overlay) overlay.remove();

    recordProctoringTelemetry("session_resumed", "Assessment resumed after environmental check");
    showToast("Assessment resumed.", "success");
}

/**
 * Closes modal and releases all camera hardware tracks
 */
function closeAssessmentModal() {
    cleanupProctoringMedia();

    // Exit full-screen if active
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }

    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("blur", handleWindowBlur);

    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (modalBackdrop) modalBackdrop.remove();

    const pip = document.getElementById("proctoring-pip-preview");
    if (pip) pip.remove();

    const warning = document.getElementById("proctoring-warning-toast");
    if (warning) warning.remove();

    activeAssessment = null;
    currentQuestionIndex = 0;
    userAnswers = {};
    followUpQuestions = [];
    inFollowUpStage = false;
}

function cleanupProctoringMedia() {
    if (proctoringMediaStream) {
        proctoringMediaStream.getTracks().forEach(track => {
            track.stop();
        });
        proctoringMediaStream = null;
    }
}

/**
 * Displays initial loading state
 */
function showAssessmentLoadingModal(skill) {
    let modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (!modalBackdrop) {
        modalBackdrop = document.createElement("div");
        modalBackdrop.id = "assessment-modal-backdrop";
        modalBackdrop.className = "assessment-modal-backdrop";
        document.body.appendChild(modalBackdrop);
    }

    modalBackdrop.innerHTML = `
        <div class="assessment-modal-content" style="max-width:480px; text-align:center; padding:36px 24px;">
            <div style="width:52px; height:52px; border:3px solid var(--border-subtle); border-top-color:var(--primary); border-radius:50%; margin:0 auto 20px; animation:spin 0.8s linear infinite;"></div>
            <h3 style="font-size:1.2rem; margin-bottom:8px;">Preparing Proctored Assessment</h3>
            <p class="text-sm text-muted" style="margin-bottom:12px;">
                Calibrating benchmark questions for <strong>${escapeHtml(skill)}</strong> across MCQ (30%), Practical Task (50%), and AI Follow-Up (20%)...
            </p>
            <div style="font-size:0.75rem; color:var(--text-light); background:var(--bg-muted); padding:8px 12px; border-radius:var(--radius-sm);">
                Live AI-Proctored Environment Active
            </div>
        </div>
    `;
    modalBackdrop.style.display = "flex";
}

/**
 * Stage 3: Renders assessment questions (MCQs 1-4, Conceptual 5, Practical 6)
 */
function renderAssessmentQuestion(index) {
    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (!modalBackdrop || !activeAssessment) return;

    const questions = activeAssessment.questions || [];
    const total = questions.length;

    // When all initial questions are answered, transition to dynamic follow-up generation
    if (index >= total) {
        transitionToFollowUpGeneration();
        return;
    }

    currentQuestionIndex = index;
    const q = questions[index];
    const progressPercent = Math.round(((index) / (total + 2)) * 100);

    const difficultyBadgeClass = 
        q.difficulty === "advanced" ? "badge-level-advanced" :
        q.difficulty === "intermediate" ? "badge-level-intermediate" : "badge-level-beginner";

    let inputHtml = "";
    if (q.type === "mcq") {
        inputHtml = `
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:16px;">
                ${(q.options || []).map((opt, optIdx) => {
                    const isChecked = userAnswers[q.id] === optIdx ? "checked" : "";
                    return `
                        <label class="question-option-label" onclick="selectMcqOption(${q.id}, ${optIdx})">
                            <input type="radio" name="q_${q.id}" value="${optIdx}" ${isChecked}>
                            <span style="font-size:0.92rem; font-weight:500;">${escapeHtml(opt)}</span>
                        </label>
                    `;
                }).join("")}
            </div>
        `;
    } else if (q.type === "conceptual") {
        const savedText = userAnswers[q.id] || "";
        inputHtml = `
            <div style="margin-top:16px;">
                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">
                    Your Conceptual Explanation:
                </label>
                <textarea 
                    id="descriptive-answer-input"
                    class="assessment-textarea" 
                    placeholder="Provide a clear technical explanation covering mechanisms, trade-offs, and architecture..."
                    oninput="saveTextAnswer(${q.id}, this.value)"
                >${escapeHtml(savedText)}</textarea>
                <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.75rem; color:var(--text-muted);">
                    <span>Evaluated against core technical benchmarks</span>
                    <span id="char-counter">${savedText.length} characters</span>
                </div>
            </div>
        `;
    } else if (q.type === "practical") {
        const savedCode = userAnswers[q.id] || "";
        inputHtml = `
            <div style="margin-top:16px;">
                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">
                    Practical Code Implementation (Weighted 50%):
                </label>
                <textarea 
                    id="practical-answer-input"
                    class="assessment-textarea assessment-code-textarea" 
                    placeholder="// Write your code or implementation details here&#10;function solution() {&#10;    // ...&#10;}"
                    oninput="saveTextAnswer(${q.id}, this.value)"
                >${escapeHtml(savedCode)}</textarea>
                <div style="display:flex; justify-content:space-between; margin-top:4px; font-size:0.75rem; color:var(--text-muted);">
                    <span>AI follow-up questions will probe this solution</span>
                    <span id="char-counter">${savedCode.length} characters</span>
                </div>
            </div>
        `;
    }

    modalBackdrop.innerHTML = `
        <div class="assessment-modal-content">
            <!-- Proctoring Status Bar -->
            <div class="proctoring-status-bar">
                <span style="display:flex; align-items:center; gap:6px; color:#34d399; font-weight:700;">
                    <span class="pulse-dot" style="display:inline-block;"></span>
                    Live AI Proctoring Active
                </span>
                <div style="display:flex; gap:12px; color:var(--text-muted);">
                    <span>Exits: <strong style="color:var(--text-primary);">${fullscreenExitCount}</strong></span>
                    <span>Tab Changes: <strong style="color:var(--text-primary);">${visibilityChangeCount}</strong></span>
                </div>
            </div>

            <!-- Header -->
            <div class="assessment-modal-header" style="padding-top:0;">
                <div>
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="color:var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span>${escapeHtml(activeAssessment.skill)} Verification</span>
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                        Question ${index + 1} of ${total} • ${escapeHtml(q.category.toUpperCase())}
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" style="padding:4px 8px;" onclick="confirmExitAssessment()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Body -->
            <div class="assessment-modal-body">
                <div class="assessment-progress-bar">
                    <div class="assessment-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>

                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
                    <span class="badge-level ${difficultyBadgeClass}">
                        ${q.difficulty}
                    </span>
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">
                        ${q.type === 'practical' ? 'Practical Task (50% Weight)' : `${q.maxPoints} Points`}
                    </span>
                </div>

                <h4 style="font-size:1.05rem; font-weight:700; line-height:1.45; color:var(--text-primary); margin-bottom:4px;">
                    ${escapeHtml(q.question)}
                </h4>

                ${inputHtml}
            </div>

            <!-- Footer Navigation -->
            <div class="assessment-modal-footer">
                <button 
                    type="button" 
                    class="btn btn-secondary btn-sm" 
                    onclick="renderAssessmentQuestion(${index - 1})"
                    ${index === 0 ? "disabled style='opacity:0.4; cursor:not-allowed;'" : ""}
                >
                    Previous
                </button>

                <button 
                    type="button" 
                    class="btn btn-primary btn-sm" 
                    onclick="nextQuestion(${index})"
                >
                    ${index === total - 1 ? "Proceed to AI Follow-Up Questions →" : "Next Question →"}
                </button>
            </div>
        </div>
    `;
}

function selectMcqOption(qId, optIdx) {
    userAnswers[qId] = optIdx;
    const labels = document.querySelectorAll(".question-option-label");
    labels.forEach((label, idx) => {
        const radio = label.querySelector("input[type='radio']");
        if (radio) {
            radio.checked = (idx === optIdx);
        }
    });
}

function saveTextAnswer(qId, text) {
    userAnswers[qId] = text;
    const counter = document.getElementById("char-counter");
    if (counter) {
        counter.textContent = `${text.length} characters`;
    }
}

function nextQuestion(currentIndex) {
    const questions = activeAssessment.questions || [];
    const currentQ = questions[currentIndex];

    if (userAnswers[currentQ.id] === undefined || userAnswers[currentQ.id] === "") {
        if (!confirm("You haven't answered this question yet. Would you like to proceed anyway?")) {
            return;
        }
    }

    renderAssessmentQuestion(currentIndex + 1);
}

/**
 * Stage 4: Transitions to generate dynamic follow-up questions from the practical solution
 */
async function transitionToFollowUpGeneration() {
    const token = localStorage.getItem("token");
    const practicalSolution = userAnswers[6] || "";

    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (modalBackdrop) {
        modalBackdrop.innerHTML = `
            <div class="assessment-modal-content" style="max-width:500px; text-align:center; padding:40px 24px;">
                <div style="width:52px; height:52px; border:3px solid var(--border-subtle); border-top-color:var(--primary); border-radius:50%; margin:0 auto 20px; animation:spin 0.8s linear infinite;"></div>
                <h3 style="font-size:1.2rem; margin-bottom:8px;">Generating AI Follow-Up Questions</h3>
                <p class="text-sm text-muted" style="margin-bottom:12px;">
                    Analyzing your practical code solution to formulate 2 tailored follow-up technical questions (Weighted 20%)...
                </p>
            </div>
        `;
    }

    try {
        const response = await fetch("/api/assessments/generate-followup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId: activeAssessment.sessionId,
                practicalSolution
            })
        });

        const data = await response.json();
        followUpQuestions = data.questions || [];
        inFollowUpStage = true;
        currentFollowUpIdx = 0;

        renderFollowUpQuestion(0);
    } catch (err) {
        console.error("Follow-up error:", err);
        // Fallback to default follow-up questions
        followUpQuestions = [
            { id: 101, topic: "Implementation Rationale", question: `Walk through how your code manages memory/scope and runtime complexity in ${activeAssessment.skill}.`, maxPoints: 10 },
            { id: 102, topic: "Edge Cases", question: `What boundary conditions or exceptions could break your code, and how did you mitigate them?`, maxPoints: 10 }
        ];
        inFollowUpStage = true;
        renderFollowUpQuestion(0);
    }
}

function renderFollowUpQuestion(idx) {
    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (!modalBackdrop) return;

    if (idx >= followUpQuestions.length) {
        submitFullProctoredAssessment();
        return;
    }

    currentFollowUpIdx = idx;
    const fq = followUpQuestions[idx];
    const savedText = userAnswers[fq.id] || "";
    const isLast = idx === followUpQuestions.length - 1;

    modalBackdrop.innerHTML = `
        <div class="assessment-modal-content">
            <div class="proctoring-status-bar">
                <span style="display:flex; align-items:center; gap:6px; color:#34d399; font-weight:700;">
                    <span class="pulse-dot"></span>
                    Live AI Proctoring Active
                </span>
                <div style="display:flex; gap:12px; color:var(--text-muted);">
                    <span>Exits: <strong style="color:var(--text-primary);">${fullscreenExitCount}</strong></span>
                    <span>Tab Changes: <strong style="color:var(--text-primary);">${visibilityChangeCount}</strong></span>
                </div>
            </div>

            <div class="assessment-modal-header" style="padding-top:0;">
                <div>
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" style="color:var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span>AI Follow-Up Question ${idx + 1} of 2</span>
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                        Topic: ${escapeHtml(fq.topic)} • Weighted 20% Total
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="confirmExitAssessment()">✕</button>
            </div>

            <div class="assessment-modal-body">
                <h4 style="font-size:1.05rem; font-weight:700; line-height:1.45; color:var(--text-primary); margin-bottom:12px;">
                    ${escapeHtml(fq.question)}
                </h4>

                <label style="font-size:0.85rem; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:6px;">
                    Your Technical Explanation:
                </label>
                <textarea 
                    class="assessment-textarea" 
                    placeholder="Explain your design decisions, algorithmic considerations, and edge-case handling..."
                    oninput="saveTextAnswer(${fq.id}, this.value)"
                >${escapeHtml(savedText)}</textarea>

                <div class="disclaimer-callout">
                    <strong>Integrity Probe:</strong> This follow-up verifies your conceptual command of the practical solution submitted in the previous step.
                </div>
            </div>

            <div class="assessment-modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="renderFollowUpQuestion(${idx - 1})" ${idx === 0 ? "disabled style='opacity:0.4;'" : ""}>
                    Previous
                </button>
                <button type="button" class="btn btn-primary btn-sm" onclick="${isLast ? "submitFullProctoredAssessment()" : `renderFollowUpQuestion(${idx + 1})`}">
                    ${isLast ? "Submit & Finalize Proctored Assessment" : "Next Follow-Up Question →"}
                </button>
            </div>
        </div>
    `;
}

function confirmExitAssessment() {
    if (confirm("Are you sure you want to exit? Your progress will be discarded and no verification badge will be awarded.")) {
        closeAssessmentModal();
    }
}

/**
 * Stage 5: Submits answers & proctoring summary for weighted evaluation
 */
async function submitFullProctoredAssessment() {
    if (!activeAssessment) return;
    const token = localStorage.getItem("token");

    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (modalBackdrop) {
        modalBackdrop.innerHTML = `
            <div class="assessment-modal-content" style="max-width:480px; text-align:center; padding:40px 24px;">
                <div style="width:52px; height:52px; border:3px solid var(--border-subtle); border-top-color:var(--primary); border-radius:50%; margin:0 auto 20px; animation:spin 0.8s linear infinite;"></div>
                <h3 style="font-size:1.2rem; margin-bottom:8px;">Evaluating Proctored Submission</h3>
                <p class="text-sm text-muted" style="margin-bottom:12px;">
                    Calculating weighted score: MCQ (30%), Practical Task (50%), and AI Follow-Up (20%), and verifying proctoring telemetry...
                </p>
                <div style="font-size:0.75rem; color:var(--text-light); background:var(--bg-muted); padding:8px 12px; border-radius:var(--radius-sm);">
                    Weighted Server-Side Validation
                </div>
            </div>
        `;
    }

    try {
        const proctoringSummary = {
            consentGiven: true,
            fullscreenExitCount,
            visibilityChangeCount,
            windowBlurCount,
            cameraDisconnectCount
        };

        const response = await fetch("/api/assessments/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                sessionId: activeAssessment.sessionId,
                answers: userAnswers,
                proctoringSummary
            })
        });

        const data = await response.json();

        // Release camera and exit full screen
        cleanupProctoringMedia();
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        const pip = document.getElementById("proctoring-pip-preview");
        if (pip) pip.remove();

        if (!response.ok) {
            closeAssessmentModal();
            showToast(data.message || "Assessment evaluation failed.", "error");
            return;
        }

        renderProctoredResultsModal(data.assessment);

        // Update local user profile cache
        const currentUser = getCurrentUser();
        if (currentUser) {
            currentUser.verifiedSkills = (currentUser.verifiedSkills || []).filter(
                s => s.skill.toLowerCase() !== data.assessment.skill.toLowerCase()
            );
            currentUser.verifiedSkills.push({
                skill: data.assessment.skill,
                score: data.assessment.score,
                estimatedLevel: data.assessment.estimatedLevel,
                verificationLevel: data.assessment.verificationLevel || "Practically Assessed",
                assessmentId: data.assessment._id,
                verifiedAt: new Date()
            });
            localStorage.setItem("currentUser", JSON.stringify(currentUser));
        }

        if (typeof initDashboard === "function") {
            initDashboard();
        }
    } catch (err) {
        console.error("Submit error:", err);
        closeAssessmentModal();
        showToast("Error communicating with evaluation server.", "error");
    }
}

/**
 * Stage 6: Displays results card with weighted breakdown, verification level, and proctoring log
 */
function renderProctoredResultsModal(assessment) {
    const modalBackdrop = document.getElementById("assessment-modal-backdrop");
    if (!modalBackdrop) return;

    const scoreColor = assessment.score >= 80 ? "var(--success)" : assessment.score >= 55 ? "var(--accent-sky)" : "var(--warning)";
    const dateFormatted = new Date(assessment.completedAt || Date.now()).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });

    const isFlagged = assessment.status === "flagged_for_review";
    const proctoring = assessment.proctoring || {};
    const breakdown = assessment.breakdown || {};

    const strengthsList = (assessment.strengths && assessment.strengths.length > 0)
        ? assessment.strengths.map(s => `<li style="margin-bottom:4px;">${escapeHtml(s)}</li>`).join("")
        : "<li>Demonstrated practical coding competence and verified MCQ baseline</li>";

    const improvementsList = (assessment.areasForImprovement && assessment.areasForImprovement.length > 0)
        ? assessment.areasForImprovement.map(i => `<li style="margin-bottom:4px;">${escapeHtml(i)}</li>`).join("")
        : "<li>Expand coverage of extreme edge-case boundaries in production</li>";

    modalBackdrop.innerHTML = `
        <div class="assessment-modal-content" style="max-width:640px;">
            <div class="assessment-modal-header">
                <div>
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="color:var(--success);"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                        <span>Proctored Assessment Results</span>
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                        Live AI-Proctored Evidence Verification
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeAssessmentModal()">✕</button>
            </div>

            <div class="assessment-modal-body">
                <!-- Score Header Banner -->
                <div style="text-align:center; padding:20px; background:var(--bg-muted); border-radius:var(--radius-md); margin-bottom:16px;">
                    <div style="font-size:0.85rem; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-muted); margin-bottom:6px;">
                        ${escapeHtml(assessment.skill)} Verification Result
                    </div>
                    <div style="font-size:3rem; font-weight:800; color:${scoreColor}; line-height:1; margin-bottom:6px;">
                        ${assessment.score}<span style="font-size:1.2rem; font-weight:600; color:var(--text-muted);">/100</span>
                    </div>
                    <div style="display:inline-flex; align-items:center; gap:8px; margin-top:6px; flex-wrap:wrap; justify-content:center;">
                        <span class="badge-verification-level badge-practical-level">
                            ${assessment.verificationLevel || "Practically Assessed"}
                        </span>
                        <span class="badge-level badge-level-${assessment.estimatedLevel.toLowerCase()}">
                            ${assessment.estimatedLevel}
                        </span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">• Assessed ${dateFormatted}</span>
                    </div>
                </div>

                <!-- Weighted Scoring Breakdown -->
                <h5 style="font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:8px;">Weighted Scoring Breakdown:</h5>
                <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:10px; margin-bottom:16px; text-align:center;">
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); padding:10px; border-radius:var(--radius-sm);">
                        <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">MCQ (30%)</div>
                        <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:2px;">
                            ${breakdown.mcqScore !== undefined ? breakdown.mcqScore : 0}/30
                        </div>
                    </div>
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); padding:10px; border-radius:var(--radius-sm);">
                        <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">Practical Task (50%)</div>
                        <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:2px;">
                            ${breakdown.practicalScore !== undefined ? breakdown.practicalScore : 0}/50
                        </div>
                    </div>
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); padding:10px; border-radius:var(--radius-sm);">
                        <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; font-weight:600;">AI Follow-Up (20%)</div>
                        <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary); margin-top:2px;">
                            ${breakdown.followUpScore !== undefined ? breakdown.followUpScore : 0}/20
                        </div>
                    </div>
                </div>

                <!-- Proctoring Telemetry Summary -->
                <div style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:16px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary);">Proctoring Summary:</span>
                        ${isFlagged 
                            ? `<span style="font-size:0.75rem; color:var(--danger); font-weight:700;">Flagged for Review</span>`
                            : `<span style="font-size:0.75rem; color:var(--success); font-weight:700;">Clean Attempt ✓</span>`
                        }
                    </div>
                    <div style="display:flex; gap:14px; font-size:0.78rem; color:var(--text-muted); margin-top:6px;">
                        <span>Full-Screen Exits: <strong>${proctoring.fullscreenExitCount || 0}</strong></span>
                        <span>Visibility Changes: <strong>${proctoring.visibilityChangeCount || 0}</strong></span>
                        <span>Camera Drops: <strong>${proctoring.cameraDisconnectCount || 0}</strong></span>
                    </div>
                    ${proctoring.flagReason ? `
                        <div style="font-size:0.75rem; color:var(--danger); margin-top:6px; background:rgba(239,68,68,0.08); padding:6px; border-radius:4px;">
                            ${escapeHtml(proctoring.flagReason)}
                        </div>
                    ` : ""}
                </div>

                <!-- Strengths & Growth Areas -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px;">
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px;">
                        <h6 style="font-size:0.8rem; font-weight:700; color:var(--success); margin-bottom:6px;">Key Strengths</h6>
                        <ul style="padding-left:16px; margin:0; font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">
                            ${strengthsList}
                        </ul>
                    </div>
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px;">
                        <h6 style="font-size:0.8rem; font-weight:700; color:var(--primary); margin-bottom:6px;">Areas for Growth</h6>
                        <ul style="padding-left:16px; margin:0; font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">
                            ${improvementsList}
                        </ul>
                    </div>
                </div>

                <div class="disclaimer-callout">
                    <strong>Notice:</strong> This assessment awards the <strong>"${assessment.verificationLevel}"</strong> badge based on weighted objective benchmarks, practical solution review, and dynamic follow-up checks. It is an indicative measure of technical knowledge and does not guarantee professional accreditation.
                </div>
            </div>

            <div class="assessment-modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeAssessmentModal()">Close</button>
                <button type="button" class="btn btn-primary btn-sm" onclick="closeAssessmentModal(); location.reload();">
                    View Updated Profile Badges
                </button>
            </div>
        </div>
    `;
}

// Global Exports
window.startSkillVerification = startSkillVerification;
window.requestProctoringCamera = requestProctoringCamera;
window.toggleConsentButton = toggleConsentButton;
window.launchProctoredAssessment = launchProctoredAssessment;
window.resumeProctoredAssessment = resumeProctoredAssessment;
window.closeAssessmentModal = closeAssessmentModal;
window.selectMcqOption = selectMcqOption;
window.saveTextAnswer = saveTextAnswer;
window.nextQuestion = nextQuestion;
window.confirmExitAssessment = confirmExitAssessment;
window.submitFullProctoredAssessment = submitFullProctoredAssessment;
