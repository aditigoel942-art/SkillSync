const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema({
    reviewer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    reviewee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    sessionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "LiveSession"
    },
    connectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Connection"
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    feedback: {
        type: String,
        default: ""
    },
    skillTopic: {
        type: String,
        default: "Skill Exchange"
    }
}, {
    timestamps: true
});

const Review = mongoose.model("Review", reviewSchema);

module.exports = Review;
