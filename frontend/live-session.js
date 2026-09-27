// SkillSwap Live Skill Session Client Logic (WebRTC + Socket.IO)

let socket = null;
let currentUser = null;
let authToken = null;
let sessionId = null;
let sessionData = null;
let partnerUser = null;

let localStream = null;
let peerConnection = null;
let screenStream = null;
let isScreenSharing = false;

let isAudioMuted = false;
let isVideoStopped = false;

let timerInterval = null;
let timerSeconds = 0;
let iceCandidatesQueue = [];

// Standard public STUN servers for WebRTC NAT traversal
const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
    ]
};

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Validate Authentication
    const userStr = localStorage.getItem("currentUser");
    authToken = localStorage.getItem("token");

    if (!userStr || !authToken) {
        alert("Please login to join the Live Skill Session.");
        window.location.href = "login.html";
        return;
    }

    try {
        currentUser = JSON.parse(userStr);
    } catch (e) {
        window.location.href = "login.html";
        return;
    }

    // 2. Validate Session ID in URL parameters
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get("sessionId");

    if (!sessionId) {
        alert("Session ID is missing.");
        window.location.href = "connections.html";
        return;
    }

    // 3. Setup UI Controls
    setupControlButtons();

    // 4. Fetch session details and authorization
    const authorized = await loadSessionDetails();
    if (!authorized) return;

    // 5. Request User Camera & Microphone
    const mediaReady = await initLocalMedia();
    if (!mediaReady) return;

    // 6. Connect to Socket.IO signaling server
    initSignalingSocket();
});

// Load session details and verify user belongs to the session
async function loadSessionDetails() {
    try {
        const response = await fetch(`http://localhost:5000/api/live-sessions/${sessionId}`, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (response.status === 403 || response.status === 401) {
            alert("Unauthorized: You do not belong to this live session.");
            window.location.href = "connections.html";
            return false;
        }

        if (!response.ok) {
            throw new Error("Live session not found");
        }

        sessionData = await response.json();

        if (sessionData.status === "completed" || sessionData.status === "cancelled") {
            showSessionEndedModal("This live session has already concluded.");
            return false;
        }

        const isHost = sessionData.host._id === currentUser._id;
        partnerUser = isHost ? sessionData.participant : sessionData.host;

        // Populate session info in UI
        const myTeach = (currentUser.teachSkills || []).slice(0, 2).join(", ");
        const partnerTeach = (partnerUser.teachSkills || []).slice(0, 2).join(", ");
        document.getElementById("session-topic").textContent = `${partnerUser.name} (${partnerTeach || 'Skills'}) ⇄ ${currentUser.name} (${myTeach || 'Skills'})`;

        document.getElementById("local-name").textContent = currentUser.name + " (You)";
        document.getElementById("local-label-name").textContent = currentUser.name + " (You)";
        document.getElementById("local-avatar").textContent = getInitials(currentUser.name);

        document.getElementById("remote-name").textContent = partnerUser.name;
        document.getElementById("remote-label-name").textContent = partnerUser.name;
        document.getElementById("remote-avatar").textContent = getInitials(partnerUser.name);
        document.getElementById("remote-status-msg").textContent = `Waiting for ${partnerUser.name} to join...`;

        return true;
    } catch (err) {
        console.error("Error loading session:", err);
        showAlert("Failed to load session details: " + err.message);
        setTimeout(() => window.location.href = "connections.html", 3000);
        return false;
    }
}

// Request camera and microphone access
async function initLocalMedia() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true
            }
        });

        localStream = stream;
        const localVideo = document.getElementById("local-video");
        localVideo.srcObject = stream;

        // Hide permission modal if open
        document.getElementById("permission-modal").classList.add("hidden");
        return true;
    } catch (err) {
        console.error("Error acquiring camera/microphone:", err);
        document.getElementById("permission-modal").classList.remove("hidden");
        return false;
    }
}

