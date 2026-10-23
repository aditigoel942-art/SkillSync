/**
 * AI LEARNING IMPACT ANALYZER - LIVE AI-PROCTORED CONTROLLER
 * 
 * Upgrades both Pre-Session and Post-Session assessments with the exact proctoring workflow:
 * 1. Pre-Test Instructions & Explicit Consent Screen
 * 2. Camera Access Request (navigator.mediaDevices.getUserMedia) with Live Camera Preview
 * 3. Full-Screen Assessment Mode (Fullscreen API with exit tracking & warnings)
 * 4. Tab-Switch & Visibility Monitoring (document.visibilitychange, window.blur/focus)
 * 5. Camera Disconnect & Stream End Detection
 * 6. Live PIP Camera Feed during assessment
 * 7. Server-Side Validated Scoring & Proctoring Telemetry
 * 8. Comprehensive Learning Impact Report with Proctoring Badges & Provisional Review Flags
 */

let activeImpactTest = null;
let currentImpactQuestionIdx = 0;
let impactAnswers = {};

// Proctoring State for Learning Impact tests
let impactMediaStream = null;
let impactProctoringEvents = [];
let impactFullscreenExitCount = 0;
let impactVisibilityChangeCount = 0;
let impactWindowBlurCount = 0;
let impactCameraDisconnectCount = 0;
let isImpactAssessmentPaused = false;
let impactWarningToastTimeout = null;

/**
 * Checks session impact status and renders pre/post banners in live session / modal
 * @param {string} sessionId
 */
