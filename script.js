/* =========================================================
   RULEMASTER 2.0 - DASHBOARD
   ========================================================= */

/* ===== CONFIG ===== */

const CLIENT_ID = "1554166316628320306";

/*
 * IMPORTANT:
 * This is currently the website's frontend API.
 *
 * When your Railway API is ready, change this to something like:
 *
 * const BOT_API_URL = "https://your-project.up.railway.app";
 *
 * Leave it empty for frontend-only testing.
 */
const BOT_API_URL = "";

const REDIRECT_URI =
    window.location.origin + window.location.pathname;

const BOT_INVITE = (guildId) => {
    let url =
        `https://discord.com/oauth2/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&permissions=8` +
        `&scope=bot%20applications.commands`;

    if (guildId) {
        url +=
            `&guild_id=${encodeURIComponent(guildId)}` +
            `&disable_guild_select=true`;
    }

    return url;
};


/* =========================================================
   COMMANDS
   ========================================================= */

const COMMANDS = [
    {
        name: "/rules",
        cat: "Rules",
        desc: "Create and manage your server rules."
    },
    {
        name: "/moderation",
        cat: "Moderation",
        desc: "Manage moderation features."
    },
    {
        name: "/suggest",
        cat: "Community",
        desc: "Submit and manage server suggestions."
    },
    {
        name: "/announce",
        cat: "Staff",
        desc: "Create and send announcements."
    },
    {
        name: "/stats",
        cat: "Statistics",
        desc: "View RuleMaster statistics."
    },
    {
        name: "/roblox",
        cat: "Roblox",
        desc: "Manage Roblox-related features."
    },
    {
        name: "/staff",
        cat: "Staff",
        desc: "Manage staff settings."
    },
    {
        name: "/help",
        cat: "Information",
        desc: "View RuleMaster help."
    },
    {
        name: "/settings",
        cat: "Settings",
        desc: "Manage RuleMaster settings."
    }
];


/* =========================================================
   STATE
   ========================================================= */

const state = {
    token: null,
    user: null,
    guilds: null,
    botGuilds: null
};


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector) => {
    return document.querySelector(selector);
};


function esc(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        (character) => {
            const replacements = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };

            return replacements[character];
        }
    );
}


/* =========================================================
   TOAST
   ========================================================= */

let toastTimer;

function toast(message) {
    const toastElement = $("#toast");

    if (!toastElement) {
        console.log(message);
        return;
    }

    toastElement.textContent = message;
    toastElement.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toastElement.classList.remove("show");
    }, 2500);
}


/* =========================================================
   AUTHENTICATION
   ========================================================= */

function login() {
    const oauthState = crypto.randomUUID();

    sessionStorage.setItem(
        "oauth_state",
        oauthState
    );

    const url = new URL(
        "https://discord.com/oauth2/authorize"
    );

    url.search = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: REDIRECT_URI,
        response_type: "token",
        scope: "identify guilds",
        state: oauthState,
        prompt: "none"
    });

    window.location.href = url.toString();
}


function readTokenFromUrl() {
    const hash = new URLSearchParams(
        window.location.hash.slice(1)
    );

    const token = hash.get("access_token");

    if (!token) {
        return;
    }

    const returnedState = hash.get("state");
    const savedState =
        sessionStorage.getItem("oauth_state");

    if (
        returnedState &&
        savedState &&
        returnedState !== savedState
    ) {
        toast("Login failed: invalid OAuth state.");
        return;
    }

    const expiresIn =
        Number(hash.get("expires_in") || 604800);

    const expires =
        Date.now() + expiresIn * 1000;

    localStorage.setItem(
        "rm_token",
        JSON.stringify({
            token,
            expires
        })
    );

    /*
     * Discord returns the OAuth token inside the URL hash.
     *
     * Remove the token from the visible URL.
     */
    history.replaceState(
        null,
        "",
        window.location.pathname + "#/dashboard"
    );
}


function loadToken() {
    try {
        const saved =
            JSON.parse(
                localStorage.getItem("rm_token")
            );

        if (
            saved &&
            saved.token &&
            saved.expires > Date.now()
        ) {
            return saved.token;
        }
    } catch (error) {
        console.warn(
            "Could not read saved login:",
            error
        );
    }

    localStorage.removeItem("rm_token");

    return null;
}


