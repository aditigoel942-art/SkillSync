const mongoose = require("mongoose");

const verifiedSkillSubSchema = new mongoose.Schema({
    skill: {
        type: String,
        required: true,
        trim: true
    },
    score: {
        type: Number,
        required: true
    },
    estimatedLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Advanced"],
        required: true
    },
    // Reflects evidence completed: "Quiz Assessed", "Practically Assessed", or "Live Demonstration Reviewed"
    verificationLevel: {
        type: String,
        enum: ["Quiz Assessed", "Practically Assessed", "Live Demonstration Reviewed"],
        default: "Practically Assessed"
    },
    assessmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Assessment"
    },
    verifiedAt: {
        type: Date,
        default: Date.now
    }
}, { _id: false });

const userSchema = new mongoose.Schema({ 
    name: { 
        type: String, 
        required: true 
    }, 
 
    email: { 
        type: String, 
        required: true, 
        unique: true 
    },

    password: {
        type: String,
        required: true
    },

    location: {
        type: String
    },

    bio: {
        type: String
    },
 
    teachSkills: { 
        type: [String], 
        required: true 
    }, 
 
    learnSkills: { 
        type: [String], 
        required: true 
    },

    // Verified skills cache for high-performance badge display & matchmaking
    verifiedSkills: {
        type: [verifiedSkillSubSchema],
        default: []
    }
}); 
 
const User = mongoose.model("User", userSchema); 
 
module.exports = User;
