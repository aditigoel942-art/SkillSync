// ========================================================
// SKILLSWAP PRODUCTION SCRIPT & CORE UX ENGINE
// ========================================================

// --------------------------------------------------------
// 1. Toast Notification System (replaces native alert())
// --------------------------------------------------------
function initToastContainer() {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        document.body.appendChild(container);
    }
    return container;
}

function showToast(message, type = "info", duration = 3500) {
    const container = initToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    let iconSvg = "";
    if (type === "success") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    } else if (type === "error") {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    // Clean emojis from message if they were hardcoded in backend strings
    const cleanMessage = String(message || "")
        .replace(/[🎉❌🚀🤝✨🚪👤✏️]/g, "")
        .trim();

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-message">${escapeHtml(cleanMessage)}</div>
        <button class="toast-close" aria-label="Close notification">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger animation
    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    const closeBtn = toast.querySelector(".toast-close");
    const removeToast = () => {
        toast.classList.remove("show");
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 250);
    };

    closeBtn.addEventListener("click", removeToast);
    setTimeout(removeToast, duration);
}

// Seamlessly bridge window.alert() to modern toasts for non-intrusive feedback
const originalAlert = window.alert;
window.alert = function (msg) {
    if (!msg) return;
    const str = String(msg).toLowerCase();
    if (str.includes("success") || str.includes("sent") || str.includes("saved") || str.includes("created") || str.includes("accepted")) {
        showToast(msg, "success");
    } else if (str.includes("fail") || str.includes("error") || str.includes("not match") || str.includes("invalid") || str.includes("unauthorized") || str.includes("already sent")) {
        showToast(msg, "error");
    } else {
        showToast(msg, "info");
    }
};

// --------------------------------------------------------
// 2. Theme Management (Light & Dark Mode)
// --------------------------------------------------------
function getSavedTheme() {
    try {
        const saved = localStorage.getItem("skillswap_theme");
        if (saved === "dark" || saved === "light") {
            return saved;
        }
        // Fallback to system preference if user hasn't chosen
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            return "dark";
        }
    } catch (e) {
        // Fallback default
    }
    return "light";
}

function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "dark") {
        root.setAttribute("data-theme", "dark");
    } else {
        root.removeAttribute("data-theme");
    }
    try {
        localStorage.setItem("skillswap_theme", theme);
    } catch (e) {}

    // Update icons in any active toggle buttons on the page
    document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
        const isDark = theme === "dark";
        btn.setAttribute("title", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
        btn.setAttribute("aria-label", isDark ? "Switch to Light Mode" : "Switch to Dark Mode");
        btn.innerHTML = isDark
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
    });

    const mobileThemeLabel = document.getElementById("mobile-theme-text");
    if (mobileThemeLabel) {
        mobileThemeLabel.textContent = theme === "dark" ? "Light Mode" : "Dark Mode";
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    showToast(`Switched to ${next === "dark" ? "Dark" : "Light"} mode`, "info", 2000);
}

// Immediately apply saved theme on parse so there is zero flash
applyTheme(getSavedTheme());

