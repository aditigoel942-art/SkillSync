const mongoose = require("mongoose");

const liveSessionSchema = new mongoose.Schema({
    host: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    participant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    connectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Connection",
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ["scheduled", "live", "completed", "cancelled"],
        default: "live"
    },
    startedAt: {
        type: Date,
        default: Date.now
    },
    endedAt: {
        type: Date
    }
}, {
    timestamps: true
});

const LiveSession = mongoose.models.LiveSession || mongoose.model("LiveSession", liveSessionSchema);

module.exports = LiveSession;
