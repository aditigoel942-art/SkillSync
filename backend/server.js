const express = require("express");                              
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
require("dotenv").config();

const cors = require("cors");                             //cors ko import/load kar rahe hain, taaki frontend aur backend ke beech request allow ho sake
const User = require("./userModel"); 
const Connection = require("./connectionModel");
const Message = require("./messageModel");
const LiveSession = require("./liveSessionModel");
const { setupSocketIO, JWT_SECRET } = require("./socketHandler");

const app = express();

app.use(cors());

// JSON data receive karne ke liye
app.use(express.json());

// Create HTTP server and initialize Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT"]
    }
});

// Setup Socket.IO real-time handlers
setupSocketIO(io);

// Authentication Middleware for Protected REST APIs
const verifyAuth = async (req, res, next) => {
    try {
        let token = req.headers.authorization;
        if (token && token.startsWith("Bearer ")) {
            token = token.slice(7).trim();
        }
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({
                message: "Authentication required. Please login."
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({
                message: "Invalid or expired token. Please login again."
            });
        }

        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({
            message: "Authentication failed: " + err.message
        });
    }
};

//connection request api/route.//yeha is POST route ka kaam connection request bhejna hai.
app.post("/api/connections", async (req, res) => {
    try {
        const { sender, receiver } = req.body;

        const existingConnection = await Connection.findOne({
            sender,
            receiver
        });

        if (existingConnection) {
            return res.status(400).json({
                message: "Connection request already sent."
            });
        }

        const connection = new Connection({
            sender,
            receiver
        });

        await connection.save();

        res.json({
            message: "Connection request sent successfully!",
            connection
        });

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to send connection request"
        });
    }
});

//Ye route check karta hai ki kisi user ko connection request kis-kis ne bheji hai.
app.get("/api/connections/:userId", async (req, res) => {
    try {
        const connections = await Connection.find({
            receiver: req.params.userId
        }).populate("sender", "name email");

        res.json(connections);

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to fetch connection requests"
        });
    }
});

//Accept/Reject button ko backend se working banayega yeh part.
app.put("/api/connections/:id", async (req, res) => {
    try {
        const { status } = req.body;

        const connection = await Connection.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        res.json({
            message: `Connection ${status} successfully!`,
            connection
        });

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to update connection"
        });
    }
});

//Accepted Connections ki API banayenge(Ye sirf accepted connections nikalega..Aur user chahe sender ho ya receiver, dono situations mein connection milega.)
app.get("/api/accepted-connections/:userId", async (req, res) => {
    try {
        const userId = req.params.userId;

        const connections = await Connection.find({
            status: "accepted",
            $or: [
                { sender: userId },
                { receiver: userId }
            ]
        })
        .populate("sender", "name email teachSkills learnSkills bio location")
        .populate("receiver", "name email teachSkills learnSkills bio location");

        res.json(connections);

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to fetch accepted connections"
        });
    }
});

// ==========================================
// REST APIS FOR REAL-TIME CHAT (MESSAGES)
// ==========================================

// Get message history for a connection (strictly authorized)
app.get("/api/messages/:connectionId", verifyAuth, async (req, res) => {
    try {
        const { connectionId } = req.params;
        const currentUserId = req.user.userId;

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ message: "Connection not found" });
        }

        if (connection.status !== "accepted") {
            return res.status(403).json({ message: "Cannot view messages: Connection is not accepted" });
        }

        const isSender = connection.sender.toString() === currentUserId;
        const isReceiver = connection.receiver.toString() === currentUserId;

        if (!isSender && !isReceiver) {
            return res.status(403).json({ message: "Unauthorized to access messages for this connection" });
        }

        const messages = await Message.find({ connection: connectionId })
            .sort({ createdAt: 1 })
            .populate("sender", "name email")
            .populate("receiver", "name email");

        res.json(messages);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Failed to fetch messages" });
    }
});

// Mark messages in connection as read for the logged-in user
app.put("/api/messages/read/:connectionId", verifyAuth, async (req, res) => {
    try {
        const { connectionId } = req.params;
        const currentUserId = req.user.userId;

        const connection = await Connection.findById(connectionId);
        if (!connection || connection.status !== "accepted") {
            return res.status(403).json({ message: "Unauthorized or invalid connection" });
        }

        const isParticipant = connection.sender.toString() === currentUserId || connection.receiver.toString() === currentUserId;
        if (!isParticipant) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        await Message.updateMany(
            { connection: connectionId, receiver: currentUserId, read: false },
            { $set: { read: true } }
        );

        res.json({ message: "Messages marked as read" });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Failed to update read status" });
    }
});

// ==========================================
// REST APIS FOR LIVE SESSIONS (WEBRTC)
// ==========================================

