// In-memory data store for SkillSwap when external MongoDB is not connected
// Ensures full functionality, live sessions, instant messaging, connections, and demo users

const initialUsers = [
    {
        _id: "65f001000000000000000001",
        name: "Aditi Sharma",
        email: "aditi@example.com",
        password: "password123",
        location: "Bengaluru, India",
        bio: "Senior Frontend Engineer specializing in React, Next.js, and TypeScript. Looking to pick up Rust and systems architecture!",
        teachSkills: ["React", "JavaScript", "TypeScript", "Tailwind CSS", "UI/UX Design"],
        learnSkills: ["Python", "Rust", "System Design", "Docker"]
    },
    {
        _id: "65f001000000000000000002",
        name: "Khushnam Khan",
        email: "khushnam@example.com",
        password: "password123",
        location: "Mumbai, India",
        bio: "Backend developer building scalable distributed systems and WebSockets. Passionate about teaching Node.js and learning Flutter!",
        teachSkills: ["Node.js", "Python", "System Design", "Docker", "MongoDB"],
        learnSkills: ["React", "Flutter", "TypeScript"]
    },
    {
        _id: "65f001000000000000000003",
        name: "Liam Chen",
        email: "liam@example.com",
        password: "password123",
        location: "San Francisco, USA",
        bio: "Full stack developer & creative coder. Love teaching WebGL, Three.js, and UI animations.",
        teachSkills: ["Three.js", "WebGL", "Creative Coding", "JavaScript"],
        learnSkills: ["Node.js", "Python", "Machine Learning"]
    },
    {
        _id: "65f001000000000000000004",
        name: "Elena Rostova",
        email: "elena@example.com",
        password: "password123",
        location: "Berlin, Germany",
        bio: "Product designer and design systems specialist. Happy to mentor Figma & design thinking in exchange for Python data analysis.",
        teachSkills: ["UI/UX Design", "Figma", "Design Systems", "User Research"],
        learnSkills: ["Python", "Data Science", "React"]
    },
    {
        _id: "65f001000000000000000005",
        name: "Marcus Vance",
        email: "marcus@example.com",
        password: "password123",
        location: "London, UK",
        bio: "Machine Learning researcher with 4 years industry experience in PyTorch & NLP. Want to learn modern React frontend.",
        teachSkills: ["Python", "Machine Learning", "Data Science", "PyTorch"],
        learnSkills: ["React", "JavaScript", "UI/UX Design"]
    }
];

const initialConnections = [
    {
        _id: "65f002000000000000000001",
        sender: "65f001000000000000000001",
        receiver: "65f001000000000000000002",
        status: "accepted",
        createdAt: new Date(Date.now() - 3600000 * 24),
        updatedAt: new Date(Date.now() - 3600000 * 24)
    },
    {
        _id: "65f002000000000000000002",
        sender: "65f001000000000000000005",
        receiver: "65f001000000000000000001",
        status: "accepted",
        createdAt: new Date(Date.now() - 3600000 * 12),
        updatedAt: new Date(Date.now() - 3600000 * 12)
    },
    {
        _id: "65f002000000000000000003",
        sender: "65f001000000000000000003",
        receiver: "65f001000000000000000002",
        status: "pending",
        createdAt: new Date(Date.now() - 3600000 * 2),
        updatedAt: new Date(Date.now() - 3600000 * 2)
    }
];

const initialMessages = [
    {
        _id: "65f003000000000000000001",
        sender: "65f001000000000000000002",
        receiver: "65f001000000000000000001",
        connection: "65f002000000000000000001",
        message: "Hi Aditi! Excited to swap Node.js insights for some React tips!",
        read: true,
        createdAt: new Date(Date.now() - 3600000 * 20),
        updatedAt: new Date(Date.now() - 3600000 * 20)
    },
    {
        _id: "65f003000000000000000002",
        sender: "65f001000000000000000001",
        receiver: "65f001000000000000000002",
        connection: "65f002000000000000000001",
        message: "Hey Khushnam! Absolutely. Let's schedule a live session to walk through state management and WebSocket scaling.",
        read: true,
        createdAt: new Date(Date.now() - 3600000 * 19),
        updatedAt: new Date(Date.now() - 3600000 * 19)
    }
];