// --------------------------------------------------------
// 3. Authentication & User Utilities
// --------------------------------------------------------
function escapeHtml(str) {
    if (!str) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getCurrentUser() {
    try {
        const userStr = localStorage.getItem("currentUser");
        if (!userStr) return null;
        const user = JSON.parse(userStr);
        if (!user || typeof user !== "object") return null;
        return user;
    } catch (e) {
        localStorage.removeItem("currentUser");
        return null;
    }
}

function getUserInitials(name) {
    if (!name) return "U";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function handleLogout(event) {
    if (event) event.preventDefault();
    localStorage.removeItem("currentUser");
    localStorage.removeItem("token");
    showToast("Signed out successfully", "info");
    setTimeout(() => {
        window.location.href = "index.html";
    }, 400);
}

function checkRouteAccess() {
    const publicPages = ["index.html", "login.html", "signup.html", "browse-skills.html", "profile.html", ""];
    const path = window.location.pathname;
    const page = path.substring(path.lastIndexOf("/") + 1).toLowerCase();

    const currentUser = getCurrentUser();
    const isPublicPage = publicPages.includes(page);

    // Protected route check
    if (!isPublicPage && !currentUser) {
        window.location.href = "login.html";
        return false;
    }

    return true;
}

// --------------------------------------------------------
// 3. Modern Navbar Renderer
// --------------------------------------------------------
function renderNavbar() {
    const nav = document.getElementById("main-nav");
    if (!nav) return;

    const currentUser = getCurrentUser();
    const path = window.location.pathname;
    const currentPage = path.substring(path.lastIndexOf("/") + 1).toLowerCase() || "index.html";

    // Clean SVG logo icon (interlocking exchange loop)
    const logoSvg = `
        <span class="nav-logo-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
                <path d="M16 3h5v5"></path>
                <path d="M4 20L21 3"></path>
                <path d="M21 16v5h-5"></path>
                <path d="M15 15l6 6"></path>
                <path d="M4 4l5 5"></path>
            </svg>
        </span>
    `;

    let linksHtml = "";
    let actionsHtml = "";
    let mobileMenuHtml = "";

    if (!currentUser) {
        // ==========================
        // LOGGED-OUT NAVIGATION
        // ==========================
        linksHtml = `
            <a href="index.html" class="nav-link ${currentPage === "index.html" ? "active-nav" : ""}">Home</a>
            <a href="browse-skills.html" class="nav-link ${currentPage === "browse-skills.html" ? "active-nav" : ""}">Discover</a>
            <a href="index.html#how-it-works" class="nav-link">How it works</a>
        `;

        const isCurrentDark = document.documentElement.getAttribute("data-theme") === "dark";
        const themeBtnTitle = isCurrentDark ? "Switch to Light Mode" : "Switch to Dark Mode";
        const themeIconSvg = isCurrentDark
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

        actionsHtml = `
            <button type="button" class="theme-toggle-btn" id="theme-toggle-nav" aria-label="${themeBtnTitle}" title="${themeBtnTitle}">
                ${themeIconSvg}
            </button>
            <a href="login.html" class="nav-btn-signin ${currentPage === "login.html" ? "active-nav" : ""}">Sign in</a>
            <a href="signup.html" class="nav-btn-signup">Get started</a>
        `;

        mobileMenuHtml = `
            <a href="index.html" class="mobile-link ${currentPage === "index.html" ? "active-nav" : ""}">Home</a>
            <a href="browse-skills.html" class="mobile-link ${currentPage === "browse-skills.html" ? "active-nav" : ""}">Discover</a>
            <a href="index.html#how-it-works" class="mobile-link">How it works</a>
            <button type="button" class="mobile-link" id="mobile-theme-toggle" style="display:flex; align-items:center; justify-content:space-between;">
                <span>Appearance</span>
                <span id="mobile-theme-text" style="font-size:0.85rem; opacity:0.8;">${isCurrentDark ? "Dark Mode" : "Light Mode"}</span>
            </button>
            <div class="mobile-divider"></div>
            <a href="login.html" class="mobile-link ${currentPage === "login.html" ? "active-nav" : ""}">Sign in</a>
            <a href="signup.html" class="mobile-link mobile-btn-primary">Get started</a>
        `;
    } else {
        // ==========================
        // LOGGED-IN NAVIGATION
        // ==========================
        const initials = getUserInitials(currentUser.name);
        const displayName = escapeHtml(currentUser.name || "My Account");
        const displayEmail = escapeHtml(currentUser.email || "");
        const profileUserId = currentUser._id || "";
        const isCurrentDark = document.documentElement.getAttribute("data-theme") === "dark";
        const themeBtnTitle = isCurrentDark ? "Switch to Light Mode" : "Switch to Dark Mode";
        const themeIconSvg = isCurrentDark
            ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

        linksHtml = `
            <a href="index.html" class="nav-link ${currentPage === "index.html" ? "active-nav" : ""}">Home</a>
            <a href="browse-skills.html" class="nav-link ${currentPage === "browse-skills.html" ? "active-nav" : ""}">Discover</a>
            <a href="connections.html" class="nav-link ${currentPage === "connections.html" ? "active-nav" : ""}">
                Connections
            </a>
            <a href="chat.html" class="nav-link ${currentPage === "chat.html" ? "active-nav" : ""}">
                Messages
            </a>
        `;

        actionsHtml = `
            <button type="button" class="theme-toggle-btn" id="theme-toggle-nav" aria-label="${themeBtnTitle}" title="${themeBtnTitle}">
                ${themeIconSvg}
            </button>
            <div class="profile-dropdown-wrapper" id="profile-dropdown-wrapper">
                <button type="button" class="profile-trigger-btn" id="profile-trigger-btn" aria-haspopup="true" aria-expanded="false" title="Account Menu">
                    <span class="user-avatar-badge">${initials}</span>
                    <span class="user-name-label">${displayName}</span>
                    <span class="chevron-icon">▾</span>
                </button>
                <div class="profile-dropdown-menu" id="profile-dropdown-menu">
                    <div class="dropdown-user-header">
                        <div class="dropdown-avatar">${initials}</div>
                        <div class="dropdown-user-details">
                            <div class="dropdown-user-name">${displayName}</div>
                            <div class="dropdown-user-email">${displayEmail}</div>
                        </div>
                    </div>
                    <div class="dropdown-divider"></div>
                    <a href="dashboard.html" class="dropdown-item ${currentPage === "dashboard.html" ? "active-nav" : ""}">
                        <svg class="dropdown-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="9"></rect><rect x="14" y="3" width="7" height="5"></rect><rect x="14" y="12" width="7" height="9"></rect><rect x="3" y="16" width="7" height="5"></rect></svg>
                        <span>Dashboard</span>
                    </a>
                    <a href="profile.html?id=${profileUserId}" class="dropdown-item ${currentPage === "profile.html" ? "active-nav" : ""}">
                        <svg class="dropdown-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                        <span>My Profile</span>
                    </a>
                    <a href="signup.html" class="dropdown-item">
                        <svg class="dropdown-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                        <span>Edit Profile</span>
                    </a>
                    <button type="button" class="dropdown-item" id="theme-toggle-dropdown" style="display:flex; align-items:center; justify-content:space-between;">
                        <span style="display:flex; align-items:center; gap:var(--space-3);">
                            <span class="dropdown-icon-svg" style="display:flex; align-items:center;">${themeIconSvg}</span>
                            <span>Theme</span>
                        </span>
                        <span style="font-size:0.75rem; color:var(--text-muted);">${isCurrentDark ? "Dark" : "Light"}</span>
                    </button>
                    <div class="dropdown-divider"></div>
                    <button type="button" class="dropdown-item dropdown-logout-btn" id="logout-btn">
                        <svg class="dropdown-icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        <span>Sign out</span>
                    </button>
                </div>
            </div>
        `;

        mobileMenuHtml = `
            <div class="mobile-user-card">
                <div class="dropdown-avatar">${initials}</div>
                <div class="dropdown-user-details">
                    <div class="dropdown-user-name">${displayName}</div>
                    <div class="dropdown-user-email">${displayEmail}</div>
                </div>
            </div>
            <a href="index.html" class="mobile-link ${currentPage === "index.html" ? "active-nav" : ""}">Home</a>
            <a href="browse-skills.html" class="mobile-link ${currentPage === "browse-skills.html" ? "active-nav" : ""}">Discover</a>
            <a href="connections.html" class="mobile-link ${currentPage === "connections.html" ? "active-nav" : ""}">Connections</a>
            <a href="chat.html" class="mobile-link ${currentPage === "chat.html" ? "active-nav" : ""}">Messages</a>
            <div class="mobile-divider"></div>
            <a href="dashboard.html" class="mobile-link ${currentPage === "dashboard.html" ? "active-nav" : ""}">Dashboard</a>
            <a href="profile.html?id=${profileUserId}" class="mobile-link ${currentPage === "profile.html" ? "active-nav" : ""}">My Profile</a>
            <a href="signup.html" class="mobile-link">Edit Profile</a>
            <button type="button" class="mobile-link" id="mobile-theme-toggle" style="display:flex; align-items:center; justify-content:space-between;">
                <span>Appearance</span>
                <span id="mobile-theme-text" style="font-size:0.85rem; opacity:0.8;">${isCurrentDark ? "Dark Mode" : "Light Mode"}</span>
            </button>
            <div class="mobile-divider"></div>
            <button type="button" class="mobile-link mobile-logout-btn" id="mobile-logout-btn">Sign out</button>
        `;
    }

    nav.innerHTML = `
        <div class="nav-container">
            <a href="index.html" class="nav-logo">
                ${logoSvg}
                <span class="nav-logo-text">Skill<span>Swap</span></span>
            </a>

            <div class="nav-links" id="nav-links">
                ${linksHtml}
            </div>

            <div class="nav-actions" id="nav-actions">
                ${actionsHtml}
            </div>

            <button type="button" class="nav-mobile-toggle" id="nav-mobile-toggle" aria-label="Toggle navigation menu" aria-expanded="false">
                <span class="hamburger-bar"></span>
                <span class="hamburger-bar"></span>
                <span class="hamburger-bar"></span>
            </button>
        </div>

        <div class="nav-mobile-menu" id="nav-mobile-menu">
            ${mobileMenuHtml}
        </div>
    `;

    setupNavbarEvents();
}

function setupNavbarEvents() {
    const profileTrigger = document.getElementById("profile-trigger-btn");
    const profileMenu = document.getElementById("profile-dropdown-menu");

    if (profileTrigger && profileMenu) {
        profileTrigger.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = profileMenu.classList.contains("show");
            if (isOpen) {
                profileMenu.classList.remove("show");
                profileTrigger.classList.remove("open");
                profileTrigger.setAttribute("aria-expanded", "false");
            } else {
                profileMenu.classList.add("show");
                profileTrigger.classList.add("open");
                profileTrigger.setAttribute("aria-expanded", "true");
            }
        });

        document.addEventListener("click", (e) => {
            if (!profileTrigger.contains(e.target) && !profileMenu.contains(e.target)) {
                profileMenu.classList.remove("show");
                profileTrigger.classList.remove("open");
                profileTrigger.setAttribute("aria-expanded", "false");
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && profileMenu.classList.contains("show")) {
                profileMenu.classList.remove("show");
                profileTrigger.classList.remove("open");
                profileTrigger.setAttribute("aria-expanded", "false");
            }
        });
    }

    const mobileToggle = document.getElementById("nav-mobile-toggle");
    const mobileMenu = document.getElementById("nav-mobile-menu");

    if (mobileToggle && mobileMenu) {
        mobileToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = mobileMenu.classList.contains("open");
            if (isOpen) {
                mobileMenu.classList.remove("open");
                mobileToggle.classList.remove("open");
                mobileToggle.setAttribute("aria-expanded", "false");
            } else {
                mobileMenu.classList.add("open");
                mobileToggle.classList.add("open");
                mobileToggle.setAttribute("aria-expanded", "true");
            }
        });

        document.addEventListener("click", (e) => {
            if (!mobileToggle.contains(e.target) && !mobileMenu.contains(e.target)) {
                mobileMenu.classList.remove("open");
                mobileToggle.classList.remove("open");
                mobileToggle.setAttribute("aria-expanded", "false");
            }
        });
    }

    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", handleLogout);

    const mobileLogoutBtn = document.getElementById("mobile-logout-btn");
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener("click", handleLogout);

    // Theme Toggle Handlers
    const themeNavBtn = document.getElementById("theme-toggle-nav");
    if (themeNavBtn) {
        themeNavBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleTheme();
        });
    }

    const themeDropdownBtn = document.getElementById("theme-toggle-dropdown");
    if (themeDropdownBtn) {
        themeDropdownBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleTheme();
        });
    }

    const mobileThemeToggle = document.getElementById("mobile-theme-toggle");
    if (mobileThemeToggle) {
        mobileThemeToggle.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleTheme();
        });
    }
}