// Create or get active live session for an accepted connection
app.post("/api/live-sessions", verifyAuth, async (req, res) => {
    try {
        const { connectionId, participantId } = req.body;
        const currentUserId = req.user.userId;

        if (!connectionId || !participantId) {
            return res.status(400).json({ message: "connectionId and participantId are required" });
        }

        const connection = await Connection.findById(connectionId);
        if (!connection) {
            return res.status(404).json({ message: "Connection not found" });
        }

        if (connection.status !== "accepted") {
            return res.status(403).json({ message: "Cannot start session: Connection is not accepted" });
        }

        const p1 = connection.sender.toString();
        const p2 = connection.receiver.toString();

        const isSender = (currentUserId === p1 || currentUserId === p2);
        const isReceiver = (participantId === p1 || participantId === p2);

        if (!isSender || !isReceiver || currentUserId === participantId) {
            return res.status(403).json({ message: "Unauthorized: Invalid session participants" });
        }

        // Check if an active session already exists for this connection
        let activeSession = await LiveSession.findOne({
            connectionId,
            status: "live"
        }).populate("host", "name email teachSkills learnSkills")
          .populate("participant", "name email teachSkills learnSkills");

        if (!activeSession) {
            activeSession = await LiveSession.create({
                host: currentUserId,
                participant: participantId,
                connectionId,
                status: "live",
                startedAt: new Date()
            });

            activeSession = await LiveSession.findById(activeSession._id)
                .populate("host", "name email teachSkills learnSkills")
                .populate("participant", "name email teachSkills learnSkills");
        }

        res.status(200).json({
            message: "Live session ready",
            session: activeSession
        });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Failed to initialize live session" });
    }
});

// Get live session details
app.get("/api/live-sessions/:id", verifyAuth, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const session = await LiveSession.findById(req.params.id)
            .populate("host", "name email teachSkills learnSkills")
            .populate("participant", "name email teachSkills learnSkills")
            .populate("connectionId");

        if (!session) {
            return res.status(404).json({ message: "Live session not found" });
        }

        const isHost = session.host._id.toString() === currentUserId;
        const isParticipant = session.participant._id.toString() === currentUserId;

        if (!isHost && !isParticipant) {
            return res.status(403).json({ message: "Unauthorized to access this session" });
        }

        res.json(session);
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Failed to fetch live session" });
    }
});

// End live session
app.put("/api/live-sessions/:id/end", verifyAuth, async (req, res) => {
    try {
        const currentUserId = req.user.userId;
        const session = await LiveSession.findById(req.params.id);

        if (!session) {
            return res.status(404).json({ message: "Live session not found" });
        }

        const isHost = session.host.toString() === currentUserId;
        const isParticipant = session.participant.toString() === currentUserId;

        if (!isHost && !isParticipant) {
            return res.status(403).json({ message: "Unauthorized to end this session" });
        }

        session.status = "completed";
        session.endedAt = new Date();
        await session.save();

        io.to("session_" + session._id).emit("sessionEnded", {
            sessionId: session._id,
            endedBy: currentUserId
        });

        res.json({ message: "Live session ended successfully", session });
    } catch (error) {
        console.log(error.message);
        res.status(500).json({ message: "Failed to end live session" });
    }
});

const PORT = 5000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => {
        console.log("MongoDB Connected Successfully! 🎉");
    })
    .catch((error) => {
        console.log("MongoDB Connection Failed ❌");
        console.log(error.message);
    });

// Test route
app.post("/api/users", async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            location,
            bio,
            teachSkills,
            learnSkills
        } = req.body;

        const user = new User({
            name,
            email,
            password,
            location,
            bio,
            teachSkills,
            learnSkills
        });

        await user.save();

        // Generate signed JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            message: "User created successfully!",
            user: user,
            token: token
        });

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to create user"
        });
    }
});

// Saare users MongoDB se lene ke liye get api
app.get("/api/users", async (req, res) => {
    try {
        const users = await User.find();

        res.json(users);
    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: error.message
        });
    }
});

app.get("/", (req, res) => {
    res.send("SkillSwap Backend is Running 🚀");
});

// Login API
app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (user.password !== password) {
            return res.status(401).json({
                message: "Incorrect password"
            });
        }

        // Generate signed JWT token
        const token = jwt.sign(
            { userId: user._id, email: user.email },
            JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            message: "Login successful!",
            user: user,
            token: token
        });

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Login failed"
        });
    }
});

//Match API users ke skills compare karke batayegi ki kaun kiske liye suitable SkillSwap partner hai.
app.get("/api/matches/:userId", async (req, res) => {
    try {
        const currentUser = await User.findById(req.params.userId);

        if (!currentUser) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const otherUsers = await User.find({
            _id: { $ne: currentUser._id }
        });

        const normalize = skill => skill.trim().toLowerCase();

        const matches = otherUsers.filter(otherUser => {

            const myTeachSkills = currentUser.teachSkills.map(normalize);
            const myLearnSkills = currentUser.learnSkills.map(normalize);

            const theirTeachSkills = otherUser.teachSkills.map(normalize);
            const theirLearnSkills = otherUser.learnSkills.map(normalize);

            const theyTeachWhatIWant =
                myLearnSkills.some(skill =>
                    theirTeachSkills.includes(skill)
                );

            const ITeachWhatTheyWant =
                theirLearnSkills.some(skill =>
                    myTeachSkills.includes(skill)
                );

            return theyTeachWhatIWant && ITeachWhatTheyWant;
        });

        res.json(matches);

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to find matches"
        });
    }
});

//is portion ka kam hai profile.html ko database se kisi ek specific user ki information dilwana.
app.get("/api/users/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        res.json(user);

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});