const express = require("express");                              
const mongoose = require("mongoose");
require("dotenv").config();

const cors = require("cors");                             //cors ko import/load kar rahe hain, taaki frontend aur backend ke beech request allow ho sake
const User = require("./userModel"); 

const connectionSchema = new mongoose.Schema({           //database mein connection request ka data kis format mein save hoga, woh define karna hai.
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    status: {
        type: String,
        default: "pending"
    }
    }, {
    timestamps: true
});

const Connection = mongoose.model("Connection", connectionSchema); 


const app = express();

app.use(cors());

// JSON data receive karne ke liye
app.use(express.json());

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
        .populate("sender", "name email")
        .populate("receiver", "name email");

        res.json(connections);

    } catch (error) {
        console.log(error.message);

        res.status(500).json({
            message: "Failed to fetch accepted connections"
        });
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

res.status(201).json({
    message: "User created successfully!",
    user: user
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

        res.json({
            message: "Login successful!",
            user: user
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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});