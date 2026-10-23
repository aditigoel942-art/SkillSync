const mongoose = require("mongoose");

const proctoringEventSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ["fullscreen_exit", "visibility_hidden", "window_blur", "camera_disconnect", "camera_reconnect", "session_paused", "session_resumed"],
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    },
    details: {
        type: String,
        default: ""
    }
}, { _id: false });

const assessmentSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    skill: {
        type: String,
        required: true,
        trim: true,
        index: true
    },
    // Final weighted composite score (0 - 100)
    score: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    // Verification Level reflects the evidence completed
    // - "Quiz Assessed" (MCQ benchmark completed)
    // - "Practically Assessed" (MCQ + Practical Task + Follow-up completed with proctoring)
    // - "Live Demonstration Reviewed" (Peer live session or authorized reviewer audit)
    verificationLevel: {
        type: String,
        enum: ["Quiz Assessed", "Practically Assessed", "Live Demonstration Reviewed"],
        default: "Practically Assessed"
    },
    estimatedLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Advanced"],
        required: true
    },
    status: {
        type: String,
        enum: ["in_progress", "completed", "paused", "flagged_for_review"],
        default: "completed"
    },
    // Configurable weighted score breakdown:
    // MCQ: 30%, Practical Task: 50%, Follow-up Questions: 20%
    breakdown: {
        mcqScore: { type: Number, default: 0 },         // out of 30
        practicalScore: { type: Number, default: 0 },   // out of 50
        followUpScore: { type: Number, default: 0 },    // out of 20
        objectiveScore: { type: Number, default: 0 },   // backward compatibility
        conceptualScore: { type: Number, default: 0 }   // backward compatibility
    },
    // AI Follow-up section generated from practical task solution
    followUpGenerated: {
        type: Boolean,
        default: false
    },
    followUpQuestions: [
        {
            id: Number,
            question: String,
            topic: String,
            maxPoints: Number,
            expectedKeyConcepts: [String]
        }
    ],
    // Proctoring telemetry metadata (stored separately from skill competency score)
    proctoring: {
        consentGiven: { type: Boolean, default: true },
        cameraMonitoringActive: { type: Boolean, default: true },
        fullscreenExitCount: { type: Number, default: 0 },
        visibilityChangeCount: { type: Number, default: 0 },
        windowBlurCount: { type: Number, default: 0 },
        cameraDisconnectCount: { type: Number, default: 0 },
        isFlaggedForReview: { type: Boolean, default: false },
        flagReason: { type: String, default: "" },
        events: [proctoringEventSchema]
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    strengths: {
        type: [String],
        default: []
    },
    areasForImprovement: {
        type: [String],
        default: []
    },
    evaluationSummary: {
        type: String,
        default: ""
    },
    rubricNote: {
        type: String,
        default: "Live proctored assessment calculated via weighted scoring: MCQ (30%), Practical Implementation (50%), and AI Follow-Up (20%). Proctoring alerts indicate environmental checks and do not prove cheating."
    },
    answersRecord: [
        {
            questionId: Number,
            questionType: String,
            questionText: String,
            userAnswer: String,
            isCorrect: Boolean,
            pointsAwarded: Number,
            maxPoints: Number,
            feedback: String
        }
    ]
}, {
    timestamps: true
});

assessmentSchema.index({ userId: 1, skill: 1, createdAt: -1 });

const Assessment = mongoose.models.Assessment || mongoose.model("Assessment", assessmentSchema);

module.exports = Assessment;
