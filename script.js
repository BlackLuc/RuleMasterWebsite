const API_URL = "https://rulemaster20-production.up.railway.app";

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
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 3000);
}

async function apiFetch(endpoint, options = {}) {
    const token = localStorage.getItem("rulemaster_token");
    const headers = { ...(options.headers || {}) };

    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (options.body) headers["Content-Type"] = "application/json";

    const response = await fetch(`${API_URL}${endpoint}`, {
        credentials: "include",
        ...options,
        headers
    });

    if (!response.ok) {
        let message = "Request failed.";
        try {
            const data = await response.json();
            if (data.message) message = data.message;
        } catch {}
        throw new Error(message);
    }

    return response.json();
}

function showLogin() {
    if (loginView) {
        loginView.classList.remove("hidden");
        loginView.style.display = "grid";
    }
    if (appView) {
        appView.classList.add("hidden");
        appView.style.display = "none";
    }
}

function showApp() {
    if (loginView) {
        loginView.classList.add("hidden");
        loginView.style.display = "none";
    }
    if (appView) {
        appView.classList.remove("hidden");
        appView.style.display = "flex";
    }
}

function getAvatarUrl(user) {
    if (!user || !user.avatar) return "https://cdn.discordapp.com/embed/avatars/0.png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function updateUserUI() {
    if (!currentUser) return;
    if (userName) userName.textContent = currentUser.global_name || currentUser.username;
    if (userId) userId.textContent = currentUser.id;
    if (userAvatar) userAvatar.src = getAvatarUrl(currentUser);
}

async function checkSession() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get("token");

    if (tokenFromUrl) {
        localStorage.setItem("rulemaster_token", tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    }

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
        showLogin();
        return false;
    }
}

function login() {
    window.location.href = `${API_URL}/auth/discord`;
}

async function logout() {
    try {
        await apiFetch("/auth/logout", { method: "POST" });
    } catch {}
    localStorage.removeItem("rulemaster_token");
    currentUser = null;
    currentServers = [];
    selectedServer = null;
    showLogin();
    showToast("Logged out.");
}

async function loadServers() {
    try {
        const data = await apiFetch("/api/servers");
        currentServers = data.servers || [];
        renderServers();

        if (currentServers.length > 0 && !selectedServer) {
            selectServer(currentServers[0]);
        }
    } catch (error) {
        showToast("Could not load your Discord servers.");
    }
}

