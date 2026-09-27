// SkillSwap Real-Time One-to-One Chat Client Logic

let socket = null;
let currentUser = null;
let authToken = null;
let acceptedConnections = [];
let activeConnection = null;
let activePartner = null;
let onlineStatusMap = {};
let typingTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
    // 1. Verify authentication
    const userStr = localStorage.getItem("currentUser");
    authToken = localStorage.getItem("token");

    if (!userStr || !authToken) {
        alert("Please login to access SkillSwap Chat.");
        window.location.href = "login.html";
        return;
    }

    try {
        currentUser = JSON.parse(userStr);
    } catch (e) {
        localStorage.removeItem("currentUser");
        window.location.href = "login.html";
        return;
    }

    // Setup Logout button
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            localStorage.removeItem("currentUser");
            localStorage.removeItem("token");
            window.location.href = "login.html";
        });
    }

    // 2. Initialize Socket.IO connection
    initSocketConnection();

    // 3. Load accepted connections
    await loadConnections();

    // 4. Setup message sending form
    setupChatForm();

    // 5. Setup Live Session button in header
    const startSessionBtn = document.getElementById("start-session-btn");
    if (startSessionBtn) {
        startSessionBtn.addEventListener("click", () => {
            if (activeConnection && activePartner) {
                startLiveSession(activeConnection._id, activePartner._id);
            }
        });
    }
});

// Initialize Socket.IO with JWT authentication
function initSocketConnection() {
    const banner = document.getElementById("connection-banner");
    const bannerText = document.getElementById("banner-text");

    socket = io("http://localhost:5000", {
        auth: {
            token: authToken
        },
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500
    });

    socket.on("connect", () => {
        console.log("🟢 Connected to Socket.IO as:", currentUser.name);
        banner.classList.add("hidden");

        // Query online status for all connections
        refreshOnlineUsers();
    });

    socket.on("connect_error", (err) => {
        console.warn("🔴 Socket connection error:", err.message);
        banner.classList.remove("hidden");
        bannerText.textContent = "Connecting to real-time chat server (" + err.message + ")...";
    });

    socket.on("disconnect", (reason) => {
        console.warn("⚠️ Socket disconnected:", reason);
        banner.classList.remove("hidden");
        bannerText.textContent = "Disconnected from chat server. Reconnecting...";
    });

    // Real-time message received
    socket.on("receiveMessage", (message) => {
        handleIncomingMessage(message);
    });

    // Message delivery confirmation
    socket.on("messageSent", (message) => {
        handleMessageSent(message);
    });

    // Messages read receipt
    socket.on("messagesRead", ({ connectionId, readerId }) => {
        if (activeConnection && activeConnection._id === connectionId) {
            markMessagesAsDeliveredAndRead();
        }
    });

    // Online status change of any user
    socket.on("userStatusChanged", ({ userId, online }) => {
        onlineStatusMap[userId] = online;
        updateUserOnlineStatusUI(userId, online);
    });

    // Typing indicator
    socket.on("userTyping", ({ senderId, connectionId, isTyping }) => {
        if (activeConnection && activeConnection._id === connectionId && activePartner && activePartner._id === senderId) {
            const typingIndicator = document.getElementById("typing-indicator");
            const typingText = document.getElementById("typing-text");
            if (isTyping) {
                typingText.textContent = `${activePartner.name} is typing...`;
                typingIndicator.classList.remove("hidden");
            } else {
                typingIndicator.classList.add("hidden");
            }
        }
    });

    // Chat error feedback
    socket.on("chatError", (err) => {
        alert("Chat notice: " + (err.message || "Failed to send message"));
    });
}

