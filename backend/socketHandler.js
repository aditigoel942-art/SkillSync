const jwt = require("jsonwebtoken");
const Connection = require("./connectionModel");
const Message = require("./messageModel");
const User = require("./userModel");
const LiveSession = require("./liveSessionModel");

const JWT_SECRET = process.env.JWT_SECRET || "skillswap_jwt_secret_key_2026_super_secure";

// Map to track active user sockets: userId -> Set of socketId
const userSockets = new Map();

function setupSocketIO(io) {
    // Socket authentication middleware: verifies JWT token
    io.use(async (socket, next) => {
        try {
            let token = socket.handshake.auth?.token;
            if (!token && socket.handshake.headers?.authorization) {
                const parts = socket.handshake.headers.authorization.split(" ");
                if (parts.length === 2 && parts[0] === "Bearer") {
                    token = parts[1];
                }
            }

            if (!token) {
                return next(new Error("Authentication error: Token is required"));
            }

            const decoded = jwt.verify(token, JWT_SECRET);
            if (!decoded || !decoded.userId) {
                return next(new Error("Authentication error: Invalid token"));
            }

            const user = await User.findById(decoded.userId).select("_id name email teachSkills learnSkills");
            if (!user) {
                return next(new Error("Authentication error: User does not exist"));
            }

            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (err) {
            console.error("Socket authentication error:", err.message);
            next(new Error("Authentication error: " + err.message));
        }
    });

    io.on("connection", (socket) => {
        const userId = socket.userId;
        console.log(`🔌 User connected to socket: ${socket.user.name} (${userId})`);

        // Register user socket
        if (!userSockets.has(userId)) {
            userSockets.set(userId, new Set());
        }
        userSockets.get(userId).add(socket.id);

        // Join personal room for direct notifications
        socket.join("user_" + userId);

        // Broadcast to all connected clients that this user is online
        io.emit("userStatusChanged", { userId, online: true });

        // Handler to check online status of specific users
        socket.on("getOnlineUsers", (userIds, callback) => {
            if (typeof callback === "function" && Array.isArray(userIds)) {
                const statusMap = {};
                userIds.forEach(id => {
                    const idStr = id?.toString();
                    statusMap[idStr] = userSockets.has(idStr) && userSockets.get(idStr).size > 0;
                });
                callback(statusMap);
            }
        });

        // ==========================================
        // REAL-TIME CHAT EVENTS
        // ==========================================

        // Send a chat message
        socket.on("sendMessage", async (data, callback) => {
            try {
                const { connectionId, receiverId, message } = data;

                if (!connectionId || !receiverId || !message || !message.trim()) {
                    const errRes = { success: false, message: "Invalid message payload" };
                    if (typeof callback === "function") callback(errRes);
                    return socket.emit("chatError", errRes);
                }

                // SECURITY CHECK: Verify accepted connection between socket.userId and receiverId
                const connection = await Connection.findById(connectionId);
                if (!connection) {
                    const errRes = { success: false, message: "Connection not found" };
                    if (typeof callback === "function") callback(errRes);
                    return socket.emit("chatError", errRes);
                }

                if (connection.status !== "accepted") {
                    const errRes = { success: false, message: "Cannot send message: Connection is not accepted" };
                    if (typeof callback === "function") callback(errRes);
                    return socket.emit("chatError", errRes);
                }

                const senderId = socket.userId;
                const p1 = connection.sender.toString();
                const p2 = connection.receiver.toString();

                const isSenderParticipant = (senderId === p1 || senderId === p2);
                const isReceiverParticipant = (receiverId.toString() === p1 || receiverId.toString() === p2);
                const isDistinct = (senderId !== receiverId.toString());

                if (!isSenderParticipant || !isReceiverParticipant || !isDistinct) {
                    const errRes = { success: false, message: "Unauthorized: You do not belong to this connection" };
                    if (typeof callback === "function") callback(errRes);
                    return socket.emit("chatError", errRes);
                }

                // Save message in MongoDB
                const savedMessage = await Message.create({
                    sender: senderId,
                    receiver: receiverId,
                    connection: connectionId,
                    message: message.trim(),
                    read: false
                });

                const populatedMessage = await Message.findById(savedMessage._id)
                    .populate("sender", "name email")
                    .populate("receiver", "name email");

                // Emit to receiver's personal room
                io.to("user_" + receiverId).emit("receiveMessage", populatedMessage);

                // Confirm back to sender
                socket.emit("messageSent", populatedMessage);

                if (typeof callback === "function") {
                    callback({ success: true, message: populatedMessage });
                }
            } catch (err) {
                console.error("Error in sendMessage socket event:", err);
                const errRes = { success: false, message: "Failed to send message" };
                if (typeof callback === "function") callback(errRes);
                socket.emit("chatError", errRes);
            }
        });

        // Mark messages as read
        socket.on("markAsRead", async (data) => {
            try {
                const { connectionId } = data;
                if (!connectionId) return;

                const connection = await Connection.findById(connectionId);
                if (!connection || connection.status !== "accepted") return;

                const currentUserId = socket.userId;
                const p1 = connection.sender.toString();
                const p2 = connection.receiver.toString();
                if (currentUserId !== p1 && currentUserId !== p2) return;

                const otherUserId = (p1 === currentUserId) ? p2 : p1;

                await Message.updateMany(
                    { connection: connectionId, receiver: currentUserId, read: false },
                    { $set: { read: true } }
                );

                // Notify sender that their messages have been read
                io.to("user_" + otherUserId).emit("messagesRead", {
                    connectionId,
                    readerId: currentUserId
                });
            } catch (err) {
                console.error("Error in markAsRead socket event:", err);
            }
        });

        // Typing indicator
        socket.on("typing", (data) => {
            const { receiverId, connectionId, isTyping } = data;
            if (receiverId) {
                io.to("user_" + receiverId).emit("userTyping", {
                    senderId: socket.userId,
                    connectionId,
                    isTyping
                });
            }
        });

        // ==========================================
        // WEBRTC LIVE SESSION SIGNALING EVENTS
        // ==========================================

        socket.on("joinSession", async ({ sessionId }, callback) => {
            try {
                if (!sessionId) {
                    if (typeof callback === "function") callback({ success: false, message: "Session ID required" });
                    return;
                }

                const session = await LiveSession.findById(sessionId)
                    .populate("host", "name email teachSkills learnSkills")
                    .populate("participant", "name email teachSkills learnSkills");

                if (!session) {
                    if (typeof callback === "function") callback({ success: false, message: "Live session not found" });
                    return;
                }

                if (session.status === "completed" || session.status === "cancelled") {
                    if (typeof callback === "function") callback({ success: false, message: "Session has already ended" });
                    return;
                }

                const currentUserId = socket.userId;
                const hostId = session.host._id.toString();
                const participantId = session.participant._id.toString();

                if (currentUserId !== hostId && currentUserId !== participantId) {
                    if (typeof callback === "function") callback({ success: false, message: "Unauthorized to join this live session" });
                    return;
                }

                // Verify accepted connection
                const connection = await Connection.findById(session.connectionId);
                if (!connection || connection.status !== "accepted") {
                    if (typeof callback === "function") callback({ success: false, message: "Underlying connection is not accepted" });
                    return;
                }

                const roomName = "session_" + sessionId;
                socket.join(roomName);

                // Notify room that user joined
                socket.to(roomName).emit("sessionUserJoined", {
                    userId: currentUserId,
                    userName: socket.user.name,
                    socketId: socket.id
                });

                if (typeof callback === "function") {
                    callback({
                        success: true,
                        session,
                        userId: currentUserId,
                        userName: socket.user.name
                    });
                }
            } catch (err) {
                console.error("Error in joinSession:", err);
                if (typeof callback === "function") callback({ success: false, message: "Server error joining session" });
            }
        });

        socket.on("webrtcOffer", ({ sessionId, offer, targetUserId }) => {
            if (!sessionId || !offer) return;
            const roomName = "session_" + sessionId;
            socket.to(roomName).emit("webrtcOffer", {
                offer,
                senderId: socket.userId,
                senderName: socket.user.name
            });
        });

        socket.on("webrtcAnswer", ({ sessionId, answer, targetUserId }) => {
            if (!sessionId || !answer) return;
            const roomName = "session_" + sessionId;
            socket.to(roomName).emit("webrtcAnswer", {
                answer,
                senderId: socket.userId
            });
        });

        socket.on("iceCandidate", ({ sessionId, candidate }) => {
            if (!sessionId || !candidate) return;
            const roomName = "session_" + sessionId;
            socket.to(roomName).emit("iceCandidate", {
                candidate,
                senderId: socket.userId
            });
        });

        socket.on("mediaToggle", ({ sessionId, type, enabled }) => {
            if (!sessionId) return;
            const roomName = "session_" + sessionId;
            socket.to(roomName).emit("userMediaToggled", {
                userId: socket.userId,
                type,
                enabled
            });
        });

        socket.on("leaveSession", async ({ sessionId }) => {
            if (!sessionId) return;
            const roomName = "session_" + sessionId;
            socket.to(roomName).emit("sessionUserLeft", {
                userId: socket.userId,
                userName: socket.user.name
            });
            socket.leave(roomName);
        });

        // ==========================================
        // DISCONNECT
        // ==========================================
        socket.on("disconnect", () => {
            console.log(`🔌 User disconnected: ${socket.user?.name} (${userId})`);
            const sockets = userSockets.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    userSockets.delete(userId);
                    // Broadcast offline status
                    io.emit("userStatusChanged", { userId, online: false });
                }
            }
        });
    });

    return {
        isUserOnline: (uid) => {
            const uidStr = uid?.toString();
            return userSockets.has(uidStr) && userSockets.get(uidStr).size > 0;
        }
    };
}

module.exports = { setupSocketIO, JWT_SECRET };