function renderServers() {
    const serverContainer = document.getElementById("serverList");
    if (!serverContainer) return;

    serverContainer.innerHTML = "";

    if (currentServers.length === 0) {
        serverContainer.innerHTML = `<div class="empty"><h3>No manageable servers found</h3></div>`;
        return;
    }

    currentServers.forEach((server) => {
        const card = document.createElement("button");
        card.className = "card server-card";
        if (selectedServer && selectedServer.id === server.id) {
            card.classList.add("active");
        }

        const icon = server.icon
            ? `https://cdn.discordapp.com/icons/${server.id}/${server.icon}.png?size=128`
            : "https://cdn.discordapp.com/embed/avatars/0.png";

        card.innerHTML = `
            <div class="server-head">
                <img src="${icon}" alt="" class="server-icon">
                <div>
                    <h3>${escapeHtml(server.name)}</h3>
                    <code>${server.owner ? "Owner" : "Manage Server"}</code>
                </div>
            </div>
        `;

        card.addEventListener("click", () => selectServer(server));
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
        const [settingsData, detailsData] = await Promise.all([
            apiFetch(`/api/settings/${guildId}`),
            apiFetch(`/api/servers/${guildId}/details`).catch(() => ({ channels: [], roles: [] }))
        ]);

        renderSettings(settingsData.settings || {}, detailsData.channels || [], detailsData.roles || []);
    } catch (error) {
        showToast("Could not load server settings.");
    }
}

async function saveServerSettings(settings) {
    if (!selectedServer) {
        showToast("Select a server first.");
        return;
    }

    try {
        await apiFetch(`/api/settings/${selectedServer.id}`, {
            method: "PUT",
            body: JSON.stringify(settings)
        });
        showToast("Settings saved successfully!");
    } catch (error) {
        showToast("Could not save settings.");
    }
}

function renderSettings(settings, channels, roles) {
    const moderation = settings.moderation || {};
    const logging = settings.logging || {};
    const welcome = settings.welcome || {};
    const permissions = settings.permissions || {};

    if (!content) return;
    pageTitle.textContent = "Settings";

    const buildChannelOptions = (selectedId) => {
        let opts = `<option value="">-- Select Channel --</option>`;
        channels.forEach((c) => {
            opts += `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>#${escapeHtml(c.name)}</option>`;
        });
        return opts;
    };

    const buildRoleOptions = (selectedId) => {
        let opts = `<option value="">-- Select Role --</option>`;
        roles.forEach((r) => {
            opts += `<option value="${r.id}" ${r.id === selectedId ? "selected" : ""}>@${escapeHtml(r.name)}</option>`;
        });
        return opts;
    };

    content.innerHTML = `
        <div class="form">
            <div class="card">
                <h3>Moderation</h3>
                <p class="muted">Configure RuleMaster auto-moderation settings.</p>
                <br>
                <div class="switch-row">
                    <span>Moderation enabled</span>
                    <label class="switch">
                        <input type="checkbox" id="moderationEnabled" ${moderation.enabled ? "checked" : ""}>
                        <span></span>
                    </label>
                </div>
                <br>
                <div class="switch-row">
                    <span>Delete invites</span>
                    <label class="switch">
                        <input type="checkbox" id="deleteInvites" ${moderation.deleteInvites ? "checked" : ""}>
                        <span></span>
                    </label>
                </div>
                <br>
                <div class="switch-row">
                    <span>Delete links</span>
                    <label class="switch">
                        <input type="checkbox" id="deleteLinks" ${moderation.deleteLinks ? "checked" : ""}>
                        <span></span>
                    </label>
                </div>
            </div>

            <div class="card">
                <h3>Logging Channel</h3>
                <p class="muted">Select the channel for moderation and system logs.</p>
                <br>
                <div class="switch-row">
                    <span>Logging enabled</span>
                    <label class="switch">
                        <input type="checkbox" id="loggingEnabled" ${logging.enabled ? "checked" : ""}>
                        <span></span>
                    </label>
                </div>
                <br>
                <div class="field">
                    <label for="loggingChannel">Log Channel</label>
                    <select id="loggingChannel">
                        ${buildChannelOptions(logging.channelId)}
                    </select>
                </div>
            </div>

            <div class="card">
                <h3>Welcome Channel</h3>
                <p class="muted">Configure welcome messages for new server members.</p>
                <br>
                <div class="switch-row">
                    <span>Welcome enabled</span>
                    <label class="switch">
                        <input type="checkbox" id="welcomeEnabled" ${welcome.enabled ? "checked" : ""}>
                        <span></span>
                    </label>
                </div>
                <br>
                <div class="field">
                    <label for="welcomeChannel">Welcome Channel</label>
                    <select id="welcomeChannel">
                        ${buildChannelOptions(welcome.channelId)}
                    </select>
                </div>
                <br>
                <div class="field">
                    <label for="welcomeMessage">Welcome Message</label>
                    <input id="welcomeMessage" value="${escapeHtml(welcome.message || "")}" placeholder="Welcome {user} to {server}!">
                </div>
            </div>

            <div class="card">
                <h3>Role Permissions</h3>
                <p class="muted">Restrict command usage to specific roles in your server.</p>
                <br>
                <div class="field">
                    <label for="adminRole">Admin Role</label>
                    <select id="adminRole">
                        ${buildRoleOptions(permissions.adminRoleId)}
                    </select>
                </div>
                <br>
                <div class="field">
                    <label for="modRole">Moderator Role</label>
                    <select id="modRole">
                        ${buildRoleOptions(permissions.modRoleId)}
                    </select>
                </div>
            </div>

            <button class="btn btn-primary" id="saveSettingsBtn">Save Settings</button>
        </div>
    `;

    document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
        const newSettings = {
            moderation: {
                enabled: document.getElementById("moderationEnabled").checked,
                deleteInvites: document.getElementById("deleteInvites").checked,
                deleteLinks: document.getElementById("deleteLinks").checked,
                warnOnBadWords: moderation.warnOnBadWords || false
            },
            logging: {
                enabled: document.getElementById("loggingEnabled").checked,
                channelId: document.getElementById("loggingChannel").value
            },
            welcome: {
                enabled: document.getElementById("welcomeEnabled").checked,
                channelId: document.getElementById("welcomeChannel").value,
                message: document.getElementById("welcomeMessage").value
            },
            permissions: {
                adminRoleId: document.getElementById("adminRole").value,
                modRoleId: document.getElementById("modRole").value
            }
        };

        await saveServerSettings(newSettings);
    });
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
    const navItems = document.querySelectorAll("[data-page]");
    navItems.forEach((item) => {
        item.addEventListener("click", async () => {
            await navigateTo(item.dataset.page);
        });
    });
}

