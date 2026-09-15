const signupForm = document.getElementById("signup-form");

if (signupForm) {
    signupForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const name = document.getElementById("name").value;
const email = document.getElementById("email").value;
const teachSkills = document.getElementById("teachSkills").value
    .split(",")
    .map(skill => skill.trim());

const learnSkills = document.getElementById("learnSkills").value
    .split(",")
    .map(skill => skill.trim());

    const password = document.getElementById("password").value;
const confirmPassword = document.getElementById("confirmPassword").value;
const location = document.getElementById("location").value;
const bio = document.getElementById("bio").value;

if (password !== confirmPassword) {
    alert("Passwords do not match ❌");
    return;
}

        try {
            const response = await fetch("http://localhost:5000/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
    name,
    email,
    password,
    location,
    bio,
    teachSkills,
    learnSkills
})
            });

            const data = await response.json();

            if (response.ok) {
                alert("Profile created successfully! 🎉");
                signupForm.reset();
            } else {
                alert(data.message);
            }

        } catch (error) {
            console.log(error);
            alert("Server se connection nahi ho paya ❌");
        }
    });
}
    
async function loadUsers() {
    const container = document.getElementById("users-container");

    try {
        const response = await fetch("http://localhost:5000/api/users");

        if (!response.ok) {
            throw new Error("Users API failed");
        }

        const users = await response.json();

        container.innerHTML = "";

        if (users.length === 0) {
            container.innerHTML = "<p>No users found.</p>";
            return;
        }

        users.forEach(user => {
            const userCard = document.createElement("div");

            userCard.classList.add("user-card");

            userCard.innerHTML = `
                <h3>${user.name}</h3>

                <p>
                    <strong>Can Teach:</strong>
                    ${user.teachSkills.join(", ")}
                </p>

                <p>
                    <strong>Wants To Learn:</strong>
                    ${user.learnSkills.join(", ")}
                </p>
            `;

            container.appendChild(userCard);
        });

    } catch (error) {
        console.log("Error loading users:", error);

        container.innerHTML = `
            <p>Users load nahi ho pa rahe ❌</p>
            <p>Please make sure SkillSwap server is running.</p>
        `;
    }
}

if (document.getElementById("users-container")) {
    loadUsers();
}
const matchButton = document.getElementById("find-match-btn");

if (matchButton) {
    matchButton.addEventListener("click", async function() {

        const response = await fetch(
            "http://localhost:5000/api/users"
        );

        const users = await response.json();

        const currentUser = JSON.parse(localStorage.getItem("currentUser"));

if (!currentUser) {
    alert("Please login first.");
    return;
}

        const matchResponse = await fetch(
            `http://localhost:5000/api/matches/${currentUser._id}`
        );

        const matches = await matchResponse.json();

        const container = document.getElementById("matches-container");

        container.innerHTML = "";

        if (matches.length === 0) {
            container.innerHTML = "<p>No matches found 😔</p>";
            return;
        }

        matches.forEach(user => {
    const card = document.createElement("div");

    card.classList.add("match-card");

    card.innerHTML = `
        <h3>${currentUser.name}</h3>

        <div class="match-found">
            🤝 MATCH FOUND 🤝
        </div>

        <h3>${user.name}</h3>

        <p><strong>${currentUser.name} teaches:</strong> 
        ${currentUser.teachSkills.join(", ")}</p>

        <p><strong>${user.name} teaches:</strong> 
        ${user.teachSkills.join(", ")}</p>
        <button class="connect-btn" data-id="${user._id}">
    Connect 🤝
</button>

    `;

        container.appendChild(card);
});
      //Connect button ko working banayenge.
const connectButtons = document.querySelectorAll(".connect-btn");

connectButtons.forEach(button => {
    button.addEventListener("click", async function() {

        const receiverId = this.dataset.id;

        const response = await fetch(
            "http://localhost:5000/api/connections",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    sender: currentUser._id,
                    receiver: receiverId
                })
            }
        );

        const data = await response.json();

        alert(data.message);
    });
});

    });
}
//login form.
const loginForm = document.getElementById("login-form");

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = document.getElementById("login-email").value;
        const password = document.getElementById("loginPassword").value;

        try {
            const response = await fetch("http://localhost:5000/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
    email: email,
    password: password
})
            });

            const data = await response.json();

            const message = document.getElementById("login-message");

            if (response.ok) {
                message.textContent = "Login successful! 🎉";

                // Current user ko browser mein save karna
                localStorage.setItem(
                    "currentUser",
                    JSON.stringify(data.user)
                );
                window.location.href = "dashboard.html";                 //User login karega → login successful → automatically dashboard open ho jayega.

            } else {
                message.textContent = data.message;
            }

        } catch (error) {
            console.log(error);

            document.getElementById("login-message").textContent =
                "Server se connection nahi ho paya ❌";
        }
    });
}