let idCounter = 100;
function generateId() {
    return "65f0" + (Date.now().toString(16) + (++idCounter).toString(16)).padStart(20, "0").slice(-20);
}

class MemoryStore {
    constructor() {
        this.users = new Map(initialUsers.map(u => [u._id, { ...u, verifiedSkills: u.verifiedSkills || [] }]));
        this.connections = new Map(initialConnections.map(c => [c._id, { ...c }]));
        this.messages = new Map(initialMessages.map(m => [m._id, { ...m }]));
        this.liveSessions = new Map();
        this.assessments = new Map();
        this.activeAssessmentSessions = new Map(); // temporary storage during test taking
        this.learningImpacts = new Map(); // stores pre/post session impacts
        this.activeImpactSessions = new Map(); // temporary storage during pre/post test taking
        this.reviews = new Map([
            ["65f004000000000000000001", {
                _id: "65f004000000000000000001",
                reviewer: "65f001000000000000000002",
                reviewee: "65f001000000000000000001",
                rating: 5,
                feedback: "Fantastic session! Aditi explained React concurrent rendering and custom hooks with crystal clarity.",
                skillTopic: "React & TypeScript",
                createdAt: new Date(Date.now() - 3600000 * 18),
                updatedAt: new Date(Date.now() - 3600000 * 18)
            }],
            ["65f004000000000000000002", {
                _id: "65f004000000000000000002",
                reviewer: "65f001000000000000000001",
                reviewee: "65f001000000000000000002",
                rating: 5,
                feedback: "Khushnam is an extraordinary backend mentor. We architected a real-time event pipeline in under an hour!",
                skillTopic: "Node.js & WebSockets",
                createdAt: new Date(Date.now() - 3600000 * 16),
                updatedAt: new Date(Date.now() - 3600000 * 16)
            }],
            ["65f004000000000000000003", {
                _id: "65f004000000000000000003",
                reviewer: "65f001000000000000000004",
                reviewee: "65f001000000000000000005",
                rating: 5,
                feedback: "Marcus broke down neural network fundamentals and NLP pipelines seamlessly. Highly recommended exchange!",
                skillTopic: "Python & Machine Learning",
                createdAt: new Date(Date.now() - 3600000 * 10),
                updatedAt: new Date(Date.now() - 3600000 * 10)
            }]
        ]);
    }

    // Users
    findUserById(id) {
        return this.users.get(String(id)) || null;
    }

    findUserByEmail(email) {
        for (const u of this.users.values()) {
            if (u.email.toLowerCase() === String(email).toLowerCase()) return u;
        }
        return null;
    }

    getAllUsers() {
        return Array.from(this.users.values());
    }

    createUser(data) {
        const id = generateId();
        const user = {
            _id: id,
            name: data.name,
            email: data.email,
            password: data.password,
            location: data.location || "",
            bio: data.bio || "",
            teachSkills: Array.isArray(data.teachSkills) ? data.teachSkills : [],
            learnSkills: Array.isArray(data.learnSkills) ? data.learnSkills : []
        };
        this.users.set(id, user);
        return user;
    }

    updateUser(id, data) {
        const existing = this.findUserById(id);
        if (!existing) return null;
        const updated = { ...existing, ...data };
        this.users.set(String(id), updated);
        return updated;
    }