// --------------------------------------------------------
// 4. Hero CTA Logic
// --------------------------------------------------------
function initHeroCTA() {
    const heroCtaGroup = document.getElementById("hero-cta-group");
    if (!heroCtaGroup) return;

    const currentUser = getCurrentUser();
    if (currentUser) {
        heroCtaGroup.innerHTML = `
            <a href="browse-skills.html" class="btn btn-primary btn-lg" id="hero-primary-cta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Find a skill
            </a>
            <a href="dashboard.html" class="btn btn-secondary btn-lg" id="hero-secondary-cta">
                Go to Dashboard
            </a>
        `;
    } else {
        heroCtaGroup.innerHTML = `
            <a href="browse-skills.html" class="btn btn-primary btn-lg" id="hero-primary-cta">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                Find a skill
            </a>
            <a href="signup.html" class="btn btn-secondary btn-lg" id="hero-secondary-cta">
                Create your profile
            </a>
        `;
    }
}

// --------------------------------------------------------
// 5. Profile Edit Pre-fill
// --------------------------------------------------------
function initEditProfilePrefill() {
    const currentUser = getCurrentUser();
    if (currentUser && document.getElementById("name") && document.getElementById("signup-form")) {
        const nameInput = document.getElementById("name");
        const emailInput = document.getElementById("email");
        const teachSkillsInput = document.getElementById("teachSkills");
        const learnSkillsInput = document.getElementById("learnSkills");
        const locationInput = document.getElementById("location");
        const bioInput = document.getElementById("bio");
        const heading = document.querySelector(".signup-heading h1");
        const sub = document.querySelector(".signup-heading p");
        const submitBtn = document.querySelector(".create-account-btn");

        if (heading) heading.textContent = "Edit Your Profile";
        if (sub) sub.textContent = "Update your skill swap interests and community bio";
        if (submitBtn) submitBtn.textContent = "Save Changes";

        if (nameInput && !nameInput.value) nameInput.value = currentUser.name || "";
        if (emailInput && !emailInput.value) emailInput.value = currentUser.email || "";
        if (locationInput && !locationInput.value) locationInput.value = currentUser.location || "";
        if (bioInput && !bioInput.value) bioInput.value = currentUser.bio || "";
        if (teachSkillsInput && !teachSkillsInput.value && currentUser.teachSkills) {
            teachSkillsInput.value = currentUser.teachSkills.join(", ");
        }
        if (learnSkillsInput && !learnSkillsInput.value && currentUser.learnSkills) {
            learnSkillsInput.value = currentUser.learnSkills.join(", ");
        }
    }
}