// Setup Socket.IO signaling connection
function initSignalingSocket() {
    updateConnStatus("Connecting to signaling server...", "connecting");

    socket = io("http://localhost:5000", {
        auth: { token: authToken },
        reconnection: true,
        reconnectionAttempts: 10
    });

    socket.on("connect", () => {
        console.log("🟢 Connected to signaling server as:", currentUser.name);
        updateConnStatus("Signaling connected. Joining room...", "connecting");

        // Join live session room
        socket.emit("joinSession", { sessionId }, (res) => {
            if (res && res.success) {
                console.log("Joined live session room:", sessionId);
                updateConnStatus("Ready • Waiting for peer", "waiting");
                initPeerConnection();
            } else {
                showAlert("Error joining session: " + (res?.message || "Unknown error"));
            }
        });
    });

    socket.on("connect_error", (err) => {
        console.warn("Signaling socket error:", err.message);
        updateConnStatus("Signaling server disconnected", "error");
    });

    // Remote peer joined: Initiator creates WebRTC Offer
    socket.on("sessionUserJoined", async ({ userId, userName }) => {
        console.log("👋 Remote user joined session:", userName, userId);
        updateConnStatus("Partner joined • Connecting video...", "connecting");
        document.getElementById("remote-status-msg").textContent = `Connecting with ${userName}...`;

        // Ensure peer connection is ready
        if (!peerConnection) {
            initPeerConnection();
        }

        // Create and send offer
        try {
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);

            socket.emit("webrtcOffer", {
                sessionId,
                offer: peerConnection.localDescription,
                targetUserId: userId
            });
            console.log("📤 Sent WebRTC Offer to:", userName);
        } catch (err) {
            console.error("Error creating WebRTC offer:", err);
        }
    });

    // Received WebRTC Offer: Peer sets remote description and responds with Answer
    socket.on("webrtcOffer", async ({ offer, senderId, senderName }) => {
        console.log("📥 Received WebRTC Offer from:", senderName);
        updateConnStatus("Received call offer • Answering...", "connecting");

        if (!peerConnection) {
            initPeerConnection();
        }

        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            // Drain any buffered ICE candidates
            while (iceCandidatesQueue.length > 0) {
                const candidate = iceCandidatesQueue.shift();
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            }

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            socket.emit("webrtcAnswer", {
                sessionId,
                answer: peerConnection.localDescription,
                targetUserId: senderId
            });
            console.log("📤 Sent WebRTC Answer");
        } catch (err) {
            console.error("Error handling WebRTC offer:", err);
        }
    });

    // Received WebRTC Answer: Initiator completes handshake
    socket.on("webrtcAnswer", async ({ answer }) => {
        console.log("📥 Received WebRTC Answer");
        try {
            if (peerConnection) {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));

                // Drain any buffered ICE candidates
                while (iceCandidatesQueue.length > 0) {
                    const candidate = iceCandidatesQueue.shift();
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
        } catch (err) {
            console.error("Error setting remote description from answer:", err);
        }
    });

    // Received ICE candidate
    socket.on("iceCandidate", async ({ candidate }) => {
        try {
            if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
                iceCandidatesQueue.push(candidate);
            }
        } catch (err) {
            console.warn("Error adding ICE candidate:", err);
        }
    });

    // Remote peer toggled audio or video
    socket.on("userMediaToggled", ({ userId, type, enabled }) => {
        if (type === "audio") {
            const micIcon = document.getElementById("remote-mic-status");
            if (micIcon) {
                micIcon.textContent = enabled ? "🎤" : "🔇";
                micIcon.title = enabled ? "Mic Active" : "Mic Muted";
            }
        } else if (type === "video") {
            const camIcon = document.getElementById("remote-cam-status");
            const remotePlaceholder = document.getElementById("remote-placeholder");
            const remoteVideo = document.getElementById("remote-video");

            if (camIcon) {
                camIcon.textContent = enabled ? "📷" : "🚫";
                camIcon.title = enabled ? "Camera Active" : "Camera Off";
            }
            if (!enabled) {
                remotePlaceholder.classList.remove("hidden");
                document.getElementById("remote-status-msg").textContent = `${partnerUser.name} turned off camera`;
                document.getElementById("remote-spinner").classList.add("hidden");
            } else {
                remotePlaceholder.classList.add("hidden");
            }
        }
    });

    // In-call chat message
    socket.on("receiveMessage", (msg) => {
        if (sessionData && msg.connection === sessionData.connectionId) {
            appendInCallChatMessage(msg);
        }
    });

    // Remote peer left session
    socket.on("sessionUserLeft", ({ userName }) => {
        console.log("👋 Peer left the session:", userName);
        updateConnStatus("Partner has left the call", "waiting");
        document.getElementById("remote-placeholder").classList.remove("hidden");
        document.getElementById("remote-status-msg").textContent = `${userName} left the session`;
        document.getElementById("remote-spinner").classList.add("hidden");

        const remoteVideo = document.getElementById("remote-video");
        if (remoteVideo.srcObject) {
            remoteVideo.srcObject = null;
        }
    });

    // Session ended by host or system
    socket.on("sessionEnded", ({ endedBy }) => {
        console.log("Session officially ended by:", endedBy);
        showSessionEndedModal("The session has been ended.");
        cleanupMedia();
    });
}