const connectionsContainer = document.getElementById("connections-container");

if (connectionsContainer) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        connectionsContainer.innerHTML = "<p>Please login first.</p>";
    } else {
        loadConnections(currentUser._id);
    }
}

//connections.html ko current logged-in user se connect karega.
async function loadConnections(userId) {
    try {
        const response = await fetch(
            `http://localhost:5000/api/connections/${userId}`
        );

        const connections = await response.json();

        const container = document.getElementById("connections-container");

        container.innerHTML = "";

        if (connections.length === 0) {
            container.innerHTML = "<p>No connection requests yet.</p>";
            return;
        }

        connections.forEach(connection => {
            container.innerHTML += `
                <div class="connection-card">
                    <h3>${connection.sender.name}</h3>
                    <p>${connection.sender.email}</p>
                    <p>Status: ${connection.status}</p>
                    
                    <button class="accept-btn" data-id="${connection._id}">    
    Accept ✅                                                                        
</button>

<button class="reject-btn" data-id="${connection._id}">
    Reject ❌
</button>
                </div>
            `;
        });

        async function updateConnection(connectionId, status) {
    try {
        const response = await fetch(
            `http://localhost:5000/api/connections/${connectionId}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: status
                })
            }
        );

        const data = await response.json();

        alert(data.message);

        location.reload();

    } catch (error) {
        console.log(error);
        alert("Failed to update connection ❌");
    }
}

        document.querySelectorAll(".accept-btn").forEach(button => {
    button.addEventListener("click", () => {
        updateConnection(button.dataset.id, "accepted");
    });
});

document.querySelectorAll(".reject-btn").forEach(button => {
    button.addEventListener("click", () => {
        updateConnection(button.dataset.id, "rejected");
    });
});

    } catch (error) {
        console.log(error);
    }
}

const acceptedContainer = document.getElementById(
    "accepted-connections-container"
);

if (acceptedContainer) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        acceptedContainer.innerHTML = "<p>Please login first.</p>";
    } else {
        loadAcceptedConnections(currentUser._id);
    }
}

//Ye code logged-in user ke saare accepted connections ko fetch karke webpage par show karta hai.
async function loadAcceptedConnections(userId) {
    try {
        const response = await fetch(
            `http://localhost:5000/api/accepted-connections/${userId}`
        );

        const connections = await response.json();

        const container = document.getElementById(
            "accepted-connections-container"
        );

        container.innerHTML = "";

        if (connections.length === 0) {
            container.innerHTML = "<p>No accepted connections yet.</p>";
            return;
        }

        connections.forEach(connection => {

            const otherUser =
                connection.sender._id === userId
                    ? connection.receiver
                    : connection.sender;

            container.innerHTML += `
                <div class="connection-card">
                    <h3>${otherUser.name}</h3>
                    <p>${otherUser.email}</p>
                    <p>Connected ✅</p>
                </div>
            `;
        });

    } catch (error) {
        console.log(error);
        document.getElementById(
    "accepted-connections-container"
).innerHTML =
    "<p>Connections load nahi ho pa rahi ❌</p>";
    }
}

//Logout 🚪 click → current user remove → Login page open.
const logoutButton = document.getElementById("logout-btn");

if (logoutButton) {
    logoutButton.addEventListener("click", function(event) {
        event.preventDefault();

        localStorage.removeItem("currentUser");

        window.location.href = "login.html";
    });
}

// Dashboard par current user ki profile details show karna
const dashboardUser = document.getElementById("dashboard-user");

if (dashboardUser) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (!currentUser) {
        dashboardUser.innerHTML = "<p>Please login first.</p>";
    } else {
        dashboardUser.innerHTML = `
            <h2>${currentUser.name}</h2>

            <p>
                <strong>Can Teach:</strong>
                ${currentUser.teachSkills.join(", ")}
            </p>

            <p>
                <strong>Wants To Learn:</strong>
                ${currentUser.learnSkills.join(", ")}
            </p>

            <p>
                <strong>Location:</strong>
                ${currentUser.location || "Not added"}
            </p>

            <p>
                <strong>Bio:</strong>
                ${currentUser.bio || "Not added"}
            </p>
        `;
    }
}

//Dashboard mein Skills Offered aur Skills Wanted actual data dikhayega.
const skillsOffered = document.getElementById("skills-offered");
const skillsWanted = document.getElementById("skills-wanted");

if (skillsOffered && skillsWanted) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser) {
        skillsOffered.innerHTML =
            currentUser.teachSkills
                .map(skill => `<p>🎓 ${skill}</p>`)
                .join("");

        skillsWanted.innerHTML =
            currentUser.learnSkills
                .map(skill => `<p>📚 ${skill}</p>`)
                .join("");
    }
}

