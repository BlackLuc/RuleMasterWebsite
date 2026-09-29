const API_URL =
    "https://rulemaster20-production.up.railway.app";

const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userId = document.getElementById("userId");

const pageTitle = document.getElementById("pageTitle");
const content = document.getElementById("content");

const toast = document.getElementById("toast");
const menuBtn = document.getElementById("menuBtn");

let currentUser = null;
let currentServers = [];
let selectedServer = null;

function showToast(message) {
    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

async function apiFetch(endpoint, options = {}) {
    const response = await fetch(
        `${API_URL}${endpoint}`,
        {
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            },
            ...options
        }
    );

    if (!response.ok) {
        let message = "Request failed.";

        try {
            const data = await response.json();

            if (data.message) {
                message = data.message;
            }
        } catch {
            // Ignore JSON parsing errors.
        }

        throw new Error(message);
    }

    return response.json();
}

function showLogin() {
    if (loginView) {
        loginView.classList.remove("hidden");
    }

    if (appView) {
        appView.classList.add("hidden");
    }
}

function showApp() {
    if (loginView) {
        loginView.classList.add("hidden");
    }

    if (appView) {
        appView.classList.remove("hidden");
    }
}

function getAvatarUrl(user) {
    if (!user || !user.avatar) {
        return "https://cdn.discordapp.com/embed/avatars/0.png";
    }

    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function updateUserUI() {
    if (!currentUser) {
        return;
    }

    if (userName) {
        userName.textContent =
            currentUser.global_name ||
            currentUser.username;
    }

    if (userId) {
        userId.textContent = currentUser.id;
    }

    if (userAvatar) {
        userAvatar.src = getAvatarUrl(currentUser);
    }
}

async function checkSession() {
    try {
        const data = await apiFetch("/auth/me");

        if (!data.authenticated) {
            showLogin();
            return false;
        }

        currentUser = data.user;

        updateUserUI();
        showApp();

        await loadServers();

        return true;
    } catch (error) {
        console.error("Session check failed:", error);

        showLogin();

        return false;
    }
}

function login() {
    window.location.href =
        `${API_URL}/auth/discord`;
}

async function logout() {
    try {
        await apiFetch(
            "/auth/logout",
            {
                method: "POST"
            }
        );

        currentUser = null;
        currentServers = [];
        selectedServer = null;

        showLogin();

        showToast("Logged out.");
    } catch (error) {
        console.error("Logout failed:", error);

        showToast("Logout failed.");
    }
}

async function loadServers() {
    try {
        const data = await apiFetch(
            "/api/servers"
        );

        currentServers = data.servers || [];

        renderServers();

        if (
            currentServers.length > 0 &&
            !selectedServer
        ) {
            selectServer(currentServers[0]);
        }
    } catch (error) {
        console.error("Could not load servers:", error);

        if (error.message.includes("logged in")) {
            showLogin();
            return;
        }

        showToast(
            "Could not load your Discord servers."
        );
    }
}

function renderServers() {
    const serverContainer =
        document.getElementById("serverList");

    if (!serverContainer) {
        return;
    }

    serverContainer.innerHTML = "";

    if (currentServers.length === 0) {
        serverContainer.innerHTML = `
            <div class="empty-state">
                <h3>No manageable servers</h3>
                <p>
                    You need Administrator or Manage Server
                    permission on a server to manage it here.
                </p>
            </div>
        `;

        return;
    }

    currentServers.forEach((server) => {
        const card = document.createElement("button");

        card.className = "server-card";

        if (
            selectedServer &&
            selectedServer.id === server.id
        ) {
            card.classList.add("active");
        }

        const icon = server.icon
            ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=128`
            : "https://cdn.discordapp.com/embed/avatars/0.png";

        card.innerHTML = `
            <img
                src="${icon}"
                alt=""
                class="server-icon"
            >

            <div class="server-info">
                <strong>${escapeHtml(server.name)}</strong>
                <span>${server.owner ? "Owner" : "Manage Server"}</span>
            </div>
        `;

        card.addEventListener(
            "click",
            () => selectServer(server)
        );

        serverContainer.appendChild(card);
    });
}

function selectServer(server) {
    selectedServer = server;

    renderServers();
    loadServerSettings(server.id);
}

async function loadServerSettings(guildId) {
    try {
        const data = await apiFetch(
            `/api/settings/${guildId}`
        );

        renderSettings(data.settings);
    } catch (error) {
        console.error(
            "Could not load server settings:",
            error
        );

        showToast(
            "Could not load server settings."
        );
    }
}

async function saveServerSettings(settings) {
    if (!selectedServer) {
        showToast("Select a server first.");

        return;
    }

    try {
        await apiFetch(
            `/api/settings/${selectedServer.id}`,
            {
                method: "PUT",
                body: JSON.stringify(settings)
            }
        );

        showToast("Settings saved.");
    } catch (error) {
        console.error(
            "Could not save settings:",
            error
        );

        showToast("Could not save settings.");
    }
}

function renderSettings(settings) {
    const moderation = settings.moderation || {};
    const logging = settings.logging || {};
    const welcome = settings.welcome || {};

    if (!content) {
        return;
    }

    pageTitle.textContent = "Settings";

    content.innerHTML = `
        <div class="settings-grid">

            <div class="settings-card">
                <div class="settings-card-header">
                    <div>
                        <h2>Moderation</h2>
                        <p>Configure RuleMaster moderation features.</p>
                    </div>
                </div>

                <div class="setting-row">
                    <div>
                        <strong>Moderation enabled</strong>
                        <span>Enable RuleMaster moderation.</span>
                    </div>

                    <label class="switch">
                        <input
                            type="checkbox"
                            id="moderationEnabled"
                            ${moderation.enabled ? "checked" : ""}
                        >
                        <span></span>
                    </label>
                </div>

                <div class="setting-row">
                    <div>
                        <strong>Delete invites</strong>
                        <span>Automatically remove Discord invites.</span>
                    </div>

                    <label class="switch">
                        <input
                            type="checkbox"
                            id="deleteInvites"
                            ${moderation.deleteInvites ? "checked" : ""}
                        >
                        <span></span>
                    </label>
                </div>

                <div class="setting-row">
                    <div>
                        <strong>Delete links</strong>
                        <span>Automatically remove links.</span>
                    </div>

                    <label class="switch">
                        <input
                            type="checkbox"
                            id="deleteLinks"
                            ${moderation.deleteLinks ? "checked" : ""}
                        >
                        <span></span>
                    </label>
                </div>

                <div class="setting-row">
                    <div>
                        <strong>Bad word warnings</strong>
                        <span>Warn members when bad words are detected.</span>
                    </div>

                    <label class="switch">
                        <input
                            type="checkbox"
                            id="warnOnBadWords"
                            ${moderation.warnOnBadWords ? "checked" : ""}
                        >
                        <span></span>
                    </label>
                </div>
            </div>

            <div class="settings-card">
                <div class="settings-card-header">
                    <div>
                        <h2>Logging</h2>
                        <p>Configure moderation logging.</p>
                    </div>
                </div>

                <div class="setting-row">
                    <div>
                        <strong>Logging enabled</strong>
                        <span>Enable server logging.</span>
                    </div>

                    <label class="switch">
                        <input
                            type="checkbox"
                            id="loggingEnabled"
                            ${logging.enabled ? "checked" : ""}
                        >
                        <span></span>
                    </label>
                </div>

                <div class="setting-row column">
                    <label for="loggingChannel">
                        Logging channel ID
                    </label>

                    <input
                        class="input"
                        id="loggingChannel"
                        value="${escapeHtml(logging.channelId || "")}"
                        placeholder="Channel ID"
                    >
                </div>
            </div>

            <div class="settings-card">
                <div class="settings-card-header">
                    <div>
                        <h2>Welcome</h2>
                        <p>Configure your welcome system.</p>
                    </div>
                </div>

                <div class="setting-row">
                    <div>
                        <strong>Welcome messages</strong>
                        <span>Send a welcome message for new members.</span>
                    </div>

                    <label class="switch">
                        <input
                            type="checkbox"
                            id="welcomeEnabled"
                            ${welcome.enabled ? "checked" : ""}
                        >
                        <span></span>
                    </label>
                </div>

                <div class="setting-row column">
                    <label for="welcomeChannel">
                        Welcome channel ID
                    </label>

                    <input
                        class="input"
                        id="welcomeChannel"
                        value="${escapeHtml(welcome.channelId || "")}"
                        placeholder="Channel ID"
                    >
                </div>

                <div class="setting-row column">
                    <label for="welcomeMessage">
                        Welcome message
                    </label>

                    <input
                        class="input"
                        id="welcomeMessage"
                        value="${escapeHtml(welcome.message || "")}"
                        placeholder="Welcome {user} to {server}!"
                    >
                </div>
            </div>

            <button
                class="btn btn-primary"
                id="saveSettingsBtn"
            >
                Save Settings
            </button>

        </div>
    `;

    const saveButton =
        document.getElementById(
            "saveSettingsBtn"
        );

    if (saveButton) {
        saveButton.addEventListener(
            "click",
            async () => {
                const newSettings = {
                    moderation: {
                        enabled:
                            document.getElementById(
                                "moderationEnabled"
                            ).checked,

                        deleteInvites:
                            document.getElementById(
                                "deleteInvites"
                            ).checked,

                        deleteLinks:
                            document.getElementById(
                                "deleteLinks"
                            ).checked,

                        warnOnBadWords:
                            document.getElementById(
                                "warnOnBadWords"
                            ).checked
                    },

                    logging: {
                        enabled:
                            document.getElementById(
                                "loggingEnabled"
                            ).checked,

                        channelId:
                            document.getElementById(
                                "loggingChannel"
                            ).value.trim()
                    },

                    welcome: {
                        enabled:
                            document.getElementById(
                                "welcomeEnabled"
                            ).checked,

                        channelId:
                            document.getElementById(
                                "welcomeChannel"
                            ).value.trim(),

                        message:
                            document.getElementById(
                                "welcomeMessage"
                            ).value
                    }
                };

                await saveServerSettings(
                    newSettings
                );
            }
        );
    }
}

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setupNavigation() {
    const navItems =
        document.querySelectorAll(
            "[data-page]"
        );

    navItems.forEach((item) => {
        item.addEventListener(
            "click",
            async () => {
                const page =
                    item.dataset.page;

                await navigateTo(page);
            }
        );
    });
}

async function navigateTo(page) {
    if (!content) {
        return;
    }

    document
        .querySelectorAll("[data-page]")
        .forEach((item) => {
            item.classList.toggle(
                "active",
                item.dataset.page === page
            );
        });

    if (page === "servers") {
        pageTitle.textContent = "Servers";

        content.innerHTML = `
            <div class="page-header">
                <h2>Your Servers</h2>
                <p>
                    Select a server you have permission to manage.
                </p>
            </div>

            <div id="serverList" class="server-grid"></div>
        `;

        renderServers();

        return;
    }

    if (page === "settings") {
        if (!selectedServer) {
            pageTitle.textContent = "Settings";

            content.innerHTML = `
                <div class="empty-state">
                    <h2>Select a server</h2>
                    <p>
                        Choose a server from the Servers page first.
                    </p>
                </div>
            `;

            return;
        }

        await loadServerSettings(
            selectedServer.id
        );

        return;
    }

    if (page === "dashboard") {
        pageTitle.textContent = "Dashboard";

        content.innerHTML = `
            <div class="page-header">
                <h2>Welcome to RuleMaster</h2>
                <p>
                    Manage your Discord servers from one place.
                </p>
            </div>

            <div class="stats-grid">
                <div class="stat-card">
                    <span>Servers</span>
                    <strong>${currentServers.length}</strong>
                </div>

                <div class="stat-card">
                    <span>Commands</span>
                    <strong>9</strong>
                </div>

                <div class="stat-card">
                    <span>Status</span>
                    <strong>Online</strong>
                </div>
            </div>
        `;

        return;
    }

    if (page === "commands") {
        pageTitle.textContent = "Commands";

        content.innerHTML = `
            <div class="page-header">
                <h2>Commands</h2>
                <p>RuleMaster slash commands.</p>
            </div>

            <div class="command-grid">
                ${[
                    "announce",
                    "help",
                    "moderation",
                    "roblox",
                    "rules",
                    "settings",
                    "staff",
                    "stats",
                    "suggest"
                ]
                    .map(
                        (command) => `
                            <div class="command-card">
                                <strong>/${command}</strong>
                                <span>RuleMaster command</span>
                            </div>
                        `
                    )
                    .join("")}
            </div>
        `;

        return;
    }

    if (page === "docs") {
        pageTitle.textContent = "Documentation";

        content.innerHTML = `
            <div class="page-header">
                <h2>Documentation</h2>
                <p>
                    Learn how to configure and use RuleMaster.
                </p>
            </div>

            <div class="docs-grid">
                <div class="settings-card">
                    <h2>Getting Started</h2>
                    <p>
                        Invite RuleMaster to your Discord server,
                        then use the dashboard to configure it.
                    </p>
                </div>

                <div class="settings-card">
                    <h2>Permissions</h2>
                    <p>
                        You need Administrator or Manage Server
                        permissions to manage a server.
                    </p>
                </div>
            </div>
        `;

        return;
    }

    pageTitle.textContent = "Dashboard";

    await navigateTo("dashboard");
}

function setupEvents() {
    if (loginBtn) {
        loginBtn.addEventListener(
            "click",
            login
        );
    }

    if (logoutBtn) {
        logoutBtn.addEventListener(
            "click",
            logout
        );
    }

    if (menuBtn) {
        menuBtn.addEventListener(
            "click",
            () => {
                document.body.classList.toggle(
                    "sidebar-open"
                );
            }
        );
    }

    setupNavigation();
}

async function init() {
    setupEvents();

    const loggedIn =
        await checkSession();

    if (loggedIn) {
        await navigateTo("dashboard");
    }
}

init();