// --------------------------------------------------------
// 6. Signup / Profile Save Form
// --------------------------------------------------------
const signupForm = document.getElementById("signup-form");
if (signupForm) {
    signupForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const currentUser = getCurrentUser();
        const isEditing = !!(currentUser && currentUser._id);

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        const teachSkills = document.getElementById("teachSkills").value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        const learnSkills = document.getElementById("learnSkills").value
            .split(",")
            .map(s => s.trim())
            .filter(Boolean);

        const passwordInput = document.getElementById("password");
        const confirmPasswordInput = document.getElementById("confirmPassword");
        const password = passwordInput ? passwordInput.value : "";
        const confirmPassword = confirmPasswordInput ? confirmPasswordInput.value : "";
        const location = document.getElementById("location") ? document.getElementById("location").value.trim() : "";
        const bio = document.getElementById("bio") ? document.getElementById("bio").value.trim() : "";

        if (!isEditing && password !== confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }

        if (isEditing && password && password !== confirmPassword) {
            showToast("Passwords do not match", "error");
            return;
        }

        try {
            const endpoint = isEditing ? `/api/users/${currentUser._id}` : "/api/users";
            const method = isEditing ? "PUT" : "POST";

            const bodyPayload = {
                name,
                email,
                location,
                bio,
                teachSkills,
                learnSkills
            };

            if (password) {
                bodyPayload.password = password;
            } else if (!isEditing) {
                showToast("Please enter a password", "error");
                return;
            }

            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(bodyPayload)
            });

            const data = await response.json();

            if (response.ok) {
                const updatedUser = data.user || {
                    ...(currentUser || {}),
                    ...bodyPayload
                };
                localStorage.setItem("currentUser", JSON.stringify(updatedUser));
                if (data.token) {
                    localStorage.setItem("token", data.token);
                }

                showToast(isEditing ? "Profile updated successfully!" : "Profile created successfully! Welcome to SkillSwap.", "success");
                signupForm.reset();
                setTimeout(() => {
                    window.location.href = "profile.html?id=" + updatedUser._id;
                }, 600);
            } else {
                showToast(data.message || "Failed to save profile", "error");
            }
        } catch (error) {
            console.error("Profile save error:", error);
            showToast("Unable to reach the server. Please check your connection.", "error");
        }
    });
}

// --------------------------------------------------------
// 7. Login Form
// --------------------------------------------------------
const loginForm = document.getElementById("login-form");
if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("loginPassword").value;
        const messageEl = document.getElementById("login-message");

        try {
            const response = await fetch("/api/login", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                showToast("Login successful!", "success");
                if (messageEl) {
                    messageEl.style.color = "var(--success)";
                    messageEl.textContent = "Login successful!";
                }

                localStorage.setItem("currentUser", JSON.stringify(data.user));
                if (data.token) {
                    localStorage.setItem("token", data.token);
                }
                setTimeout(() => {
                    window.location.href = "dashboard.html";
                }, 600);
            } else {
                showToast(data.message || "Invalid credentials", "error");
                if (messageEl) {
                    messageEl.style.color = "var(--danger)";
                    messageEl.textContent = data.message || "Invalid credentials";
                }
            }
        } catch (error) {
            console.error("Login error:", error);
            showToast("Unable to reach the server. Please check if the backend is running.", "error");
            if (messageEl) {
                messageEl.style.color = "var(--danger)";
                messageEl.textContent = "Unable to connect to server.";
            }
        }
    });
}

// --------------------------------------------------------
// 8. Connections Management
// --------------------------------------------------------
const connectionsContainer = document.getElementById("connections-container");
if (connectionsContainer) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        connectionsContainer.innerHTML = `
            <div class="empty-state">
                <p>Please <a href="login.html">sign in</a> to manage your connections.</p>
            </div>
        `;
    } else {
        loadConnections(currentUser._id);
    }
}

async function loadConnections(userId) {
    const container = document.getElementById("connections-container");
    if (!container) return;

    try {
        const response = await fetch(`/api/connections/${userId}`);
        const connections = await response.json();

        container.innerHTML = "";

        const pendingRequests = connections.filter(c => c.status === "pending");

        if (!pendingRequests || pendingRequests.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                    </div>
                    <h3>No pending requests</h3>
                    <p>When someone wants to exchange skills with you, their request will appear here.</p>
                    <a href="browse-skills.html" class="btn btn-primary btn-sm">Discover Skills</a>
                </div>
            `;
            return;
        }

        pendingRequests.forEach(connection => {
            const senderName = connection.sender ? connection.sender.name : "Skill Member";
            const senderEmail = connection.sender ? connection.sender.email : "";
            const initials = getUserInitials(senderName);

            const card = document.createElement("div");
            card.className = "connection-card";
            card.innerHTML = `
                <div class="connection-card-header">
                    <div class="connection-avatar">${initials}</div>
                    <div>
                        <h3>${escapeHtml(senderName)}</h3>
                        <p>${escapeHtml(senderEmail)}</p>
                    </div>
                </div>
                <div class="connection-actions">
                    <button class="btn btn-success accept-btn" data-id="${connection._id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        Accept
                    </button>
                    <button class="btn btn-danger reject-btn" data-id="${connection._id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        Decline
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

        // Event delegation for accept/reject
        container.querySelectorAll(".accept-btn").forEach(btn => {
            btn.addEventListener("click", () => updateConnectionStatus(btn.dataset.id, "accepted"));
        });

        container.querySelectorAll(".reject-btn").forEach(btn => {
            btn.addEventListener("click", () => updateConnectionStatus(btn.dataset.id, "rejected"));
        });

    } catch (error) {
        console.error("Error loading connections:", error);
        container.innerHTML = `
            <div class="empty-state">
                <h3>Unable to load requests</h3>
                <p>Please verify that the SkillSwap backend server is running.</p>
            </div>
        `;
    }
}

async function updateConnectionStatus(connectionId, status) {
    try {
        const response = await fetch(`/api/connections/${connectionId}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ status })
        });

        const data = await response.json();
        showToast(data.message || `Connection ${status}`, "success");

        const currentUser = getCurrentUser();
        if (currentUser) {
            loadConnections(currentUser._id);
            loadAcceptedConnections(currentUser._id);
        }
    } catch (error) {
        console.error("Connection update error:", error);
        showToast("Failed to update connection status", "error");
    }
}

// --------------------------------------------------------
// 9. Accepted Connections
// --------------------------------------------------------
const acceptedContainer = document.getElementById("accepted-connections-container");
if (acceptedContainer) {
    const currentUser = getCurrentUser();
    if (currentUser) {
        loadAcceptedConnections(currentUser._id);
    }
}

async function loadAcceptedConnections(userId) {
    const container = document.getElementById("accepted-connections-container");
    if (!container) return;

    try {
        const response = await fetch(`/api/accepted-connections/${userId}`);
        const connections = await response.json();

        container.innerHTML = "";

        if (!connections || connections.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                    </div>
                    <h3>Your network starts here</h3>
                    <p>Discover people who share your learning goals and connect to start exchanging skills.</p>
                    <a href="browse-skills.html" class="btn btn-primary btn-sm">Browse Skills</a>
                </div>
            `;
            return;
        }

        connections.forEach(connection => {
            const otherUser = connection.sender._id === userId ? connection.receiver : connection.sender;
            const initials = getUserInitials(otherUser.name);

            const teachBadges = otherUser.teachSkills && otherUser.teachSkills.length > 0
                ? otherUser.teachSkills.map(s => `<span class="skill-badge">${escapeHtml(s)}</span>`).join(" ")
                : "";

            const learnBadges = otherUser.learnSkills && otherUser.learnSkills.length > 0
                ? otherUser.learnSkills.map(s => `<span class="badge badge-learn">${escapeHtml(s)}</span>`).join(" ")
                : "";

            const card = document.createElement("div");
            card.className = "connection-card";
            card.innerHTML = `
                <div class="connection-card-header">
                    <div class="connection-avatar">${initials}</div>
                    <div>
                        <h3>${escapeHtml(otherUser.name)}</h3>
                        <p>${escapeHtml(otherUser.email)}</p>
                    </div>
                </div>

                ${teachBadges ? `
                    <div class="skill-section-block">
                        <span class="skill-section-label">Can Teach</span>
                        <div class="skill-tags-group">${teachBadges}</div>
                    </div>
                ` : ""}

                ${learnBadges ? `
                    <div class="skill-section-block">
                        <span class="skill-section-label">Wants to Learn</span>
                        <div class="skill-tags-group">${learnBadges}</div>
                    </div>
                ` : ""}

                <div class="connection-actions">
                    <a href="chat.html?connectionId=${connection._id}" class="btn btn-secondary action-btn chat-btn">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        Messages
                    </a>
                    <button class="btn btn-primary action-btn live-btn" onclick="startLiveSession('${connection._id}', '${otherUser._id}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                        Start Session
                    </button>
                </div>
            `;
            container.appendChild(card);
        });

    } catch (error) {
        console.error("Error loading accepted connections:", error);
        container.innerHTML = `
            <div class="empty-state">
                <h3>Connections could not be loaded</h3>
                <p>Please check your connection to the server.</p>
            </div>
        `;
    }
}

// --------------------------------------------------------
// 10. Live Session Initiation
// --------------------------------------------------------
async function startLiveSession(connectionId, participantId) {
    const token = localStorage.getItem("token");
    if (!token) {
        showToast("Please log in to start a live session", "error");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 500);
        return;
    }

    try {
        const response = await fetch("/api/live-sessions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ connectionId, participantId })
        });

        const data = await response.json();

        if (response.ok && data.session) {
            window.location.href = `live-session.html?sessionId=${data.session._id}`;
        } else {
            showToast(data.message || "Failed to start live session", "error");
        }
    } catch (err) {
        console.error("Live session start error:", err);
        showToast("Unable to start live session. Please check if server is running.", "error");
    }
}