// Fetch all accepted connections from backend
async function loadConnections() {
    const listContainer = document.getElementById("conversations-list");
    const countBadge = document.getElementById("connections-count");

    try {
        const response = await fetch(`http://localhost:5000/api/accepted-connections/${currentUser._id}`);
        if (!response.ok) throw new Error("Failed to fetch connections");

        acceptedConnections = await response.json();
        countBadge.textContent = acceptedConnections.length;

        if (acceptedConnections.length === 0) {
            listContainer.innerHTML = `
                <div class="chat-empty-state">
                    <p>No accepted connections yet.</p>
                    <a href="browse-skills.html" class="browse-link">Find Skill Partners 🚀</a>
                </div>
            `;
            return;
        }

        renderConversationsList();

        // Check URL parameters for pre-selected conversation
        const urlParams = new URLSearchParams(window.location.search);
        const preselectedConnectionId = urlParams.get("connectionId");
        const preselectedUserId = urlParams.get("userId");

        let target = null;
        if (preselectedConnectionId) {
            target = acceptedConnections.find(c => c._id === preselectedConnectionId);
        } else if (preselectedUserId) {
            target = acceptedConnections.find(c => {
                const other = c.sender._id === currentUser._id ? c.receiver : c.sender;
                return other._id === preselectedUserId;
            });
        }

        if (target) {
            selectConversation(target);
        } else if (acceptedConnections.length > 0) {
            selectConversation(acceptedConnections[0]);
        }

    } catch (err) {
        console.error("Error loading connections:", err);
        listContainer.innerHTML = `<div class="chat-error-state"><p>Could not load connections ❌</p></div>`;
    }
}

// Render sidebar conversations
function renderConversationsList() {
    const listContainer = document.getElementById("conversations-list");
    listContainer.innerHTML = "";

    acceptedConnections.forEach(connection => {
        const otherUser = connection.sender._id === currentUser._id ? connection.receiver : connection.sender;
        const initials = getInitials(otherUser.name);
        const isOnline = !!onlineStatusMap[otherUser._id];

        const item = document.createElement("div");
        item.classList.add("conversation-item");
        item.dataset.connectionId = connection._id;
        item.dataset.userId = otherUser._id;

        if (activeConnection && activeConnection._id === connection._id) {
            item.classList.add("active");
        }

        item.innerHTML = `
            <div class="item-avatar-wrapper">
                <div class="item-avatar">${initials}</div>
                <span class="status-indicator ${isOnline ? 'online' : 'offline'}" id="status-dot-${otherUser._id}"></span>
            </div>
            <div class="item-details">
                <div class="item-name-row">
                    <span class="item-name">${escapeHtml(otherUser.name)}</span>
                    <span class="item-time" id="last-time-${connection._id}"></span>
                </div>
                <div class="item-skills-row">
                    <span class="skill-tag">Teaches: ${(otherUser.teachSkills || []).slice(0, 2).join(", ") || 'General'}</span>
                </div>
                <p class="item-preview" id="last-preview-${connection._id}">Click to chat</p>
            </div>
        `;

        item.addEventListener("click", () => {
            selectConversation(connection);
        });

        listContainer.appendChild(item);
    });
}

// Switch the active conversation
async function selectConversation(connection) {
    activeConnection = connection;
    activePartner = connection.sender._id === currentUser._id ? connection.receiver : connection.sender;

    // Highlight selected item in sidebar
    document.querySelectorAll(".conversation-item").forEach(el => {
        el.classList.toggle("active", el.dataset.connectionId === connection._id);
    });

    // Update Header UI
    const chatHeader = document.getElementById("chat-header");
    const chatForm = document.getElementById("chat-form");
    const emptyPlaceholder = document.getElementById("empty-selection-placeholder");
    const messagesList = document.getElementById("messages-list");

    chatHeader.style.display = "flex";
    chatForm.style.display = "flex";
    emptyPlaceholder.style.display = "none";
    messagesList.style.display = "flex";

    document.getElementById("active-user-name").textContent = activePartner.name;
    document.getElementById("active-avatar").textContent = getInitials(activePartner.name);

    const isOnline = !!onlineStatusMap[activePartner._id];
    updateUserOnlineStatusUI(activePartner._id, isOnline);

    const teachSkills = (activePartner.teachSkills || []).join(", ");
    const learnSkills = (activePartner.learnSkills || []).join(", ");
    document.getElementById("active-user-skills").textContent = `Teaches: ${teachSkills || 'N/A'} • Wants: ${learnSkills || 'N/A'}`;

    // Load message history from REST API
    await loadMessages(connection._id);

    // Focus on message input
    document.getElementById("message-input").focus();

    // Emit read event
    if (socket && socket.connected) {
        socket.emit("markAsRead", { connectionId: connection._id });
    }
}

