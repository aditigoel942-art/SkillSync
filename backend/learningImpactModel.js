const mongoose = require("mongoose");

const impactProctoringEventSchema = new mongoose.Schema({
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

const impactAssessmentStageSchema = new mongoose.Schema({
    completed: { type: Boolean, default: false },
    score: { type: Number, min: 0, max: 100, default: 0 },
    completedAt: { type: Date },
    answers: [
        {
            questionId: Number,
            questionType: String,
            topic: String,
            questionText: String,
            userAnswer: String,
            isCorrect: Boolean,
            pointsAwarded: Number,
            maxPoints: Number,
            feedback: String
        }
    ],
    // Proctoring telemetry metadata per stage
    proctoring: {
        consentGiven: { type: Boolean, default: true },
        cameraMonitoringActive: { type: Boolean, default: true },
        fullscreenExitCount: { type: Number, default: 0 },
        visibilityChangeCount: { type: Number, default: 0 },
        windowBlurCount: { type: Number, default: 0 },
        cameraDisconnectCount: { type: Number, default: 0 },
        isFlaggedForReview: { type: Boolean, default: false },
        flagReason: { type: String, default: "" },
        events: [impactProctoringEventSchema]
    }
}, { _id: false });

const learningImpactSchema = new mongoose.Schema({
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LiveSession",
        required: true,
        index: true
    },
    learnerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    mentorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    skill: {
        type: String,
        required: true,
        trim: true
    },
    learningObjectives: {
        type: [String],
        default: []
    },
    // Pre-Session Assessment Record with Proctoring
    preAssessment: {
        type: impactAssessmentStageSchema,
        default: () => ({ completed: false, score: 0, proctoring: { consentGiven: false, isFlaggedForReview: false } })
    },
    // Post-Session Assessment Record with Proctoring
    postAssessment: {
        type: impactAssessmentStageSchema,
        default: () => ({ completed: false, score: 0, proctoring: { consentGiven: false, isFlaggedForReview: false } })
    },
    // Impact Analysis & Delta Synthesis
    impactAnalysis: {
        status: {
            type: String,
            enum: ["pending_pre", "pre_completed", "ready_for_post", "analyzed", "provisional_review"],
            default: "pending_pre"
        },
        preScore: { type: Number, default: 0 },
        postScore: { type: Number, default: 0 },
        percentagePointChange: { type: Number, default: 0 },
        isProvisional: { type: Boolean, default: false },
        reviewNotice: { type: String, default: "" },
        growthSummary: { type: String, default: "" },
        topicResults: [
            {
                topic: String,
                preScore: Number,
                postScore: Number,
                change: Number,
                status: String // "Mastered", "Improved", "Needs Practice"
            }
        ],
        demonstratedStrengths: {
            type: [String],
            default: []
        },
        topicsNeedingPractice: {
            type: [String],
            default: []
        },
        recommendedNextExercises: {
            type: [String],
            default: []
        },
        reliabilityDisclaimer: {
            type: String,
            default: "This learning impact analysis reflects relative score changes across live AI-proctored pre- and post-assessments under identical environmental conditions. It is an indicative measure of session comprehension and does not guarantee professional certification."
        }
    }
}, {
    timestamps: true
});

learningImpactSchema.index({ sessionId: 1, learnerId: 1 }, { unique: true });

const LearningImpact = mongoose.models.LearningImpact || mongoose.model("LearningImpact", learningImpactSchema);

module.exports = LearningImpact;