function logout() {
    localStorage.removeItem("rm_token");

    Object.assign(state, {
        token: null,
        user: null,
        guilds: null,
        botGuilds: null
    });

    location.hash = "";

    showLogin();
}


/* =========================================================
   DISCORD API
   ========================================================= */

async function discord(path) {
    if (!state.token) {
        throw new Error("You are not logged in.");
    }

    const response = await fetch(
        "https://discord.com/api/v10" + path,
        {
            headers: {
                Authorization:
                    `Bearer ${state.token}`
            }
        }
    );

    if (response.status === 401) {
        logout();

        throw new Error(
            "Your Discord session expired."
        );
    }

    if (!response.ok) {
        throw new Error(
            `Discord API error ${response.status}`
        );
    }

    return response.json();
}


/* =========================================================
   GUILD DATA
   ========================================================= */

function canManage(guild) {
    try {
        const permissions =
            BigInt(guild.permissions || "0");

        const ADMINISTRATOR = 0x8n;
        const MANAGE_GUILD = 0x20n;

        return (
            guild.owner === true ||
            (permissions & ADMINISTRATOR) !== 0n ||
            (permissions & MANAGE_GUILD) !== 0n
        );
    } catch (error) {
        return guild.owner === true;
    }
}


async function getGuilds() {
    if (state.guilds) {
        return state.guilds;
    }

    const allGuilds =
        await discord(
            "/users/@me/guilds?with_counts=true"
        );

    state.guilds =
        allGuilds.filter(canManage);

    /*
     * Optional Railway API.
     *
     * This will be enabled once BOT_API_URL
     * is configured.
     */
    if (
        BOT_API_URL &&
        !state.botGuilds
    ) {
        try {
            const response =
                await fetch(
                    BOT_API_URL +
                    "/api/servers"
                );

            if (!response.ok) {
                throw new Error(
                    "Could not load bot servers."
                );
            }

            const data =
                await response.json();

            const servers =
                data.servers || [];

            state.botGuilds =
                new Set(
                    servers.map(
                        (server) => server.id
                    )
                );
        } catch (error) {
            console.warn(
                "Could not load RuleMaster servers:",
                error
            );

            state.botGuilds = null;
        }
    }

    return state.guilds;
}


function botStatus(id) {
    if (!state.botGuilds) {
        return "unknown";
    }

    return state.botGuilds.has(id)
        ? "on"
        : "off";
}


/* =========================================================
   AVATARS / SERVER ICONS
   ========================================================= */

function avatarUrl(user) {
    if (user.avatar) {
        return (
            `https://cdn.discordapp.com/avatars/` +
            `${user.id}/${user.avatar}.png?size=128`
        );
    }

    let avatarNumber = 0;

    try {
        avatarNumber =
            Number(
                (
                    (BigInt(user.id) >> 22n) %
                    6n
                )
            );
    } catch {
        avatarNumber = 0;
    }

    return (
        `https://cdn.discordapp.com/embed/avatars/` +
        `${avatarNumber}.png`
    );
}


function iconHtml(guild) {
    if (guild.icon) {
        return `
            <img
                class="server-icon"
                src="https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128"
                alt=""
            >
        `;
    }

    const initials =
        guild.name
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .slice(0, 3)
            .toUpperCase();

    return `
        <div class="server-icon">
            ${esc(initials)}
        </div>
    `;
}


/* =========================================================
   SERVER CARD
   ========================================================= */