// --------------------------------------------------------
// 11. Dashboard Population
// --------------------------------------------------------
function initDashboard() {
    const dashboardUser = document.getElementById("dashboard-user");
    const currentUser = getCurrentUser();

    if (dashboardUser) {
        if (!currentUser) {
            dashboardUser.innerHTML = "<p>Please sign in to view your dashboard.</p>";
            return;
        }

        // Fetch latest fresh user data from server if available
        if (currentUser._id) {
            fetch(`/api/users/${currentUser._id}`)
                .then(r => r.ok ? r.json() : null)
                .then(freshUser => {
                    if (freshUser) {
                        localStorage.setItem("currentUser", JSON.stringify(freshUser));
                    }
                })
                .catch(() => {});
        }

        // Set dynamic greeting in header if greeting element exists
        const headerGreeting = document.querySelector(".dashboard-header h1");
        if (headerGreeting) {
            const hour = new Date().getHours();
            const timeGreeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
            const firstName = currentUser.name ? currentUser.name.split(" ")[0] : "Learner";
            headerGreeting.textContent = `${timeGreeting}, ${firstName}`;
        }

        const teachBadges = currentUser.teachSkills && currentUser.teachSkills.length > 0
            ? currentUser.teachSkills.map(s => `<span class="badge badge-teach">${escapeHtml(s)}</span>`).join(" ")
            : "<span class='text-muted'>No skills added yet</span>";

        const learnBadges = currentUser.learnSkills && currentUser.learnSkills.length > 0
            ? currentUser.learnSkills.map(s => `<span class="badge badge-learn">${escapeHtml(s)}</span>`).join(" ")
            : "<span class='text-muted'>No skills added yet</span>";

        dashboardUser.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; margin-bottom:12px;">
                <div class="dropdown-avatar" style="width:48px; height:48px; font-size:1.1rem;">
                    ${getUserInitials(currentUser.name)}
                </div>
                <div>
                    <h2>${escapeHtml(currentUser.name)}</h2>
                    <p class="text-sm text-muted">${escapeHtml(currentUser.email)}</p>
                </div>
            </div>

            <div style="margin-top:10px;">
                <p class="text-xs text-muted" style="text-transform:uppercase; font-weight:700; margin-bottom:6px;">Can Teach</p>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">${teachBadges}</div>

                <p class="text-xs text-muted" style="text-transform:uppercase; font-weight:700; margin-bottom:6px;">Wants to Learn</p>
                <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:12px;">${learnBadges}</div>

                <p style="margin-top:10px;">
                    <strong>Location:</strong> ${escapeHtml(currentUser.location || "Not specified")}
                </p>

                <p style="margin-top:6px;">
                    <strong>Bio:</strong> ${escapeHtml(currentUser.bio || "No bio added yet.")}
                </p>
            </div>
        `;
    }

    // Skills Offered and Wanted cards
    const skillsOffered = document.getElementById("skills-offered");
    const skillsWanted = document.getElementById("skills-wanted");

    if (skillsOffered && skillsWanted && currentUser) {
        const verifiedSkills = currentUser.verifiedSkills || [];

        skillsOffered.innerHTML = (currentUser.teachSkills && currentUser.teachSkills.length > 0)
            ? currentUser.teachSkills.map(skill => {
                const verified = verifiedSkills.find(v => v.skill && v.skill.toLowerCase() === skill.toLowerCase());
                if (verified) {
                    const levelLabel = verified.verificationLevel || "Practically Assessed";
                    return `
                        <div class="skill-item-row">
                            <div>
                                <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">${escapeHtml(skill)}</span>
                                <div style="display:flex; align-items:center; gap:6px; margin-top:4px; flex-wrap:wrap;">
                                    <span class="badge-verification-level badge-practical-level" title="Live AI-Proctored Evidence">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="11" height="11"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                        ${escapeHtml(levelLabel)}
                                    </span>
                                    <span class="badge-level badge-level-${(verified.estimatedLevel || "intermediate").toLowerCase()}">
                                        ${verified.estimatedLevel || "Intermediate"} (${verified.score}/100)
                                    </span>
                                </div>
                            </div>
                            <button class="btn btn-secondary btn-sm" onclick="startSkillVerification('${escapeHtml(skill)}')">
                                Retake Proctored Test
                            </button>
                        </div>
                    `;
                }

                return `
                    <div class="skill-item-row">
                        <div>
                            <span style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">${escapeHtml(skill)}</span>
                            <div style="margin-top:4px;">
                                <span class="badge-self-reported">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="11" height="11"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                    Self-reported (Not assessed)
                                </span>
                            </div>
                        </div>
                        <button class="btn btn-primary btn-sm" onclick="startSkillVerification('${escapeHtml(skill)}')">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            Verify with AI Proctor
                        </button>
                    </div>
                `;
            }).join("")
            : "<p class='text-muted'>No skills added yet. Edit your profile to list skills you can teach!</p>";

        skillsWanted.innerHTML = (currentUser.learnSkills && currentUser.learnSkills.length > 0)
            ? currentUser.learnSkills.map(skill => `
                <div style="padding:10px 14px; margin-bottom:8px; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:var(--radius-md); font-weight:500; display:flex; align-items:center; gap:8px;">
                    <span style="width:8px; height:8px; border-radius:50%; background:var(--success);"></span>
                    <span>${escapeHtml(skill)}</span>
                </div>
            `).join("")
            : "<p class='text-muted'>No skills added yet</p>";
    }

    // Stats: Connections Count
    const totalConnections = document.getElementById("total-connections");
    if (totalConnections && currentUser) {
        fetch(`/api/accepted-connections/${currentUser._id}`)
            .then(res => res.json())
            .then(connections => {
                totalConnections.textContent = connections.length;
            })
            .catch(err => console.error(err));
    }

    // Stats: Pending Requests Count
    const pendingRequests = document.getElementById("pending-requests");
    if (pendingRequests && currentUser) {
        fetch(`/api/connections/${currentUser._id}`)
            .then(res => res.json())
            .then(connections => {
                const pending = connections.filter(c => c.status === "pending");
                pendingRequests.textContent = pending.length;
            })
            .catch(err => console.error(err));
    }

    // Stats: Skills Count
    const skillsCount = document.getElementById("skills-count");
    if (skillsCount && currentUser) {
        skillsCount.textContent = (currentUser.teachSkills || []).length;
    }

    // Dynamic Community Rating & Verified Reviews for Logged-in User Dashboard
    const ratingValEl = document.getElementById("community-rating-val");
    const ratingCountEl = document.getElementById("community-rating-count");
    const dashboardReviewsList = document.getElementById("dashboard-reviews-list");
    const reviewsHeaderSummary = document.getElementById("reviews-header-summary");

    if (currentUser && (ratingValEl || dashboardReviewsList)) {
        fetch(`/api/reviews/user/${currentUser._id}`)
            .then(res => res.json())
            .then(data => {
                if (ratingValEl) {
                    ratingValEl.textContent = data.averageRating ? data.averageRating.toFixed(1) : "5.0";
                }
                if (ratingCountEl) {
                    const count = data.totalReviews || 0;
                    ratingCountEl.textContent = count === 1 ? "1 verified review" : `${count} verified reviews`;
                }
                if (reviewsHeaderSummary) {
                    reviewsHeaderSummary.innerHTML = `
                        <div style="display:flex; align-items:center; gap:6px; background:rgba(245,158,11,0.12); padding:4px 10px; border-radius:var(--radius-full); border:1px solid rgba(245,158,11,0.25);">
                            <span style="color:#fbbf24; font-size:0.9rem;">★</span>
                            <span style="font-weight:700; font-size:0.85rem; color:#d97706;">${data.averageRating.toFixed(1)} / 5</span>
                            <span style="font-size:0.75rem; color:var(--text-muted);">(${data.totalReviews} reviews)</span>
                        </div>
                    `;
                }

                if (dashboardReviewsList) {
                    const reviews = data.reviews || [];
                    if (reviews.length === 0) {
                        dashboardReviewsList.innerHTML = `
                            <div style="padding:20px; text-align:center; background:var(--bg-page); border:1px dashed var(--border-subtle); border-radius:var(--radius-card); color:var(--text-muted);">
                                <p style="margin:0 0 4px; font-weight:600; color:var(--text-secondary);">No session reviews yet</p>
                                <p style="font-size:0.85rem; margin:0;">Complete a live exchange session to start receiving peer ratings & reviews!</p>
                            </div>
                        `;
                    } else {
                        dashboardReviewsList.innerHTML = reviews.map(r => {
                            const reviewerName = r.reviewer ? (r.reviewer.name || "Peer Learner") : "Peer Learner";
                            const reviewerInitials = getUserInitials(reviewerName);
                            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
                            const dateFormatted = new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

                            return `
                                <div style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-card); padding:16px;">
                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
                                        <div style="display:flex; align-items:center; gap:10px;">
                                            <div class="dropdown-avatar" style="width:34px; height:34px; font-size:0.85rem;">${reviewerInitials}</div>
                                            <div>
                                                <div style="font-weight:600; font-size:0.95rem; color:var(--text-primary);">${escapeHtml(reviewerName)}</div>
                                                <div style="font-size:0.75rem; color:var(--text-muted);">${dateFormatted} • Exchange: <span style="color:var(--primary); font-weight:600;">${escapeHtml(r.skillTopic || "Skill Exchange")}</span></div>
                                            </div>
                                        </div>
                                        <div style="display:flex; align-items:center; gap:6px;">
                                            <span style="color:#fbbf24; font-size:1rem; letter-spacing:1px;">${stars}</span>
                                            <span style="font-size:0.85rem; font-weight:700; color:var(--text-primary);">${r.rating}.0</span>
                                        </div>
                                    </div>
                                    <p style="font-size:0.9rem; color:var(--text-secondary); margin:0; line-height:1.5;">${escapeHtml(r.feedback || "Great peer exchange session!")}</p>
                                </div>
                            `;
                        }).join("");
                    }
                }
            })
            .catch(err => console.error("Error loading user rating:", err));
    }

    // Dashboard Recent Activity
    const recentActivity = document.getElementById("recent-activity");
    if (recentActivity && currentUser) {
        Promise.all([
            fetch(`/api/accepted-connections/${currentUser._id}`).then(r => r.json()),
            fetch(`/api/connections/${currentUser._id}`).then(r => r.json())
        ])
        .then(([acceptedConnections, requests]) => {
            const activities = [
                ...acceptedConnections.map(c => ({
                    type: "accepted",
                    data: c,
                    date: new Date(c.createdAt || Date.now())
                })),
                ...requests
                    .filter(c => c.status === "pending")
                    .map(c => ({
                        type: "pending",
                        data: c,
                        date: new Date(c.createdAt || Date.now())
                    }))
            ];

            activities.sort((a, b) => b.date - a.date);

            recentActivity.innerHTML = "";

            if (activities.length === 0) {
                recentActivity.innerHTML = `
                    <div style="padding:16px; text-align:center; color:var(--text-muted);">
                        <p>No recent activity yet. When you receive or accept requests, they will appear here.</p>
                    </div>
                `;
                return;
            }

            activities.slice(0, 5).forEach(activity => {
                if (activity.type === "pending") {
                    const senderName = activity.data.sender ? activity.data.sender.name : "A member";
                    recentActivity.innerHTML += `
                        <div class="activity-item">
                            <div class="activity-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            </div>
                            <div style="flex:1;">
                                <p style="margin:0;">Connection request from <strong>${escapeHtml(senderName)}</strong></p>
                                <span class="text-xs text-muted">${activity.date.toLocaleDateString()}</span>
                            </div>
                        </div>
                    `;
                } else {
                    const otherUser = activity.data.sender._id === currentUser._id
                        ? activity.data.receiver
                        : activity.data.sender;
                    const partnerName = otherUser ? otherUser.name : "Partner";

                    recentActivity.innerHTML += `
                        <div class="activity-item">
                            <div class="activity-icon" style="color:var(--success);">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </div>
                            <div style="flex:1;">
                                <p style="margin:0;">Connected with <strong>${escapeHtml(partnerName)}</strong></p>
                                <span class="text-xs text-muted">${activity.date.toLocaleDateString()}</span>
                            </div>
                        </div>
                    `;
                }
            });
        })
        .catch(err => {
            console.error("Recent activity load error:", err);
            recentActivity.innerHTML = "<p class='text-muted'>Unable to load recent activity</p>";
        });
    }
}

// --------------------------------------------------------
// 12. Direct Connect Helper
// --------------------------------------------------------
async function sendDirectConnectionRequest(receiverId, buttonEl) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showToast("Please sign in to connect with members", "info");
        setTimeout(() => {
            window.location.href = "login.html";
        }, 500);
        return;
    }

    if (currentUser._id === receiverId) {
        showToast("You cannot connect with your own profile", "info");
        return;
    }

    try {
        if (buttonEl) {
            buttonEl.disabled = true;
            buttonEl.textContent = "Sending...";
        }

        const response = await fetch("/api/connections", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                sender: currentUser._id,
                receiver: receiverId
            })
        });

        const data = await response.json();

        if (response.ok) {
            showToast("Connection request sent successfully!", "success");
            if (buttonEl) {
                buttonEl.textContent = "Request Sent ✓";
                buttonEl.classList.remove("btn-primary");
                buttonEl.classList.add("btn-secondary");
            }
        } else {
            showToast(data.message || "Request already sent", "info");
            if (buttonEl) {
                buttonEl.textContent = "Connected / Pending";
            }
        }
    } catch (error) {
        console.error("Connect error:", error);
        showToast("Failed to send connection request", "error");
        if (buttonEl) {
            buttonEl.disabled = false;
            buttonEl.textContent = "Connect";
        }
    }
}

// --------------------------------------------------------
// 13. Dynamic Home Page Community Ratings
// --------------------------------------------------------
async function initHomePageCommunityRatings() {
    const gridEl = document.getElementById("home-reviews-grid");
    const avgRatingEl = document.getElementById("home-avg-rating");
    const totalCountEl = document.getElementById("home-total-reviews-count");
    const badgeEl = document.getElementById("home-community-badge");
    const totalSessionsEl = document.getElementById("home-total-sessions");

    if (!gridEl) return;

    try {
        const res = await fetch("/api/reviews/community");
        const data = await res.json();

        if (avgRatingEl && data.averageRating) {
            avgRatingEl.textContent = data.averageRating.toFixed(1);
        }

        if (totalCountEl && typeof data.totalReviews === "number") {
            const cnt = data.totalReviews;
            totalCountEl.textContent = cnt === 1 ? "Based on 1 verified session" : `Based on ${cnt} verified sessions`;
        }

        if (badgeEl && data.averageRating) {
            badgeEl.textContent = `${data.averageRating.toFixed(1)} / 5 Community Rating`;
        }

        if (totalSessionsEl && typeof data.totalSessions === "number") {
            totalSessionsEl.textContent = `${data.totalSessions} Sessions`;
        }

        const reviews = data.recentReviews || [];
        if (reviews.length === 0) {
            gridEl.innerHTML = `
                <div style="grid-column: 1 / -1; padding:24px; text-align:center; background:var(--bg-page); border:1px dashed var(--border-subtle); border-radius:var(--radius-card); color:var(--text-muted);">
                    <p style="margin:0 0 6px; font-weight:600; color:var(--text-secondary);">Peer reviews are generating as members complete sessions.</p>
                    <p style="margin:0; font-size:0.85rem;">Be among the first to connect, exchange knowledge, and leave feedback!</p>
                </div>
            `;
            return;
        }

        gridEl.innerHTML = reviews.slice(0, 6).map(r => {
            const reviewerName = r.reviewer ? (r.reviewer.name || "Member") : "Member";
            const revieweeName = r.reviewee ? (r.reviewee.name || "Mentor") : "Mentor";
            const initials = getUserInitials(reviewerName);
            const stars = "★".repeat(r.rating) + "☆".repeat(5 - r.rating);
            const dateStr = new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });

            return `
                <div style="background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-card); padding:20px; display:flex; flex-direction:column; justify-content:space-between; transition:transform var(--transition-fast), border-color var(--transition-fast);">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <div class="dropdown-avatar" style="width:38px; height:38px; font-size:0.9rem;">${initials}</div>
                                <div>
                                    <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${escapeHtml(reviewerName)}</div>
                                    <div style="font-size:0.75rem; color:var(--text-muted);">Learned with <strong>${escapeHtml(revieweeName)}</strong></div>
                                </div>
                            </div>
                            <div style="text-align:right;">
                                <div style="color:#fbbf24; font-size:0.95rem; line-height:1;">${stars}</div>
                                <span style="font-size:0.7rem; color:var(--text-light);">${dateStr}</span>
                            </div>
                        </div>

                        <div style="display:inline-block; font-size:0.75rem; font-weight:600; color:var(--primary); background:rgba(99,102,241,0.12); padding:2px 8px; border-radius:var(--radius-full); margin-bottom:10px;">
                            ${escapeHtml(r.skillTopic || "Skill Exchange")}
                        </div>

                        <p style="font-size:0.9rem; color:var(--text-secondary); line-height:1.55; margin:0;">
                            "${escapeHtml(r.feedback || "Insightful and productive session. Learned a lot from this exchange!")}"
                        </p>
                    </div>

                    <div style="margin-top:14px; padding-top:10px; border-top:1px solid var(--border-subtle); display:flex; align-items:center; justify-content:space-between; font-size:0.75rem; color:var(--text-muted);">
                        <span style="display:flex; align-items:center; gap:4px; color:var(--success);">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            Verified Peer Exchange
                        </span>
                        <span>Rating: ${r.rating}.0 / 5</span>
                    </div>
                </div>
            `;
        }).join("");

    } catch (err) {
        console.error("Error fetching community rating stats:", err);
    }
}

// Fetch and render AI Learning Impact Reports on Dashboard
async function initDashboardImpactReports() {
    const listEl = document.getElementById("dashboard-impact-reports-list");
    if (!listEl) return;

    const token = localStorage.getItem("token");
    if (!token) {
        listEl.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem;'>Please log in to view your learning impact records.</p>";
        return;
    }

    try {
        const response = await fetch("/api/learning-impact/my-reports", {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) {
            listEl.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem;'>No learning impact reports found yet.</p>";
            return;
        }

        const reports = await response.json();

        if (!reports || reports.length === 0) {
            listEl.innerHTML = `
                <div style="padding:20px; text-align:center; background:var(--bg-page); border:1px dashed var(--border-subtle); border-radius:var(--radius-card); color:var(--text-muted);">
                    <p style="margin:0 0 6px; font-weight:600; color:var(--text-secondary);">No Session Assessments Completed Yet</p>
                    <p style="margin:0; font-size:0.85rem;">Take a pre-session baseline assessment when joining a live session to track your learning progression!</p>
                </div>
            `;
            return;
        }

        listEl.innerHTML = reports.map(r => {
            const analysis = r.impactAnalysis || {};
            const change = analysis.percentagePointChange || 0;
            const changeColor = change >= 0 ? "var(--success)" : "var(--danger)";
            const changeSign = change > 0 ? "+" : "";

            const partnerName = r.mentorId ? (r.mentorId.name || "Mentor") : "Mentor";
            const dateStr = new Date(r.createdAt || Date.now()).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric"
            });

            const isAnalyzed = analysis.status === "analyzed";
            const isProvisional = analysis.isProvisional || analysis.status === "provisional_review";
            const preProctor = (r.preAssessment && r.preAssessment.proctoring) || {};
            const postProctor = (r.postAssessment && r.postAssessment.proctoring) || {};

            return `
                <div style="padding:16px; background:var(--bg-page); border:1px solid var(--border-subtle); border-radius:var(--radius-card); display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <div style="font-weight:700; font-size:0.95rem; color:var(--text-primary);">${escapeHtml(r.skill)} Proctored Learning Impact</div>
                                ${isProvisional ? `<span style="font-size:0.68rem; font-weight:700; color:var(--danger); background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); padding:1px 6px; border-radius:var(--radius-full);">Provisional Review</span>` : ""}
                            </div>
                            <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Session with <strong>${escapeHtml(partnerName)}</strong> • ${dateStr}</div>
                        </div>
                        ${(isAnalyzed || isProvisional) ? `
                            <span style="font-weight:800; font-size:0.95rem; color:${changeColor}; background:rgba(255,255,255,0.06); padding:3px 10px; border-radius:var(--radius-full); border:1px solid var(--border-subtle);">
                                ${changeSign}${change} pts
                            </span>
                        ` : `
                            <span class="badge-self-reported">Baseline Only</span>
                        `}
                    </div>

                    <div style="display:flex; gap:10px; font-size:0.8rem; color:var(--text-secondary);">
                        <div style="flex:1; background:var(--bg-surface); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Pre-Session Baseline</span>
                                <span style="font-size:0.68rem; color:${preProctor.isFlaggedForReview ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">
                                    ${preProctor.isFlaggedForReview ? "Flagged" : "Proctored ✓"}
                                </span>
                            </div>
                            <strong style="font-size:1.1rem; color:var(--text-primary); margin-top:2px; display:block;">${r.preAssessment ? r.preAssessment.score : 0}/100</strong>
                        </div>
                        <div style="flex:1; background:var(--bg-surface); padding:8px 12px; border-radius:var(--radius-sm); border:1px solid var(--border-subtle);">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Post-Session Mastery</span>
                                <span style="font-size:0.68rem; color:${postProctor.isFlaggedForReview ? 'var(--danger)' : 'var(--success)'}; font-weight:600;">
                                    ${r.postAssessment && r.postAssessment.completed ? (postProctor.isFlaggedForReview ? "Flagged" : "Proctored ✓") : "Pending"}
                                </span>
                            </div>
                            <strong style="font-size:1.1rem; color:var(--text-primary); margin-top:2px; display:block;">${r.postAssessment && r.postAssessment.completed ? r.postAssessment.score : "Pending"}${r.postAssessment && r.postAssessment.completed ? "/100" : ""}</strong>
                        </div>
                    </div>

                    ${(isAnalyzed || isProvisional) ? `
                        <p style="font-size:0.83rem; color:var(--text-secondary); margin:0; line-height:1.45;">
                            ${escapeHtml(analysis.growthSummary || "")}
                        </p>
                        ${isProvisional ? `<div style="font-size:0.75rem; color:var(--danger);">${escapeHtml(analysis.reviewNotice || "")}</div>` : ""}
                        <div style="display:flex; justify-content:flex-end;">
                            <button class="btn btn-secondary btn-sm" onclick="viewFullImpactReport('${r.sessionId ? (r.sessionId._id || r.sessionId) : ''}')">
                                View Full Proctored Impact Report & Exercises
                            </button>
                        </div>
                    ` : `
                        <div style="font-size:0.78rem; color:var(--text-muted); font-style:italic;">
                            Post-assessment will unlock after concluding this live session.
                        </div>
                    `}
                </div>
            `;
        }).join("");

    } catch (e) {
        console.error("Error loading impact reports:", e);
        listEl.innerHTML = "<p style='color:var(--text-muted); font-size:0.85rem;'>Unable to load reports.</p>";
    }
}

// --------------------------------------------------------
// 14. DOM Initialization
// --------------------------------------------------------
if (checkRouteAccess()) {
    const initApp = () => {
        renderNavbar();
        initHeroCTA();
        initEditProfilePrefill();
        initDashboard();
        initDashboardImpactReports();
        initHomePageCommunityRatings();
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initApp);
    } else {
        initApp();
    }
}