// Fetch historical messages for active connection
async function loadMessages(connectionId) {
    const messagesList = document.getElementById("messages-list");
    messagesList.innerHTML = `<div class="chat-loading-state"><p>Loading messages...</p></div>`;

    try {
        const response = await fetch(`http://localhost:5000/api/messages/${connectionId}`, {
            headers: {
                "Authorization": `Bearer ${authToken}`
            }
        });

        if (!response.ok) throw new Error("Failed to fetch messages");

        const messages = await response.json();
        messagesList.innerHTML = "";

        if (messages.length === 0) {
            messagesList.innerHTML = `
                <div class="empty-messages-prompt">
                    <p>👋 Say hello to <strong>${escapeHtml(activePartner.name)}</strong>!</p>
                    <small>Start exchanging skills and coordinate your learning session.</small>
                </div>
            `;
            return;
        }

        messages.forEach(msg => {
            appendMessageToUI(msg);
        });

        scrollToBottom();

        // Update preview in sidebar
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) {
            updateSidebarPreview(connectionId, lastMsg);
        }

    } catch (err) {
        console.error("Error loading messages:", err);
        messagesList.innerHTML = `<div class="chat-error-state"><p>Could not load messages ❌</p></div>`;
    }
}

// Setup chat submit & typing event listeners
function setupChatForm() {
    const form = document.getElementById("chat-form");
    const input = document.getElementById("message-input");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !activeConnection || !activePartner) return;

        // Send via Socket.IO
        socket.emit("sendMessage", {
            connectionId: activeConnection._id,
            receiverId: activePartner._id,
            message: text
        }, (res) => {
            if (!res || !res.success) {
                console.warn("Message failed to send:", res?.message);
            }
        });

        input.value = "";
        notifyTyping(false);
    });

    // Typing listener
    input.addEventListener("input", () => {
        notifyTyping(true);
        clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            notifyTyping(false);
        }, 1500);
    });
}

function notifyTyping(isTyping) {
    if (socket && socket.connected && activePartner && activeConnection) {
        socket.emit("typing", {
            receiverId: activePartner._id,
            connectionId: activeConnection._id,
            isTyping
        });
    }
}

// Handle real-time incoming message
function handleIncomingMessage(message) {
    // If belongs to the currently active conversation
    if (activeConnection && message.connection === activeConnection._id) {
        const emptyPrompt = document.querySelector(".empty-messages-prompt");
        if (emptyPrompt) emptyPrompt.remove();

        appendMessageToUI(message);
        scrollToBottom();

        // Mark as read in backend
        socket.emit("markAsRead", { connectionId: activeConnection._id });
    }

    // Always update sidebar preview
    updateSidebarPreview(message.connection, message);
}

// Handle message confirmation for sender
function handleMessageSent(message) {
    if (activeConnection && message.connection === activeConnection._id) {
        const emptyPrompt = document.querySelector(".empty-messages-prompt");
        if (emptyPrompt) emptyPrompt.remove();

        appendMessageToUI(message);
        scrollToBottom();
    }
    updateSidebarPreview(message.connection, message);
}