function serverCard(guild) {
    const status =
        botStatus(guild.id);

    const labels = {
        on: "Bot: Installed",
        off: "Bot: Not installed",
        unknown: "Bot: Unknown"
    };

    const label =
        labels[status];

    let action = "";

    if (status === "on") {
        action = `
            <a
                class="btn btn-primary"
                href="#/settings/${guild.id}"
            >
                Manage Server
            </a>
        `;
    } else if (status === "off") {
        action = `
            <a
                class="btn btn-ghost"
                href="${BOT_INVITE(guild.id)}"
                target="_blank"
                rel="noopener"
            >
                Add RuleMaster ↗
            </a>
        `;
    } else {
        action = `
            <a
                class="btn btn-primary"
                href="#/settings/${guild.id}"
            >
                Manage Server
            </a>

            <a
                class="btn btn-ghost"
                href="${BOT_INVITE(guild.id)}"
                target="_blank"
                rel="noopener"
            >
                Add RuleMaster ↗
            </a>
        `;
    }

    const memberCount =
        guild.approximate_member_count;

    return `
        <article class="card server-card">

            <div class="server-head">
                ${iconHtml(guild)}

                <div style="min-width:0">

                    <h3>
                        ${esc(guild.name)}
                    </h3>

                    <code>
                        ${guild.id}
                    </code>

                </div>
            </div>

            <div
                class="muted"
                style="font-size:13px"
            >
                ${
                    memberCount
                        ? memberCount.toLocaleString() +
                          " members"
                        : "Members: n/a"
                }
            </div>

            <span class="badge ${status}">
                ${label}
            </span>

            ${action}

        </article>
    `;
}


function loadingGrid() {
    return `
        <div class="grid">
            ${"<div class=\"skeleton\"></div>".repeat(6)}
        </div>
    `;
}


/* =========================================================
   UI COMPONENTS
   ========================================================= */

function toggle(name, label, enabled) {
    return `
        <div class="switch-row">

            <span>
                ${label}
            </span>

            <label class="switch">

                <input
                    type="checkbox"
                    name="${name}"
                    ${enabled ? "checked" : ""}
                >

                <span></span>

            </label>

        </div>
    `;
}


function empty(message) {
    return `
        <div
            class="empty"
            style="grid-column:1/-1"
        >
            ${esc(message)}
        </div>
    `;
}


function cmdCards(list) {
    if (!list.length) {
        return empty(
            "No commands found."
        );
    }

    return list
        .map((command) => {
            return `
                <div class="card cmd">

                    <span class="tag">
                        ${esc(command.cat)}
                    </span>

                    <br>

                    <code>
                        ${esc(command.name)}
                    </code>

                    <p>
                        ${esc(command.desc)}
                    </p>

                </div>
            `;
        })
        .join("");
}


/* =========================================================
   VIEWS
   ========================================================= */