// Create and configure RTCPeerConnection
function initPeerConnection() {
    if (peerConnection) return;

    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local media tracks
    if (localStream) {
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
    }

    // Receive remote tracks
    peerConnection.ontrack = (event) => {
        console.log("🎥 Received remote media track:", event.track.kind);
        const remoteVideo = document.getElementById("remote-video");

        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            document.getElementById("remote-placeholder").classList.add("hidden");
        }
    };

    // Send local ICE candidates to peer through signaling server
    peerConnection.onicecandidate = (event) => {
        if (event.candidate && socket && socket.connected) {
            socket.emit("iceCandidate", {
                sessionId,
                candidate: event.candidate
            });
        }
    };

    // Monitor connection state
    peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        console.log("⚡ WebRTC connection state changed:", state);

        switch (state) {
            case "connected":
                updateConnStatus("Connected 🟢", "connected");
                document.getElementById("remote-placeholder").classList.add("hidden");
                startTimer();
                break;
            case "disconnected":
                updateConnStatus("Connection interrupted...", "waiting");
                document.getElementById("remote-placeholder").classList.remove("hidden");
                document.getElementById("remote-status-msg").textContent = "Reconnecting with partner...";
                break;
            case "failed":
                updateConnStatus("Connection failed", "error");
                document.getElementById("remote-placeholder").classList.remove("hidden");
                document.getElementById("remote-status-msg").textContent = "Connection failed. Please refresh.";
                break;
            case "closed":
                updateConnStatus("Call ended", "error");
                break;
        }
    };

    peerConnection.oniceconnectionstatechange = () => {
        console.log("ICE Connection State:", peerConnection.iceConnectionState);
    };
}