//dashboard par current user ki total accepted connections ki count dikhane ke kaam aa raha hai.
const totalConnections = document.getElementById("total-connections");

if (totalConnections) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser) {
        fetch(`http://localhost:5000/api/accepted-connections/${currentUser._id}`)
            .then(response => response.json())
            .then(connections => {
                totalConnections.textContent = connections.length;
            })
            .catch(error => {
                console.log(error);
            });
    }
}

//dashboard par current user ki pending request ki count dikhane ke kaam aa raha hai
const pendingRequests = document.getElementById("pending-requests");

if (pendingRequests) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser) {
        fetch(`http://localhost:5000/api/connections/${currentUser._id}`)
            .then(response => response.json())
            .then(connections => {

                const pending = connections.filter(
                    connection => connection.status === "pending"
                );

                pendingRequests.textContent = pending.length;
            })
            .catch(error => {
                console.log(error);
            });
    }
}

//dashboard par current user ki skill offered ki count dikhane ke kaam aa raha hai
const skillsCount = document.getElementById("skills-count");

if (skillsCount) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser) {
        skillsCount.textContent = currentUser.teachSkills.length;
    }
}

 //Dashboard ke “Recent Activity” card mein pending requests aur accepted connections dikhana hai.
const recentActivity = document.getElementById("recent-activity");

if (recentActivity) {
    const currentUser = JSON.parse(localStorage.getItem("currentUser"));

    if (currentUser) {

        Promise.all([    //Iska simple meaning:Dono APIs ko ek saath call karo.             //YEHA NEECHE VLA PORTION API KO CALL KR RHA H.
            fetch(`http://localhost:5000/api/accepted-connections/${currentUser._id}`)     //Ye backend se accepted connections laati hai.
                .then(response => response.json()),

            fetch(`http://localhost:5000/api/connections/${currentUser._id}`)             //Ye backend se connection requests laati hai.
                .then(response => response.json())
        ])
        .then(([acceptedConnections, requests]) => {

            const activities = [                             //yeh code accepted aur pending connections ko ek list mein combine karke, newest-to-oldest date ke order mein sort kar raha hai.
    ...acceptedConnections.map(connection => ({
        type: "accepted",
        data: connection,
        date: new Date(connection.createdAt)
    })),

    ...requests
        .filter(connection => connection.status === "pending")
        .map(connection => ({
            type: "pending",
            data: connection,
            date: new Date(connection.createdAt)
        }))
];

activities.sort((a, b) => b.date - a.date);

            const pendingRequests = requests.filter(
                connection => connection.status === "pending"
            );

            recentActivity.innerHTML = "";

            if (
                acceptedConnections.length === 0 &&
                pendingRequests.length === 0
            ) {
                recentActivity.innerHTML =
                    "<p>No recent activity yet.</p>";
                return;
            }

           activities.forEach(activity => {

    if (activity.type === "pending") {

        recentActivity.innerHTML += `
            <p>
                📩 New connection request from
                <strong>${activity.data.sender.name}</strong>
                <br>
                <small>${activity.date.toLocaleString()}</small>
            </p>
        `;

    } else {

        const connection = activity.data;

        const otherUser =
            connection.sender._id === currentUser._id
                ? connection.receiver
                : connection.sender;

        recentActivity.innerHTML += `
            <p>
                🤝 Connected with
                <strong>${otherUser.name}</strong>
                <br>
                <small>
    ${isNaN(activity.date.getTime())
        ? "Time unavailable"
        : activity.date.toLocaleString()}
</small>
            </p>
        `;
        }
});
        })
        .catch(error => {
            recentActivity.innerHTML =
                "<p>Activity load nahi ho pa rahi ❌</p>";
        });
    }
}