const views = {

    async dashboard() {
        const guilds =
            await getGuilds();

        const installed =
            state.botGuilds
                ? guilds.filter(
                    (guild) =>
                        state.botGuilds.has(
                            guild.id
                        )
                ).length
                : "–";

        const members =
            guilds.reduce(
                (total, guild) =>
                    total +
                    (
                        guild.approximate_member_count ||
                        0
                    ),
                0
            );

        return `
            <h1
                style="
                    font-size:28px;
                    margin-bottom:6px
                "
            >
                Welcome back,
                ${esc(
                    state.user.global_name ||
                    state.user.username
                )}
                👋
            </h1>

            <p
                class="muted"
                style="
                    margin:0 0 26px
                "
            >
                Here's what's happening
                with RuleMaster.
            </p>

            <div class="stats">

                <div class="card stat">
                    <small>
                        Manageable servers
                    </small>

                    <strong>
                        ${guilds.length}
                    </strong>
                </div>

                <div class="card stat">
                    <small>
                        With RuleMaster
                    </small>

                    <strong>
                        ${installed}
                    </strong>
                </div>

                <div class="card stat">
                    <small>
                        Total members
                    </small>

                    <strong>
                        ${members.toLocaleString()}
                    </strong>
                </div>

                <div class="card stat">
                    <small>
                        Commands
                    </small>

                    <strong>
                        ${COMMANDS.length}
                    </strong>
                </div>

            </div>

            <h3 class="section-title">
                Your servers
            </h3>

            <div class="grid">

                ${
                    guilds
                        .slice(0, 6)
                        .map(serverCard)
                        .join("")
                        ||
                    empty(
                        "No servers you can manage."
                    )
                }

            </div>
        `;
    },


    async servers() {
        const guilds =
            await getGuilds();

        return `
            <div class="grid">

                ${
                    guilds
                        .map(serverCard)
                        .join("")
                        ||
                    empty(
                        "No servers you can manage."
                    )
                }

            </div>
        `;
    },


    async commands() {
        return `
            <input
                class="search"
                id="cmdSearch"
                placeholder="Search commands…"
                aria-label="Search commands"
            >

            <div
                class="grid"
                id="cmdGrid"
            >
                ${cmdCards(COMMANDS)}
            </div>
        `;
    },


    async settings(id) {
        const guilds =
            await getGuilds();

        if (!id) {
            return `
                <p
                    class="muted"
                    style="margin-top:0"
                >
                    Choose a server to configure.
                </p>

                <div class="grid">

                    ${
                        guilds
                            .map(serverCard)
                            .join("")
                            ||
                        empty(
                            "No servers you can manage."
                        )
                    }

                </div>
            `;
        }

        const guild =
            guilds.find(
                (server) =>
                    server.id === id
            );

        if (!guild) {
            return empty(
                "You don't have permission to manage this server."
            );
        }

        let settings = {};

        try {
            settings =
                JSON.parse(
                    localStorage.getItem(
                        "rm_settings_" + id
                    ) || "{}"
                );
        } catch {
            settings = {};
        }

        return `
            <div
                class="card"
                style="margin-bottom:20px"
            >

                <div class="server-head">

                    ${iconHtml(guild)}

                    <div>

                        <h3>
                            ${esc(guild.name)}
                        </h3>

                        <code>
                            ${guild.id}
                        </code>

                    </div>

                </div>

            </div>


            <form
                class="form card"
                id="settingsForm"
                data-id="${guild.id}"
            >

                <div class="field">

                    <label>
                        Command prefix
                    </label>

                    <input
                        name="prefix"
                        value="${esc(
                            settings.prefix || "!"
                        )}"
                    >

                </div>


                <div class="field">

                    <label>
                        Log channel ID
                    </label>

                    <input
                        name="logChannel"
                        value="${esc(
                            settings.logChannel || ""
                        )}"
                        placeholder="123456789012345678"
                    >

                </div>


                <div class="field">

                    <label>
                        Language
                    </label>

                    <select name="lang">

                        <option
                            ${
                                settings.lang ===
                                "English"
                                    ? "selected"
                                    : ""
                            }
                        >
                            English
                        </option>

                        <option
                            ${
                                settings.lang ===
                                "Deutsch"
                                    ? "selected"
                                    : ""
                            }
                        >
                            Deutsch
                        </option>

                    </select>

                </div>


                <div class="field">

                    <label>
                        Server rules
                    </label>

                    <textarea
                        name="rules"
                    >${esc(
                        settings.rules || ""
                    )}</textarea>

                </div>


                ${toggle(
                    "automod",
                    "Auto moderation",
                    settings.automod
                )}

                ${toggle(
                    "suggestions",
                    "Suggestions system",
                    settings.suggestions
                )}

                ${toggle(
                    "welcome",
                    "Welcome messages",
                    settings.welcome
                )}


                <div>

                    <button
                        class="btn btn-primary"
                        type="submit"
                    >
                        Save changes
                    </button>

                </div>

            </form>
        `;
    },


    async docs() {
        return `
            <div
                class="card"
                style="
                    max-width:760px;
                    line-height:1.7
                "
            >

                <h3>
                    Getting started
                </h3>

                <p class="muted">

                    1. Add RuleMaster to your server
                    from the Servers page.
                    <br>

                    2. Open Settings for that server
                    and configure it.
                    <br>

                    3. Use
                    <code>/rules</code>
                    in Discord to test.

                </p>


                <h3
                    style="margin-top:20px"
                >
                    Permissions
                </h3>

                <p class="muted">

                    You can only manage servers
                    where you are the owner,
                    an administrator,
                    or have Manage Server.

                </p>

            </div>
        `;
    }

};


/* =========================================================
   ROUTER
   ========================================================= */

const titles = {
    dashboard: "Dashboard",
    servers: "Servers",
    commands: "Commands",
    settings: "Settings",
    docs: "Documentation"
};