// Setup Media Controls Toolbar
function setupControlButtons() {
    // 1. Microphone Toggle
    const btnMic = document.getElementById("btn-toggle-mic");
    const labelMic = document.getElementById("label-mic");
    const localMicStatus = document.getElementById("local-mic-status");

    btnMic.addEventListener("click", () => {
        if (!localStream) return;
        const audioTrack = localStream.getAudioTracks()[0];
        if (!audioTrack) return;

        isAudioMuted = !isAudioMuted;
        audioTrack.enabled = !isAudioMuted;

        btnMic.classList.toggle("active", !isAudioMuted);
        btnMic.classList.toggle("muted", isAudioMuted);
        btnMic.querySelector(".btn-icon").textContent = isAudioMuted ? "🔇" : "🎤";
        labelMic.textContent = isAudioMuted ? "Unmute" : "Mute";
        localMicStatus.textContent = isAudioMuted ? "🔇" : "🎤";
        localMicStatus.title = isAudioMuted ? "Muted" : "Active";

        if (socket && socket.connected) {
            socket.emit("mediaToggle", {
                sessionId,
                type: "audio",
                enabled: !isAudioMuted
            });
        }
    });

    // 2. Camera Toggle
    const btnCam = document.getElementById("btn-toggle-cam");
    const labelCam = document.getElementById("label-cam");
    const localCamStatus = document.getElementById("local-cam-status");
    const localPlaceholder = document.getElementById("local-placeholder");

    btnCam.addEventListener("click", () => {
        if (!localStream) return;
        const videoTrack = localStream.getVideoTracks()[0];
        if (!videoTrack) return;

        isVideoStopped = !isVideoStopped;
        videoTrack.enabled = !isVideoStopped;

        btnCam.classList.toggle("active", !isVideoStopped);
        btnCam.classList.toggle("muted", isVideoStopped);
        btnCam.querySelector(".btn-icon").textContent = isVideoStopped ? "🚫" : "📷";
        labelCam.textContent = isVideoStopped ? "Start Video" : "Stop Video";
        localCamStatus.textContent = isVideoStopped ? "🚫" : "📷";

        localPlaceholder.classList.toggle("hidden", !isVideoStopped);

        if (socket && socket.connected) {
            socket.emit("mediaToggle", {
                sessionId,
                type: "video",
                enabled: !isVideoStopped
            });
        }
    });

    // 3. Screen Sharing Toggle
    const btnScreen = document.getElementById("btn-toggle-screen");
    const labelScreen = document.getElementById("label-screen");

    btnScreen.addEventListener("click", async () => {
        if (!isScreenSharing) {
            try {
                screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const screenTrack = screenStream.getVideoTracks()[0];

                // Replace outgoing video track on peer connection
                if (peerConnection) {
                    const videoSender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
                    if (videoSender) {
                        videoSender.replaceTrack(screenTrack);
                    }
                }

                // Update local video element preview
                document.getElementById("local-video").srcObject = screenStream;

                isScreenSharing = true;
                btnScreen.classList.add("active");
                labelScreen.textContent = "Stop Sharing";

                screenTrack.onended = () => {
                    stopScreenSharing();
                };
            } catch (err) {
                console.warn("Screen share cancelled or failed:", err);
            }
        } else {
            stopScreenSharing();
        }
    });

    function stopScreenSharing() {
        if (!isScreenSharing) return;

        if (screenStream) {
            screenStream.getTracks().forEach(t => t.stop());
            screenStream = null;
        }

        if (localStream) {
            const originalVideoTrack = localStream.getVideoTracks()[0];
            if (peerConnection && originalVideoTrack) {
                const videoSender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
                if (videoSender) {
                    videoSender.replaceTrack(originalVideoTrack);
                }
            }
            document.getElementById("local-video").srcObject = localStream;
        }

        isScreenSharing = false;
        btnScreen.classList.remove("active");
        labelScreen.textContent = "Share Screen";
    }

    // 4. In-Call Chat Drawer Toggle
    const btnChat = document.getElementById("btn-toggle-chat");
    const drawer = document.getElementById("in-call-chat-drawer");
    const closeDrawerBtn = document.getElementById("close-drawer-btn");

    btnChat.addEventListener("click", () => {
        drawer.classList.toggle("hidden");
    });

    closeDrawerBtn.addEventListener("click", () => {
        drawer.classList.add("hidden");
    });

    // Chat Drawer Form Submit
    const drawerForm = document.getElementById("drawer-input-form");
    const drawerInput = document.getElementById("drawer-msg-input");

    drawerForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = drawerInput.value.trim();
        if (!text || !sessionData || !partnerUser) return;

        if (socket && socket.connected) {
            socket.emit("sendMessage", {
                connectionId: sessionData.connectionId,
                receiverId: partnerUser._id,
                message: text
            });

            appendInCallChatMessage({
                sender: { _id: currentUser._id, name: currentUser.name },
                message: text,
                createdAt: new Date()
            });

            drawerInput.value = "";
        }
    });

    // 5. End Session Buttons
    document.getElementById("btn-end-call").addEventListener("click", confirmEndSession);
    document.getElementById("leave-session-btn-top").addEventListener("click", confirmEndSession);

    // 6. Retry permissions button
    document.getElementById("retry-permission-btn").addEventListener("click", async () => {
        const ready = await initLocalMedia();
        if (ready) {
            initPeerConnection();
        }
    });
}