// Append single message bubble to DOM
function appendMessageToUI(message) {
    const messagesList = document.getElementById("messages-list");
    const isMine = (message.sender._id || message.sender) === currentUser._id;

    const row = document.createElement("div");
    row.classList.add("message-row", isMine ? "sent-row" : "received-row");

    const timeStr = formatTime(message.createdAt);
    const readStatus = isMine ? `<span class="read-ticks">${message.read ? '✓✓' : '✓'}</span>` : '';

    row.innerHTML = `
        <div class="message-bubble ${isMine ? 'sent-bubble' : 'received-bubble'}">
            <p class="message-content">${escapeHtml(message.message)}</p>
            <div class="message-meta">
                <span class="message-time">${timeStr}</span>
                ${readStatus}
            </div>
        </div>
    `;

    messagesList.appendChild(row);
}

function markMessagesAsDeliveredAndRead() {
    document.querySelectorAll(".sent-row .read-ticks").forEach(el => {
        el.textContent = "✓✓";
    });
}

function updateSidebarPreview(connectionId, message) {
    const previewEl = document.getElementById(`last-preview-${connectionId}`);
    const timeEl = document.getElementById(`last-time-${connectionId}`);

    if (previewEl) {
        const isMine = (message.sender._id || message.sender) === currentUser._id;
        previewEl.textContent = (isMine ? "You: " : "") + message.message;
    }
    if (timeEl) {
        timeEl.textContent = formatTime(message.createdAt);
    }
}

// Refresh online status for all connections
function refreshOnlineUsers() {
    if (!socket || !socket.connected || acceptedConnections.length === 0) return;

    const userIds = acceptedConnections.map(c => {
        return c.sender._id === currentUser._id ? c.receiver._id : c.sender._id;
    });

    socket.emit("getOnlineUsers", userIds, (statusMap) => {
        if (statusMap) {
            onlineStatusMap = { ...onlineStatusMap, ...statusMap };
            userIds.forEach(uid => {
                updateUserOnlineStatusUI(uid, !!onlineStatusMap[uid]);
            });
        }
    });
}

function updateUserOnlineStatusUI(userId, isOnline) {
    // Sidebar indicator
    const dot = document.getElementById(`status-dot-${userId}`);
    if (dot) {
        dot.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
    }

    // Active conversation header indicator
    if (activePartner && activePartner._id === userId) {
        const headerDot = document.getElementById("active-status-dot");
        const headerText = document.getElementById("active-online-status");
        if (headerDot) headerDot.className = `status-indicator ${isOnline ? 'online' : 'offline'}`;
        if (headerText) {
            headerText.textContent = isOnline ? "Online 🟢" : "Offline ⚪";
            headerText.style.color = isOnline ? "#22c55e" : "#888";
        }
    }
}

// Filter conversations in sidebar search
function filterConversations() {
    const query = document.getElementById("search-conversations").value.toLowerCase();
    document.querySelectorAll(".conversation-item").forEach(item => {
        const name = item.querySelector(".item-name")?.textContent.toLowerCase() || "";
        const skills = item.querySelector(".item-skills-row")?.textContent.toLowerCase() || "";
        if (name.includes(query) || skills.includes(query)) {
            item.style.display = "flex";
        } else {
            item.style.display = "none";
        }
    });
}

// Trigger Live Session initiation
async function startLiveSession(connectionId, participantId) {
    if (!authToken) {
        alert("Please login first.");
        window.location.href = "login.html";
        return;
    }

    try {
        const response = await fetch("http://localhost:5000/api/live-sessions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${authToken}`
            },
            body: JSON.stringify({ connectionId, participantId })
        });

        const data = await response.json();
        if (response.ok && data.session) {
            window.location.href = `live-session.html?sessionId=${data.session._id}`;
        } else {
            alert(data.message || "Failed to start live session");
        }
    } catch (err) {
        console.error("Live session start error:", err);
        alert("Server error starting live session");
    }
}

// Utility functions
function getInitials(name) {
    if (!name) return "?";
    return name.trim().split(" ").map(part => part[0].toUpperCase()).slice(0, 2).join("");
}

function formatTime(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

function scrollToBottom() {
    const container = document.getElementById("messages-container");
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}