async function route() {

    if (!state.token) {
        showLogin();
        return;
    }

    const parts =
        (
            location.hash ||
            "#/dashboard"
        ).split("/");

    const name =
        parts[1] || "dashboard";

    const parameter =
        parts[2];

    const view =
        views[name]
            ? name
            : "dashboard";


    document
        .querySelectorAll(
            ".nav a[data-route]"
        )
        .forEach((link) => {

            link.classList.toggle(
                "active",
                link.dataset.route === view
            );

        });


    const pageTitle =
        $("#pageTitle");

    if (pageTitle) {
        pageTitle.textContent =
            titles[view];
    }


    const sidebar =
        $("#sidebar");

    if (sidebar) {
        sidebar.classList.remove("open");
    }


    const content =
        $("#content");

    if (!content) {
        console.error(
            "RuleMaster: #content was not found."
        );

        return;
    }


    if (
        view !== "commands" &&
        view !== "docs"
    ) {
        content.innerHTML =
            loadingGrid();
    }


    try {

        content.innerHTML =
            await views[view](
                parameter
            );

        content.style.animation =
            "none";

        content.offsetHeight;

        content.style.animation =
            "";

    } catch (error) {

        console.error(error);

        content.innerHTML =
            empty(
                "Something went wrong: " +
                error.message
            );
    }
}


/* =========================================================
   LOGIN / APP
   ========================================================= */

function showLogin() {

    const app =
        $("#appView");

    const login =
        $("#loginView");

    if (app) {
        app.hidden = true;
    }

    if (login) {
        login.hidden = false;
    }
}


async function showApp() {

    const login =
        $("#loginView");

    const app =
        $("#appView");

    if (login) {
        login.hidden = true;
    }

    if (app) {
        app.hidden = false;
    }


    if (!state.user) {
        state.user =
            await discord(
                "/users/@me"
            );
    }


    const userName =
        $("#userName");

    const userId =
        $("#userId");

    const userAvatar =
        $("#userAvatar");

    if (userName) {
        userName.textContent =
            state.user.global_name ||
            state.user.username;
    }

    if (userId) {
        userId.textContent =
            "@" +
            state.user.username;
    }

    if (userAvatar) {
        userAvatar.src =
            avatarUrl(state.user);
    }


    const invite =
        $("#inviteTop");

    if (invite) {
        invite.href =
            BOT_INVITE();
    }


    await route();
}


/* =========================================================
   EVENTS
   ========================================================= */

function setupEvents() {

    const loginButton =
        $("#loginBtn");

    if (loginButton) {
        loginButton.addEventListener(
            "click",
            login
        );
    }


    const logoutButton =
        $("#logoutBtn");

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            logout
        );
    }


    const menuButton =
        $("#menuBtn");

    if (menuButton) {
        menuButton.addEventListener(
            "click",
            () => {

                const sidebar =
                    $("#sidebar");

                if (sidebar) {
                    sidebar.classList.toggle(
                        "open"
                    );
                }

            }
        );
    }


    document.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key ===
                "Escape"
            ) {

                const sidebar =
                    $("#sidebar");

                if (sidebar) {
                    sidebar.classList.remove(
                        "open"
                    );
                }

            }

        }
    );


    window.addEventListener(
        "hashchange",
        route
    );


    document.addEventListener(
        "input",
        (event) => {

            if (
                event.target.id !==
                "cmdSearch"
            ) {
                return;
            }

            const query =
                event.target.value
                    .toLowerCase();

            const grid =
                $("#cmdGrid");

            if (!grid) {
                return;
            }

            grid.innerHTML =
                cmdCards(
                    COMMANDS.filter(
                        (command) => {

                            const text =
                                (
                                    command.name +
                                    command.desc +
                                    command.cat
                                ).toLowerCase();

                            return text.includes(
                                query
                            );

                        }
                    )
                );

        }
    );


    document.addEventListener(
        "submit",
        (event) => {

            if (
                event.target.id !==
                "settingsForm"
            ) {
                return;
            }

            event.preventDefault();

            const form =
                event.target;

            const data =
                Object.fromEntries(
                    new FormData(form)
                );


            [
                "automod",
                "suggestions",
                "welcome"
            ].forEach(
                (key) => {

                    const checkbox =
                        form.elements[key];

                    data[key] =
                        checkbox
                            ? checkbox.checked
                            : false;

                }
            );


            localStorage.setItem(
                "rm_settings_" +
                form.dataset.id,
                JSON.stringify(data)
            );


            toast(
                "Settings saved ✓"
            );

        }
    );
}


/* =========================================================
   START
   ========================================================= */

setupEvents();

readTokenFromUrl();

state.token =
    loadToken();

if (state.token) {

    showApp().catch(
        (error) => {

            console.error(
                "Could not start dashboard:",
                error
            );

            logout();

        }
    );

} else {

    showLogin();

}