function appendInCallChatMessage(msg) {
    const container = document.getElementById("drawer-messages");
    const isMine = (msg.sender._id || msg.sender) === currentUser._id;

    const row = document.createElement("div");
    row.style.margin = "8px 0";
    row.style.padding = "8px 12px";
    row.style.borderRadius = "10px";
    row.style.fontSize = "13px";
    row.style.lineHeight = "1.4";
    row.style.maxWidth = "85%";
    row.style.wordBreak = "break-word";

    if (isMine) {
        row.style.marginLeft = "auto";
        row.style.background = "#4f46e5";
        row.style.color = "#fff";
    } else {
        row.style.marginRight = "auto";
        row.style.background = "#1e1e2c";
        row.style.color = "#f1f5f9";
        row.style.border = "1px solid #2d2d3e";
    }

    const timeStr = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    row.innerHTML = `
        <div style="font-size: 11px; opacity: 0.8; margin-bottom: 2px;">${isMine ? "You" : escapeHtml(msg.sender.name || partnerUser.name)} • ${timeStr}</div>
        <div>${escapeHtml(msg.message)}</div>
    `;

    container.appendChild(row);
    container.scrollTop = container.scrollHeight;
}

// Confirmation before leaving/ending call
async function confirmEndSession() {
    const confirmed = confirm("Are you sure you want to end this live session?");
    if (!confirmed) return;

    try {
        if (socket && socket.connected) {
            socket.emit("leaveSession", { sessionId });
        }

        // Notify backend to update session status to completed
        await fetch(`http://localhost:5000/api/live-sessions/${sessionId}/end`, {
            method: "PUT",
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });
    } catch (e) {
        console.warn("End session API call:", e);
    } finally {
        cleanupMedia();
        showSessionEndedModal("You have ended the live session.");
    }
}

// Cleanup hardware tracks and peer connection
function cleanupMedia() {
    stopTimer();

    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
    }
    if (screenStream) {
        screenStream.getTracks().forEach(t => t.stop());
        screenStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
}

// Session Duration Timer
function startTimer() {
    if (timerInterval) return;

    timerInterval = setInterval(() => {
        timerSeconds++;
        const mins = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
        const secs = String(timerSeconds % 60).padStart(2, "0");
        document.getElementById("session-timer").textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}

function showSessionEndedModal(message) {
    stopTimer();
    const modal = document.getElementById("session-ended-modal");
    document.getElementById("session-summary-text").textContent = message;
    document.getElementById("final-duration").textContent = document.getElementById("session-timer").textContent;
    modal.classList.remove("hidden");
}

function updateConnStatus(text, type) {
    const textEl = document.getElementById("conn-status-text");
    const dotEl = document.getElementById("status-dot");
    textEl.textContent = text;

    dotEl.className = "status-indicator-dot";
    if (type === "connected") {
        dotEl.classList.add("connected");
    } else if (type === "error") {
        dotEl.classList.add("error");
    } else {
        dotEl.classList.add("connecting");
    }
}

function showAlert(text) {
    const alertBox = document.getElementById("session-alert");
    const alertText = document.getElementById("alert-text");
    alertText.textContent = text;
    alertBox.classList.remove("hidden");
}

function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(" ").map(part => part[0].toUpperCase()).slice(0, 2).join("");
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/[&<>'"]/g, tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
    }[tag] || tag));
}