async function checkLiveSessionImpact(sessionId) {
    const token = localStorage.getItem("token");
    if (!token || !sessionId) return;

    try {
        const res = await fetch(`/api/learning-impact/session/${sessionId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        if (!res.ok) return;

        const data = await res.json();
        renderSessionImpactUI(sessionId, data);
    } catch (err) {
        console.warn("Could not check learning impact status:", err);
    }
}

/**
 * Injects pre-assessment notice into live session or post-session modal
 */
function renderSessionImpactUI(sessionId, data) {
    const isLearner = data.isLearner;
    const impact = data.impact || {};
    const preCompleted = impact.preAssessment && impact.preAssessment.completed;
    const postCompleted = impact.postAssessment && impact.postAssessment.completed;

    // 1. If in live session and pre-assessment not taken yet
    if (!preCompleted && data.sessionStatus === "live") {
        let banner = document.getElementById("pre-assessment-banner");
        if (!banner) {
            banner = document.createElement("div");
            banner.id = "pre-assessment-banner";
            banner.style.cssText = "background: linear-gradient(135deg, #1e1b4b, #312e81); border: 1px solid #4338ca; border-radius: 12px; padding: 12px 16px; margin: 12px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #e0e7ff; z-index: 100;";
            const header = document.querySelector(".session-header");
            if (header && header.nextSibling) {
                header.parentNode.insertBefore(banner, header.nextSibling);
            }
        }

        banner.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px;">
                <div style="width:34px; height:34px; border-radius:50%; background:rgba(99,102,241,0.3); display:flex; align-items:center; justify-content:center; font-size:1.1rem;">📊</div>
                <div>
                    <strong style="font-size:0.9rem; color:#fff; display:block;">AI-Proctored Learning Impact Analyzer</strong>
                    <span style="font-size:0.78rem; color:#c7d2fe;">Take a proctored baseline assessment (MCQ + Practical) for ${escapeHtml(data.skill)}.</span>
                </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="startLearningImpactProctoredFlow('${sessionId}', 'pre', '${escapeHtml(data.skill)}')" style="white-space:nowrap; padding:6px 14px; font-size:0.82rem;">
                Take Proctored Pre-Assessment
            </button>
        `;
    } else if (preCompleted) {
        const banner = document.getElementById("pre-assessment-banner");
        if (banner) {
            const preProctor = impact.preAssessment.proctoring || {};
            const proctorBadge = preProctor.isFlaggedForReview 
                ? `<span style="color:#f87171; font-weight:700;">(Flagged for Review)</span>` 
                : `<span style="color:#34d399; font-weight:700;">(Proctored ✓)</span>`;

            banner.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="color:#34d399; font-size:1.1rem;">✓</span>
                    <span style="font-size:0.82rem; color:#a7f3d0;">
                        Pre-assessment baseline recorded: <strong>${impact.preAssessment.score}/100</strong> ${proctorBadge}. Complete this session to unlock your proctored post-assessment.
                    </span>
                </div>
            `;
            banner.style.background = "rgba(6, 78, 59, 0.4)";
            banner.style.border = "1px solid rgba(16, 185, 129, 0.3)";
        }
    }

    // 2. Inject Post-Assessment & Impact Report triggers into Session Ended Modal
    const sessionEndedModal = document.getElementById("session-ended-modal");
    if (sessionEndedModal) {
        let impactSection = document.getElementById("session-impact-ended-section");
        if (!impactSection) {
            impactSection = document.createElement("div");
            impactSection.id = "session-impact-ended-section";
            impactSection.style.cssText = "background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 14px; margin-bottom: 16px; text-align: left;";
            const reviewSection = document.getElementById("session-review-section");
            if (reviewSection) {
                reviewSection.parentNode.insertBefore(impactSection, reviewSection);
            }
        }

        if (preCompleted && !postCompleted) {
            impactSection.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                    <div style="font-size:1.2rem;">📈</div>
                    <div>
                        <h4 style="font-size:0.95rem; color:#fff; margin:0;">AI-Proctored Post-Session Assessment</h4>
                        <p style="font-size:0.78rem; color:#94a3b8; margin:2px 0 0;">Measure demonstrated growth against your pre-test baseline (${impact.preAssessment.score}/100) under matching proctoring standards.</p>
                    </div>
                </div>
                <button type="button" class="btn btn-primary btn-sm" style="width:100%; padding:9px; justify-content:center; margin-top:8px;" onclick="startLearningImpactProctoredFlow('${sessionId}', 'post', '${escapeHtml(data.skill)}')">
                    Start Proctored Post-Assessment & View Report
                </button>
            `;
        } else if (preCompleted && postCompleted) {
            const analysis = impact.impactAnalysis || {};
            const change = analysis.percentagePointChange || 0;
            const changeColor = change >= 0 ? "#34d399" : "#f87171";
            const changeSign = change > 0 ? "+" : "";
            const isProvisional = analysis.isProvisional || analysis.status === "provisional_review";

            impactSection.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:10px;">
                    <div>
                        <span style="font-weight:700; font-size:0.92rem; color:#f8fafc;">Proctored Learning Impact</span>
                        ${isProvisional ? `<span style="font-size:0.7rem; color:#f87171; background:rgba(239,68,68,0.15); padding:1px 6px; border-radius:4px; margin-left:6px;">Provisional</span>` : ""}
                    </div>
                    <span style="font-weight:800; font-size:1rem; color:${changeColor}; background:rgba(255,255,255,0.06); padding:2px 8px; border-radius:999px;">
                        ${changeSign}${change} pts
                    </span>
                </div>
                <div style="display:flex; gap:8px; font-size:0.8rem; color:#cbd5e1; margin-bottom:10px;">
                    <div style="flex:1; background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; text-align:center;">
                        <span style="color:#94a3b8; font-size:0.7rem; display:block;">PRE-SESSION</span>
                        <strong>${analysis.preScore}/100</strong>
                    </div>
                    <div style="flex:1; background:rgba(0,0,0,0.25); padding:8px; border-radius:6px; text-align:center;">
                        <span style="color:#94a3b8; font-size:0.7rem; display:block;">POST-SESSION</span>
                        <strong>${analysis.postScore}/100</strong>
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" style="width:100%; padding:8px; justify-content:center;" onclick="viewFullImpactReport('${sessionId}')">
                    View Full Proctored Impact Report & Exercises
                </button>
            `;
        }
    }
}

/**
 * Step 1: Displays Pre-Test Instructions, Consent Screen, and Camera Permission Check
 * Works identically for both "pre" and "post" stages.
 */
function startLearningImpactProctoredFlow(sessionId, stage, skill) {
    const token = localStorage.getItem("token");
    if (!token) {
        showToast("Please log in to continue.", "error");
        return;
    }

    // Reset impact proctoring state
    cleanupImpactProctoringMedia();
    impactProctoringEvents = [];
    impactFullscreenExitCount = 0;
    impactVisibilityChangeCount = 0;
    impactWindowBlurCount = 0;
    impactCameraDisconnectCount = 0;
    isImpactAssessmentPaused = false;

    renderImpactConsentModal(sessionId, stage, skill || "Technical Skill");
}

function renderImpactConsentModal(sessionId, stage, skill) {
    let modalBackdrop = document.getElementById("impact-modal-backdrop");
    if (!modalBackdrop) {
        modalBackdrop = document.createElement("div");
        modalBackdrop.id = "impact-modal-backdrop";
        modalBackdrop.className = "assessment-modal-backdrop";
        document.body.appendChild(modalBackdrop);
    }

    const stageTitle = stage === "pre" ? "Pre-Session Baseline Assessment" : "Post-Session Mastery Assessment";
    const stageExplanation = stage === "pre"
        ? "This baseline assessment establishes your starting comprehension level prior to the live exchange."
        : "This post-session assessment measures demonstrated skill acquisition covering the exact same objectives at matched difficulty.";

    modalBackdrop.innerHTML = `
        <div class="assessment-modal-content" style="max-width:620px;">
            <div class="assessment-modal-header">
                <div>
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="color:var(--primary);"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                        <span>${escapeHtml(stageTitle)}</span>
                    </h3>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        Live AI-Proctored Learning Impact Evaluation • ${escapeHtml(skill)}
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeImpactModal()">✕</button>
            </div>

            <div class="assessment-modal-body">
                <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5; margin-bottom:14px;">
                    ${escapeHtml(stageExplanation)} To ensure fair and reliable score comparison, both assessments operate under matching live browser proctoring standards.
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
                                The test initiates in browser full-screen. Exiting full-screen logs an event. Repeated exits will pause the assessment.
                            </p>
                        </div>
                    </div>
                    <div class="consent-checklist-item">
                        <span style="font-size:1.1rem; color:var(--danger);">👁️</span>
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">Tab-Switch & Window Visibility Detection:</strong>
                            <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted);">
                                Tab switches and page visibility losses are recorded with timestamps to protect report validity.
                            </p>
                        </div>
                    </div>
                    <div class="consent-checklist-item">
                        <span style="font-size:1.1rem; color:var(--success);">⚖️</span>
                        <div>
                            <strong style="color:var(--text-primary); font-size:0.85rem;">Objective & Semantic Rubric:</strong>
                            <p style="margin:2px 0 0; font-size:0.78rem; color:var(--text-muted);">
                                Questions span foundational principles, implementation mechanics, conceptual depth, and practical tasks on a 0–100 scale.
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Camera Test & Preview Container -->
                <div id="impact-consent-camera-container" style="background:#0f172a; border-radius:var(--radius-md); padding:16px; text-align:center; margin-bottom:16px; border:1px solid #334155;">
                    <div id="impact-consent-cam-placeholder">
                        <p style="color:#94a3b8; font-size:0.85rem; margin-bottom:12px;">Webcam permission required before test initiation.</p>
                        <button type="button" class="btn btn-secondary btn-sm" onclick="requestImpactProctoringCamera()">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                            Grant Camera Access & Preview
                        </button>
                    </div>
                    <video id="impact-consent-cam-preview" autoplay playsinline muted style="width:200px; height:150px; object-fit:cover; border-radius:8px; border:2px solid #34d399; display:none; margin:0 auto; transform:scaleX(-1);"></video>
                    <div id="impact-cam-permission-status" style="font-size:0.78rem; margin-top:8px; color:#94a3b8;"></div>
                </div>

                <!-- Explicit Consent Checkbox -->
                <label style="display:flex; align-items:flex-start; gap:10px; cursor:pointer; font-size:0.85rem; color:var(--text-primary); margin-bottom:14px;">
                    <input type="checkbox" id="impact-proctoring-consent-check" style="margin-top:3px; accent-color:var(--primary);" onchange="toggleImpactConsentButton()">
                    <span>I understand the proctoring rules and give explicit consent for camera monitoring and browser visibility tracking during this ${stage}-session assessment.</span>
                </label>

                <div class="disclaimer-callout">
                    <strong>Notice:</strong> Browser telemetry logs visibility status without recording video footage. Occasional window blur does not constitute conclusive proof of cheating. All tracks are released on test completion.
                </div>
            </div>

            <div class="assessment-modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeImpactModal()">Cancel</button>
                <button type="button" class="btn btn-primary btn-sm" id="btn-begin-impact-test" disabled style="opacity:0.4; cursor:not-allowed;" onclick="launchProctoredImpactAssessment('${sessionId}', '${stage}')">
                    Enter Full-Screen & Start ${stage === 'pre' ? 'Pre-Test' : 'Post-Test'}
                </button>
            </div>
        </div>
    `;
    modalBackdrop.style.display = "flex";
}

/**
 * Requests camera permission for learning impact test
 */
async function requestImpactProctoringCamera() {
    const statusEl = document.getElementById("impact-cam-permission-status");
    const placeholder = document.getElementById("impact-consent-cam-placeholder");
    const videoPreview = document.getElementById("impact-consent-cam-preview");

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

        impactMediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
            audio: false
        });

        if (videoPreview) {
            videoPreview.srcObject = impactMediaStream;
            videoPreview.style.display = "block";
        }
        if (placeholder) {
            placeholder.style.display = "none";
        }
        if (statusEl) {
            statusEl.style.color = "#34d399";
            statusEl.textContent = "✓ Camera active. Preview verified.";
        }

        attachImpactCameraDisconnectListener(impactMediaStream);
        toggleImpactConsentButton();
        return true;
    } catch (err) {
        console.error("Camera access error:", err);
        if (statusEl) {
            statusEl.style.color = "#ef4444";
            statusEl.innerHTML = `Camera access denied or unavailable: <strong>${escapeHtml(err.message)}</strong>. The proctored assessment cannot start without camera access. <button class="btn btn-secondary btn-sm" style="margin-left:8px; padding:2px 8px; font-size:0.75rem;" onclick="requestImpactProctoringCamera()">Retry</button>`;
        }
        return false;
    }
}

function attachImpactCameraDisconnectListener(stream) {
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(track => {
        track.onended = () => {
            console.warn("Learning impact camera stream ended!");
            handleImpactCameraDisconnection();
        };
    });
}

function toggleImpactConsentButton() {
    const consentBox = document.getElementById("impact-proctoring-consent-check");
    const beginBtn = document.getElementById("btn-begin-impact-test");
    const hasCamera = Boolean(impactMediaStream && impactMediaStream.active);

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
 * Step 2: Enters full-screen, initializes active test session, mounts PIP camera, and loads questions
 */
async function launchProctoredImpactAssessment(sessionId, stage) {
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

    setupImpactProctoringEventListeners();
    showImpactLoadingModal(stage);

    try {
        const response = await fetch("/api/learning-impact/start", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ sessionId, stage })
        });

        const data = await response.json();

        if (!response.ok) {
            closeImpactModal();
            showToast(data.message || "Failed to start assessment.", "error");
            return;
        }

        activeImpactTest = data;
        currentImpactQuestionIdx = 0;
        impactAnswers = {};

        // Mount floating PIP camera preview
        mountImpactPipCameraPreview();

        renderImpactQuestion(0);
    } catch (err) {
        console.error("Impact test start error:", err);
        closeImpactModal();
        showToast("Network error. Please try again.", "error");
    }
}

function mountImpactPipCameraPreview() {
    let pip = document.getElementById("impact-pip-preview");
    if (!pip) {
        pip = document.createElement("div");
        pip.id = "impact-pip-preview";
        pip.className = "proctoring-camera-preview";
        document.body.appendChild(pip);
    }

    pip.innerHTML = `
        <div class="proctoring-camera-badge">
            <span class="pulse-dot"></span>
            <span>LIVE PROCTOR</span>
        </div>
        <video id="impact-pip-video" autoplay playsinline muted></video>
    `;

    const pipVideo = document.getElementById("impact-pip-video");
    if (pipVideo && impactMediaStream) {
        pipVideo.srcObject = impactMediaStream;
    }
    pip.style.display = "flex";
}

function setupImpactProctoringEventListeners() {
    document.removeEventListener("fullscreenchange", handleImpactFullscreenChange);
    document.addEventListener("fullscreenchange", handleImpactFullscreenChange);

    document.removeEventListener("visibilitychange", handleImpactVisibilityChange);
    document.addEventListener("visibilitychange", handleImpactVisibilityChange);

    window.removeEventListener("blur", handleImpactWindowBlur);
    window.addEventListener("blur", handleImpactWindowBlur);
}

function handleImpactFullscreenChange() {
    if (!document.fullscreenElement) {
        impactFullscreenExitCount++;
        recordImpactTelemetry("fullscreen_exit", `Exited full-screen mode (count: ${impactFullscreenExitCount})`);
        showImpactWarning(`Warning: Full-screen mode was exited (${impactFullscreenExitCount}x). Return to full-screen.`);

        if (impactFullscreenExitCount >= 3) {
            pauseImpactAssessmentDueToProctoring(
                "Assessment Paused: Repeated Full-Screen Exits Detected",
                "You have exited full-screen mode multiple times. Please resume full-screen to proceed with your assessment."
            );
        }
    }
}

function handleImpactVisibilityChange() {
    if (document.hidden) {
        impactVisibilityChangeCount++;
        recordImpactTelemetry("visibility_hidden", `Tab switched or hidden (count: ${impactVisibilityChangeCount})`);
        showImpactWarning(`Warning: Assessment window hidden or tab switched (${impactVisibilityChangeCount}x). Focus required.`);

        if (impactVisibilityChangeCount >= 4) {
            pauseImpactAssessmentDueToProctoring(
                "Assessment Paused: Tab Switching Detected",
                "The test window became inactive multiple times. Focus must remain on the assessment window."
            );
        }
    }
}

function handleImpactWindowBlur() {
    impactWindowBlurCount++;
    recordImpactTelemetry("window_blur", `Window focus lost (count: ${impactWindowBlurCount})`);
}

function handleImpactCameraDisconnection() {
    impactCameraDisconnectCount++;
    recordImpactTelemetry("camera_disconnect", `Camera stream interrupted (count: ${impactCameraDisconnectCount})`);
    showImpactWarning("Camera disconnected! Your live webcam stream must remain active.");
    pauseImpactAssessmentDueToProctoring(
        "Camera Feed Interrupted",
        "Your camera feed became unavailable. Please re-enable camera access to resume your assessment."
    );
}

async function recordImpactTelemetry(eventType, details) {
    impactProctoringEvents.push({ type: eventType, timestamp: new Date(), details });
    const token = localStorage.getItem("token");

    if (activeImpactTest && activeImpactTest.token && token) {
        try {
            await fetch("/api/learning-impact/proctoring-event", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    token: activeImpactTest.token,
                    eventType,
                    details
                })
            });
        } catch (e) {
            console.warn("Impact telemetry post failed:", e);
        }
    }
}

function showImpactWarning(msg) {
    let warning = document.getElementById("impact-warning-toast");
    if (!warning) {
        warning = document.createElement("div");
        warning.id = "impact-warning-toast";
        warning.className = "proctoring-warning-toast";
        document.body.appendChild(warning);
    }

    warning.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
        <span>${escapeHtml(msg)}</span>
    `;
    warning.style.display = "flex";

    if (impactWarningToastTimeout) clearTimeout(impactWarningToastTimeout);
    impactWarningToastTimeout = setTimeout(() => {
        if (warning) warning.style.display = "none";
    }, 4500);
}

function pauseImpactAssessmentDueToProctoring(title, description) {
    isImpactAssessmentPaused = true;
    const modalBackdrop = document.getElementById("impact-modal-backdrop");
    if (!modalBackdrop) return;

    let overlay = document.getElementById("impact-paused-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "impact-paused-overlay";
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
                <button type="button" class="btn btn-primary btn-sm" style="padding:10px; justify-content:center;" onclick="resumeImpactProctoredAssessment()">
                    Re-Verify Status & Resume Test
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="confirmExitImpactAssessment()">
                    Exit Assessment
                </button>
            </div>
        </div>
    `;
    overlay.style.display = "flex";
}

async function resumeImpactProctoredAssessment() {
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
    if (!impactMediaStream || !impactMediaStream.active) {
        const camReady = await requestImpactProctoringCamera();
        if (!camReady) {
            showToast("Camera stream is still unavailable. Please allow camera permissions.", "error");
            return;
        }
        mountImpactPipCameraPreview();
    }

    isImpactAssessmentPaused = false;
    const overlay = document.getElementById("impact-paused-overlay");
    if (overlay) overlay.remove();

    recordImpactTelemetry("session_resumed", "Learning impact assessment resumed after environmental check");
    showToast("Assessment resumed.", "success");
}

function confirmExitImpactAssessment() {
    if (confirm("Are you sure you want to exit? Your progress will be discarded.")) {
        closeImpactModal();
    }
}

function showImpactLoadingModal(stage) {
    let modal = document.getElementById("impact-modal-backdrop");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "impact-modal-backdrop";
        modal.className = "assessment-modal-backdrop";
        document.body.appendChild(modal);
    }

    const title = stage === "pre" ? "Preparing Proctored Pre-Session Baseline" : "Generating Proctored Post-Session Test";

    modal.innerHTML = `
        <div class="assessment-modal-content" style="max-width:480px; text-align:center; padding:36px 24px;">
            <div style="width:48px; height:48px; border:3px solid var(--border-subtle); border-top-color:var(--primary); border-radius:50%; margin:0 auto 16px; animation:spin 0.8s linear infinite;"></div>
            <h3 style="font-size:1.15rem; margin-bottom:8px;">${title}</h3>
            <p class="text-sm text-muted" style="margin-bottom:12px;">
                Aligning evaluation metrics with session learning objectives under live proctoring...
            </p>
        </div>
    `;
    modal.style.display = "flex";
}

function closeImpactModal() {
    cleanupImpactProctoringMedia();

    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }

    document.removeEventListener("fullscreenchange", handleImpactFullscreenChange);
    document.removeEventListener("visibilitychange", handleImpactVisibilityChange);
    window.removeEventListener("blur", handleImpactWindowBlur);

    const modal = document.getElementById("impact-modal-backdrop");
    if (modal) modal.remove();

    const pip = document.getElementById("impact-pip-preview");
    if (pip) pip.remove();

    const warning = document.getElementById("impact-warning-toast");
    if (warning) warning.remove();

    activeImpactTest = null;
    currentImpactQuestionIdx = 0;
    impactAnswers = {};
}

function cleanupImpactProctoringMedia() {
    if (impactMediaStream) {
        impactMediaStream.getTracks().forEach(track => track.stop());
        impactMediaStream = null;
    }
}

/**
 * Step 3: Renders question at index with live proctoring status bar and PIP preview
 */
function renderImpactQuestion(idx) {
    const modal = document.getElementById("impact-modal-backdrop");
    if (!modal || !activeImpactTest) return;

    const questions = activeImpactTest.questions || [];
    const total = questions.length;
    if (idx >= total) {
        submitImpactTest();
        return;
    }

    currentImpactQuestionIdx = idx;
    const q = questions[idx];
    const progress = Math.round((idx / total) * 100);

    let inputHtml = "";
    if (q.type === "mcq") {
        inputHtml = `
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:14px;">
                ${(q.options || []).map((opt, optIdx) => `
                    <label class="question-option-label" onclick="selectImpactMcq(${q.id}, ${optIdx})">
                        <input type="radio" name="impact_q_${q.id}" value="${optIdx}" ${impactAnswers[q.id] === optIdx ? "checked" : ""}>
                        <span style="font-size:0.92rem;">${escapeHtml(opt)}</span>
                    </label>
                `).join("")}
            </div>
        `;
    } else {
        const isPractical = q.type === "practical";
        const val = impactAnswers[q.id] || "";
        inputHtml = `
            <div style="margin-top:14px;">
                <textarea 
                    class="assessment-textarea ${isPractical ? "assessment-code-textarea" : ""}" 
                    placeholder="${isPractical ? "// Write your implementation here..." : "Provide your conceptual explanation..."}"
                    oninput="saveImpactText(${q.id}, this.value)"
                >${escapeHtml(val)}</textarea>
            </div>
        `;
    }

    const isLast = idx === total - 1;

    modal.innerHTML = `
        <div class="assessment-modal-content">
            <!-- Proctoring Status Bar -->
            <div class="proctoring-status-bar">
                <span style="display:flex; align-items:center; gap:6px; color:#34d399; font-weight:700;">
                    <span class="pulse-dot" style="display:inline-block;"></span>
                    Live AI Proctoring Active (${activeImpactTest.stage.toUpperCase()}-TEST)
                </span>
                <div style="display:flex; gap:12px; color:var(--text-muted);">
                    <span>Exits: <strong style="color:var(--text-primary);">${impactFullscreenExitCount}</strong></span>
                    <span>Tab Changes: <strong style="color:var(--text-primary);">${impactVisibilityChangeCount}</strong></span>
                </div>
            </div>

            <!-- Header -->
            <div class="assessment-modal-header" style="padding-top:0;">
                <div>
                    <h3>
                        <span>${escapeHtml(activeImpactTest.title)}</span>
                    </h3>
                    <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
                        Question ${idx + 1} of ${total} • Topic: ${escapeHtml(q.topic)}
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="confirmExitImpactAssessment()">✕</button>
            </div>

            <!-- Body -->
            <div class="assessment-modal-body">
                <div class="assessment-progress-bar">
                    <div class="assessment-progress-fill" style="width: ${progress}%;"></div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                    <span class="badge-level badge-level-intermediate">${escapeHtml(q.topic)}</span>
                    <span style="font-size:0.8rem; font-weight:700; color:var(--text-muted);">${q.maxPoints} Pts</span>
                </div>

                <h4 style="font-size:1.05rem; font-weight:700; line-height:1.4; color:var(--text-primary);">
                    ${escapeHtml(q.question)}
                </h4>

                ${inputHtml}
            </div>

            <!-- Navigation -->
            <div class="assessment-modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="renderImpactQuestion(${idx - 1})" ${idx === 0 ? "disabled style='opacity:0.4;'" : ""}>
                    Previous
                </button>
                <button type="button" class="btn btn-primary btn-sm" onclick="${isLast ? "submitImpactTest()" : `renderImpactQuestion(${idx + 1})`}">
                    ${isLast ? "Submit Proctored Assessment" : "Next Question →"}
                </button>
            </div>
        </div>
    `;
}

function selectImpactMcq(qId, optIdx) {
    impactAnswers[qId] = optIdx;
    const labels = document.querySelectorAll(".question-option-label");
    labels.forEach((l, idx) => {
        const r = l.querySelector("input[type='radio']");
        if (r) r.checked = (idx === optIdx);
    });
}

function saveImpactText(qId, text) {
    impactAnswers[qId] = text;
}

/**
 * Step 4: Submits answers & proctoring telemetry for server-side evaluation
 */
async function submitImpactTest() {
    if (!activeImpactTest) return;
    const token = localStorage.getItem("token");

    const modal = document.getElementById("impact-modal-backdrop");
    if (modal) {
        modal.innerHTML = `
            <div class="assessment-modal-content" style="max-width:480px; text-align:center; padding:36px 24px;">
                <div style="width:48px; height:48px; border:3px solid var(--border-subtle); border-top-color:var(--primary); border-radius:50%; margin:0 auto 16px; animation:spin 0.8s linear infinite;"></div>
                <h3 style="font-size:1.15rem; margin-bottom:8px;">Analyzing Proctored Results</h3>
                <p class="text-sm text-muted">Evaluating benchmark criteria, topic-wise learning delta, and proctoring telemetry...</p>
            </div>
        `;
    }

    try {
        const proctoringSummary = {
            consentGiven: true,
            fullscreenExitCount: impactFullscreenExitCount,
            visibilityChangeCount: impactVisibilityChangeCount,
            windowBlurCount: impactWindowBlurCount,
            cameraDisconnectCount: impactCameraDisconnectCount
        };

        const response = await fetch("/api/learning-impact/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                token: activeImpactTest.token,
                answers: impactAnswers,
                proctoringSummary
            })
        });

        const data = await response.json();

        // Release hardware and exit full screen
        cleanupImpactProctoringMedia();
        if (document.fullscreenElement && document.exitFullscreen) {
            document.exitFullscreen().catch(() => {});
        }
        const pip = document.getElementById("impact-pip-preview");
        if (pip) pip.remove();

        if (!response.ok) {
            closeImpactModal();
            showToast(data.message || "Submission failed", "error");
            return;
        }

        if (data.stage === "pre") {
            const preProctor = data.impact && data.impact.preAssessment ? data.impact.preAssessment.proctoring : {};
            const flagNotice = preProctor && preProctor.isFlaggedForReview ? " (Flagged for review)" : "";
            showToast(`Pre-assessment score: ${data.score}/100 recorded${flagNotice}!`, "success");
            closeImpactModal();
            checkLiveSessionImpact(activeImpactTest.sessionId);
        } else {
            renderImpactReportModal(data.impact);
        }
    } catch (err) {
        console.error("Submit impact error:", err);
        closeImpactModal();
        showToast("Error saving assessment", "error");
    }
}

/**
 * Step 5: Displays full Comparative Learning Impact Report with proctoring statuses & provisional review notice
 */
async function viewFullImpactReport(sessionId) {
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
        const res = await fetch(`/api/learning-impact/session/${sessionId}`, {
            headers: { "Authorization": `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.impact) {
            renderImpactReportModal(data.impact);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderImpactReportModal(impact) {
    let modal = document.getElementById("impact-modal-backdrop");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "impact-modal-backdrop";
        modal.className = "assessment-modal-backdrop";
        document.body.appendChild(modal);
    }

    const analysis = impact.impactAnalysis || {};
    const change = analysis.percentagePointChange || 0;
    const changeColor = change >= 0 ? "var(--success)" : "var(--danger)";
    const changeSign = change > 0 ? "+" : "";

    const preProctor = (impact.preAssessment && impact.preAssessment.proctoring) || {};
    const postProctor = (impact.postAssessment && impact.postAssessment.proctoring) || {};
    const isProvisional = Boolean(analysis.isProvisional || analysis.status === "provisional_review");

    const topicRows = (analysis.topicResults || []).map(t => {
        const statusBadge = t.status === "Mastered"
            ? `<span class="badge-level badge-level-advanced" style="font-size:0.7rem;">Mastered</span>`
            : t.status === "Improved"
            ? `<span class="badge-level badge-level-intermediate" style="font-size:0.7rem;">Improved</span>`
            : `<span class="badge-level badge-level-beginner" style="font-size:0.7rem;">Needs Practice</span>`;

        return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); margin-bottom:8px;">
                <div>
                    <strong style="font-size:0.88rem; color:var(--text-primary); display:block;">${escapeHtml(t.topic)}</strong>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Baseline: ${t.preScore}% → Post: ${t.postScore}%</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:700; font-size:0.85rem; color:${t.change >= 0 ? 'var(--success)' : 'var(--danger)'};">
                        ${t.change > 0 ? '+' : ''}${t.change}%
                    </span>
                    ${statusBadge}
                </div>
            </div>
        `;
    }).join("");

    const strengthsList = (analysis.demonstratedStrengths || []).map(s => `<li>${escapeHtml(s)}</li>`).join("") || "<li>Established baseline comprehension</li>";
    const practiceList = (analysis.topicsNeedingPractice || []).map(p => `<li>${escapeHtml(p)}</li>`).join("") || "<li>No major deficiencies identified</li>";
    const exerciseList = (analysis.recommendedNextExercises || []).map(e => `<li>${escapeHtml(e)}</li>`).join("");

    modal.innerHTML = `
        <div class="assessment-modal-content" style="max-width:680px;">
            <div class="assessment-modal-header">
                <div>
                    <h3>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" style="color:var(--primary);"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
                        <span>AI-Proctored Learning Impact Report</span>
                    </h3>
                    <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
                        ${escapeHtml(impact.skill)} • Dual-Proctored Session Delta Analysis
                    </div>
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeImpactModal()">✕</button>
            </div>

            <div class="assessment-modal-body">
                <!-- Provisional Review Alert (if flagged) -->
                ${isProvisional ? `
                    <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.3); border-radius:var(--radius-sm); padding:12px; margin-bottom:16px;">
                        <div style="display:flex; align-items:center; gap:6px; color:var(--danger); font-weight:700; font-size:0.85rem; margin-bottom:4px;">
                            <span>⚠️ Provisional Report — Manual Review Pending</span>
                        </div>
                        <p style="font-size:0.8rem; color:var(--text-secondary); margin:0; line-height:1.4;">
                            ${escapeHtml(analysis.reviewNotice || "Proctoring interruptions were recorded during testing. This report is preserved for review and reflects provisional learning gains.")}
                        </p>
                    </div>
                ` : ""}

                <!-- Score Cards -->
                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:16px; text-align:center;">
                    <div style="background:var(--bg-muted); padding:14px; border-radius:var(--radius-md);">
                        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Pre-Session</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${analysis.preScore}/100</div>
                        <div style="font-size:0.7rem; color:${preProctor.isFlaggedForReview ? 'var(--danger)' : 'var(--success)'}; font-weight:600; margin-top:2px;">
                            ${preProctor.isFlaggedForReview ? "Flagged for Review" : "Proctored Attempt ✓"}
                        </div>
                    </div>
                    <div style="background:var(--bg-muted); padding:14px; border-radius:var(--radius-md);">
                        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Post-Session</div>
                        <div style="font-size:1.8rem; font-weight:800; color:var(--text-primary); margin-top:2px;">${analysis.postScore}/100</div>
                        <div style="font-size:0.7rem; color:${postProctor.isFlaggedForReview ? 'var(--danger)' : 'var(--success)'}; font-weight:600; margin-top:2px;">
                            ${postProctor.isFlaggedForReview ? "Flagged for Review" : "Proctored Attempt ✓"}
                        </div>
                    </div>
                    <div style="background:var(--bg-muted); padding:14px; border-radius:var(--radius-md);">
                        <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; font-weight:700;">Net Delta</div>
                        <div style="font-size:1.8rem; font-weight:800; color:${changeColor}; margin-top:2px;">${changeSign}${change} pts</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:2px;">Verified Delta</div>
                    </div>
                </div>

                <!-- Dual Proctoring Audit Summary -->
                <div style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-sm); padding:12px 14px; margin-bottom:16px;">
                    <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary); display:block; margin-bottom:6px;">
                        Proctoring Telemetry Audit
                    </span>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.78rem; color:var(--text-muted);">
                        <div>
                            <strong>Pre-Test:</strong> Exits: ${preProctor.fullscreenExitCount || 0} • Tabs: ${preProctor.visibilityChangeCount || 0} • Camera drops: ${preProctor.cameraDisconnectCount || 0}
                        </div>
                        <div>
                            <strong>Post-Test:</strong> Exits: ${postProctor.fullscreenExitCount || 0} • Tabs: ${postProctor.visibilityChangeCount || 0} • Camera drops: ${postProctor.cameraDisconnectCount || 0}
                        </div>
                    </div>
                </div>

                <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.5; margin-bottom:18px;">
                    ${escapeHtml(analysis.growthSummary || "")}
                </p>

                <!-- Topic Breakdown -->
                <h5 style="font-size:0.9rem; font-weight:700; margin-bottom:8px; color:var(--text-primary);">Topic-Wise Results</h5>
                <div style="margin-bottom:18px;">${topicRows}</div>

                <!-- Strengths vs Practice -->
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:18px;">
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); padding:12px; border-radius:var(--radius-sm);">
                        <h6 style="font-size:0.82rem; font-weight:700; color:var(--success); margin-bottom:6px;">Demonstrated Strengths</h6>
                        <ul style="padding-left:16px; margin:0; font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">
                            ${strengthsList}
                        </ul>
                    </div>
                    <div style="background:var(--bg-page); border:1px solid var(--border-subtle); padding:12px; border-radius:var(--radius-sm);">
                        <h6 style="font-size:0.82rem; font-weight:700; color:var(--primary); margin-bottom:6px;">Topics Needing Practice</h6>
                        <ul style="padding-left:16px; margin:0; font-size:0.78rem; color:var(--text-secondary); line-height:1.4;">
                            ${practiceList}
                        </ul>
                    </div>
                </div>

                <!-- Recommended Next Exercises -->
                <div style="background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.25); border-radius:var(--radius-sm); padding:12px; margin-bottom:14px;">
                    <h6 style="font-size:0.85rem; font-weight:700; color:var(--primary); margin-bottom:6px;">Recommended Next Exercises</h6>
                    <ul style="padding-left:16px; margin:0; font-size:0.8rem; color:var(--text-secondary); line-height:1.4;">
                        ${exerciseList}
                    </ul>
                </div>

                <div class="disclaimer-callout">
                    ${escapeHtml(analysis.reliabilityDisclaimer || "")}
                </div>
            </div>

            <div class="assessment-modal-footer">
                <button type="button" class="btn btn-secondary btn-sm" onclick="closeImpactModal()">Close</button>
            </div>
        </div>
    `;
    modal.style.display = "flex";
}

// Global exports
window.checkLiveSessionImpact = checkLiveSessionImpact;
window.startLearningImpactTest = (sessionId, stage) => startLearningImpactProctoredFlow(sessionId, stage, "Technical Skill");
window.startLearningImpactProctoredFlow = startLearningImpactProctoredFlow;
window.requestImpactProctoringCamera = requestImpactProctoringCamera;
window.toggleImpactConsentButton = toggleImpactConsentButton;
window.launchProctoredImpactAssessment = launchProctoredImpactAssessment;
window.resumeImpactProctoredAssessment = resumeImpactProctoredAssessment;
window.confirmExitImpactAssessment = confirmExitImpactAssessment;
window.viewFullImpactReport = viewFullImpactReport;
window.closeImpactModal = closeImpactModal;
window.selectImpactMcq = selectImpactMcq;
window.saveImpactText = saveImpactText;
window.submitImpactTest = submitImpactTest;