    // Connections
    createConnection(senderId, receiverId) {
        const existing = this.findConnection(senderId, receiverId);
        if (existing) return { error: "Connection request already sent." };

        const id = generateId();
        const conn = {
            _id: id,
            sender: String(senderId),
            receiver: String(receiverId),
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.connections.set(id, conn);
        return { connection: conn };
    }

    findConnection(p1, p2) {
        const s1 = String(p1);
        const s2 = String(p2);
        for (const c of this.connections.values()) {
            if ((c.sender === s1 && c.receiver === s2) || (c.sender === s2 && c.receiver === s1)) {
                return c;
            }
        }
        return null;
    }

    getConnectionById(id) {
        return this.connections.get(String(id)) || null;
    }

    getUserConnections(userId) {
        const uId = String(userId);
        const results = [];
        for (const c of this.connections.values()) {
            if (c.receiver === uId) {
                const senderObj = this.findUserById(c.sender);
                results.push({
                    ...c,
                    sender: senderObj ? { _id: senderObj._id, name: senderObj.name, email: senderObj.email } : c.sender
                });
            }
        }
        return results;
    }

    getAcceptedConnections(userId) {
        const uId = String(userId);
        const results = [];
        for (const c of this.connections.values()) {
            if (c.status === "accepted" && (c.sender === uId || c.receiver === uId)) {
                const senderObj = this.findUserById(c.sender);
                const receiverObj = this.findUserById(c.receiver);
                results.push({
                    ...c,
                    sender: senderObj ? { _id: senderObj._id, name: senderObj.name, email: senderObj.email, teachSkills: senderObj.teachSkills, learnSkills: senderObj.learnSkills, bio: senderObj.bio, location: senderObj.location } : c.sender,
                    receiver: receiverObj ? { _id: receiverObj._id, name: receiverObj.name, email: receiverObj.email, teachSkills: receiverObj.teachSkills, learnSkills: receiverObj.learnSkills, bio: receiverObj.bio, location: receiverObj.location } : c.receiver
                });
            }
        }
        return results;
    }

    updateConnectionStatus(id, status) {
        const conn = this.getConnectionById(id);
        if (!conn) return null;
        conn.status = status;
        conn.updatedAt = new Date();
        this.connections.set(String(id), conn);
        return conn;
    }

    // Messages
    getMessages(connectionId) {
        const cId = String(connectionId);
        const list = [];
        for (const m of this.messages.values()) {
            if (m.connection === cId) {
                const senderObj = this.findUserById(m.sender);
                const receiverObj = this.findUserById(m.receiver);
                list.push({
                    ...m,
                    sender: senderObj ? { _id: senderObj._id, name: senderObj.name, email: senderObj.email } : m.sender,
                    receiver: receiverObj ? { _id: receiverObj._id, name: receiverObj.name, email: receiverObj.email } : m.receiver
                });
            }
        }
        list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return list;
    }

    createMessage(senderId, receiverId, connectionId, text) {
        const id = generateId();
        const msg = {
            _id: id,
            sender: String(senderId),
            receiver: String(receiverId),
            connection: String(connectionId),
            message: String(text).trim(),
            read: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.messages.set(id, msg);

        const senderObj = this.findUserById(senderId);
        const receiverObj = this.findUserById(receiverId);
        return {
            ...msg,
            sender: senderObj ? { _id: senderObj._id, name: senderObj.name, email: senderObj.email } : senderId,
            receiver: receiverObj ? { _id: receiverObj._id, name: receiverObj.name, email: receiverObj.email } : receiverId
        };
    }

    markMessagesAsRead(connectionId, receiverUserId) {
        const cId = String(connectionId);
        const rId = String(receiverUserId);
        for (const m of this.messages.values()) {
            if (m.connection === cId && m.receiver === rId && !m.read) {
                m.read = true;
                m.updatedAt = new Date();
            }
        }
    }

    // Live Sessions
    createOrGetLiveSession(connectionId, hostId, participantId) {
        const cId = String(connectionId);
        for (const s of this.liveSessions.values()) {
            if (s.connectionId === cId && s.status === "live") {
                return this.populateSession(s);
            }
        }

        const id = generateId();
        const session = {
            _id: id,
            host: String(hostId),
            participant: String(participantId),
            connectionId: cId,
            status: "live",
            startedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.liveSessions.set(id, session);
        return this.populateSession(session);
    }

    getLiveSessionById(id) {
        const s = this.liveSessions.get(String(id));
        return s ? this.populateSession(s) : null;
    }

    endLiveSession(id) {
        const s = this.liveSessions.get(String(id));
        if (!s) return null;
        s.status = "completed";
        s.endedAt = new Date();
        s.updatedAt = new Date();
        return s;
    }

    populateSession(session) {
        const hostObj = this.findUserById(session.host);
        const partObj = this.findUserById(session.participant);
        const connObj = this.getConnectionById(session.connectionId);
        return {
            ...session,
            host: hostObj ? { _id: hostObj._id, name: hostObj.name, email: hostObj.email, teachSkills: hostObj.teachSkills, learnSkills: hostObj.learnSkills } : session.host,
            participant: partObj ? { _id: partObj._id, name: partObj.name, email: partObj.email, teachSkills: partObj.teachSkills, learnSkills: partObj.learnSkills } : session.participant,
            connectionId: connObj || session.connectionId
        };
    }

    // Reviews & Community Rating
    createReview({ reviewerId, revieweeId, rating, feedback, skillTopic, sessionId, connectionId }) {
        const id = generateId();
        const review = {
            _id: id,
            reviewer: String(reviewerId),
            reviewee: String(revieweeId),
            rating: Math.max(1, Math.min(5, Number(rating) || 5)),
            feedback: String(feedback || "").trim(),
            skillTopic: String(skillTopic || "Skill Exchange").trim(),
            sessionId: sessionId ? String(sessionId) : null,
            connectionId: connectionId ? String(connectionId) : null,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.reviews.set(id, review);
        return this.populateReview(review);
    }

    getReviewsForUser(userId) {
        const uId = String(userId);
        const list = [];
        for (const r of this.reviews.values()) {
            if (r.reviewee === uId) {
                list.push(this.populateReview(r));
            }
        }
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return list;
    }

    getAllReviews() {
        const list = [];
        for (const r of this.reviews.values()) {
            list.push(this.populateReview(r));
        }
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return list;
    }

    getUserRatingStats(userId) {
        const reviews = this.getReviewsForUser(userId);
        if (reviews.length === 0) {
            return {
                averageRating: 5.0,
                totalReviews: 0,
                reviews: []
            };
        }
        const total = reviews.reduce((acc, curr) => acc + curr.rating, 0);
        const avg = (total / reviews.length).toFixed(1);
        return {
            averageRating: parseFloat(avg),
            totalReviews: reviews.length,
            reviews
        };
    }

    getGlobalCommunityStats() {
        const all = Array.from(this.reviews.values());
        if (all.length === 0) {
            return {
                averageRating: 5.0,
                totalReviews: 0,
                totalSessions: this.liveSessions.size
            };
        }
        const sum = all.reduce((acc, r) => acc + r.rating, 0);
        const avg = (sum / all.length).toFixed(1);
        return {
            averageRating: parseFloat(avg),
            totalReviews: all.length,
            totalSessions: this.liveSessions.size
        };
    }

    populateReview(review) {
        const reviewerObj = this.findUserById(review.reviewer);
        const revieweeObj = this.findUserById(review.reviewee);
        return {
            ...review,
            reviewer: reviewerObj ? { _id: reviewerObj._id, name: reviewerObj.name, email: reviewerObj.email } : review.reviewer,
            reviewee: revieweeObj ? { _id: revieweeObj._id, name: revieweeObj.name, email: revieweeObj.email } : review.reviewee
        };
    }

    // Assessments
    saveAssessment(data) {
        const id = generateId();
        const assessment = {
            _id: id,
            ...data,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        this.assessments.set(id, assessment);

        // Update user verifiedSkills cache
        const user = this.findUserById(data.userId);
        if (user) {
            const list = user.verifiedSkills || [];
            const filtered = list.filter(s => s.skill.toLowerCase() !== data.skill.toLowerCase());
            filtered.push({
                skill: data.skill,
                score: data.score,
                estimatedLevel: data.estimatedLevel,
                verificationLevel: data.verificationLevel || "Practically Assessed",
                assessmentId: id,
                verifiedAt: new Date()
            });
            user.verifiedSkills = filtered;
            this.users.set(String(user._id), user);
        }

        return assessment;
    }

    findAssessmentsByUserId(userId) {
        const list = [];
        for (const a of this.assessments.values()) {
            if (String(a.userId) === String(userId)) {
                list.push(a);
            }
        }
        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    findAssessmentById(id) {
        return this.assessments.get(String(id)) || null;
    }

    // Active in-progress test sessions
    startActiveTestSession(sessionId, sessionData) {
        this.activeAssessmentSessions.set(sessionId, {
            ...sessionData,
            proctoringEvents: [],
            fullscreenExitCount: 0,
            visibilityChangeCount: 0,
            windowBlurCount: 0,
            cameraDisconnectCount: 0,
            isPaused: false,
            createdAt: Date.now()
        });
    }

    updateActiveTestSession(sessionId, updates) {
        const existing = this.activeAssessmentSessions.get(sessionId);
        if (existing) {
            this.activeAssessmentSessions.set(sessionId, {
                ...existing,
                ...updates,
                updatedAt: Date.now()
            });
            return this.activeAssessmentSessions.get(sessionId);
        }
        return null;
    }

    getActiveTestSession(sessionId) {
        return this.activeAssessmentSessions.get(sessionId) || null;
    }

    deleteActiveTestSession(sessionId) {
        this.activeAssessmentSessions.delete(sessionId);
    }

    // Learning Impact records
    saveLearningImpact(impactData) {
        let existingId = null;
        for (const [id, item] of this.learningImpacts.entries()) {
            if (String(item.sessionId) === String(impactData.sessionId) && String(item.learnerId) === String(impactData.learnerId)) {
                existingId = id;
                break;
            }
        }

        const id = existingId || generateId();
        const record = {
            _id: id,
            ...impactData,
            createdAt: impactData.createdAt || new Date(),
            updatedAt: new Date()
        };
        this.learningImpacts.set(id, record);
        return record;
    }

    findLearningImpactBySessionAndLearner(sessionId, learnerId) {
        for (const item of this.learningImpacts.values()) {
            if (String(item.sessionId) === String(sessionId) && String(item.learnerId) === String(learnerId)) {
                return item;
            }
        }
        return null;
    }

    findLearningImpactBySession(sessionId) {
        for (const item of this.learningImpacts.values()) {
            if (String(item.sessionId) === String(sessionId)) {
                return item;
            }
        }
        return null;
    }

    findLearningImpactsByLearner(learnerId) {
        const list = [];
        for (const item of this.learningImpacts.values()) {
            if (String(item.learnerId) === String(learnerId)) {
                list.push(item);
            }
        }
        return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    startActiveImpactSession(token, data) {
        this.activeImpactSessions.set(token, {
            ...data,
            proctoringEvents: [],
            fullscreenExitCount: 0,
            visibilityChangeCount: 0,
            windowBlurCount: 0,
            cameraDisconnectCount: 0,
            isPaused: false,
            createdAt: Date.now()
        });
    }

    updateActiveImpactSession(token, updates) {
        const existing = this.activeImpactSessions.get(token);
        if (existing) {
            this.activeImpactSessions.set(token, {
                ...existing,
                ...updates,
                updatedAt: Date.now()
            });
            return this.activeImpactSessions.get(token);
        }
        return null;
    }

    getActiveImpactSession(token) {
        return this.activeImpactSessions.get(token) || null;
    }

    deleteActiveImpactSession(token) {
        this.activeImpactSessions.delete(token);
    }
}

const memoryStore = new MemoryStore();

module.exports = {
    memoryStore,
    isMongoActive: () => {
        try {
            const mongoose = require("mongoose");
            return mongoose.connection.readyState === 1;
        } catch {
            return false;
        }
    }
};
