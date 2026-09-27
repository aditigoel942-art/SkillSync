const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    connection: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Connection",
        required: true,
        index: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    read: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);

module.exports = Message;