async function navigateTo(page) {
    if (!content) return;

    document.querySelectorAll("[data-page]").forEach((item) => {
        item.classList.toggle("active", item.dataset.page === page);
    });

    if (page === "servers") {
        pageTitle.textContent = "Servers";
        content.innerHTML = `
            <h2>Your Servers</h2>
            <p class="muted">Select a server you have permission to manage.</p>
            <br>
            <div id="serverList" class="grid"></div>
        `;
        renderServers();
        return;
    }

    if (page === "settings") {
        if (!selectedServer) {
            pageTitle.textContent = "Settings";
            content.innerHTML = `
                <div class="empty">
                    <h2>Select a server</h2>
                    <p>Choose a server from the Servers page first.</p>
                </div>
            `;
            return;
        }
        await loadServerSettings(selectedServer.id);
        return;
    }

    if (page === "dashboard") {
        pageTitle.textContent = "Dashboard";
        content.innerHTML = `
            <h2>Welcome to RuleMaster</h2>
            <p class="muted">Manage your Discord servers from one place.</p>
            <br>
            <div class="stats">
                <div class="card stat">
                    <small>Servers</small>
                    <strong>${currentServers.length}</strong>
                </div>
                <div class="card stat">
                    <small>Commands</small>
                    <strong>9</strong>
                </div>
                <div class="card stat">
                    <small>Status</small>
                    <strong>Online</strong>
                </div>
            </div>
        `;
        return;
    }

    if (page === "commands") {
        pageTitle.textContent = "Commands";
        content.innerHTML = `
            <h2>Commands</h2>
            <p class="muted">RuleMaster slash commands.</p>
            <br>
            <div class="grid">
                ${["announce", "help", "moderation", "roblox", "rules", "settings", "staff", "stats", "suggest"]
                    .map((cmd) => `<div class="card cmd"><code>/${cmd}</code><p>RuleMaster command</p></div>`)
                    .join("")}
            </div>
        `;
        return;
    }

    if (page === "docs") {
        pageTitle.textContent = "Documentation";
        content.innerHTML = `
            <h2>Documentation</h2>
            <p class="muted">Learn how to configure and use RuleMaster.</p>
            <br>
            <div class="grid">
                <div class="card">
                    <h3>Getting Started</h3>
                    <p class="muted">Invite RuleMaster to your Discord server, then use the dashboard to configure it.</p>
                </div>
            </div>
        `;
        return;
    }

    pageTitle.textContent = "Dashboard";
    await navigateTo("dashboard");
}

function setupEvents() {
    if (loginBtn) loginBtn.addEventListener("click", login);
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
    if (menuBtn && document.getElementById("sidebar")) {
        menuBtn.addEventListener("click", () => {
            document.getElementById("sidebar").classList.toggle("open");
        });
    }
    setupNavigation();
}

async function init() {
    setupEvents();
    const loggedIn = await checkSession();
    if (loggedIn) {
        await navigateTo("dashboard");
    }
}

init();