/* ===== CONFIG ===== */
const CLIENT_ID = "1554166316628320306";
const REDIRECT_URI = window.location.origin + window.location.pathname; // must be added in Discord Developer Portal
const BOT_API_URL = ""; // optional: your Railway endpoint returning ["guildId", ...] the bot is in
const BOT_INVITE = (guildId) =>
  `https://discord.com/oauth2/authorize?client_id=${CLIENT_ID}&permissions=8&scope=bot%20applications.commands` +
  (guildId ? `&guild_id=${guildId}&disable_guild_select=true` : "");

const COMMANDS = [
  { name: "/rules", cat: "Rules", desc: "Show the server rules." },
  { name: "/warn", cat: "Moderation", desc: "Warn a member with a reason." },
  { name: "/kick", cat: "Moderation", desc: "Kick a member from the server." },
  { name: "/ban", cat: "Moderation", desc: "Ban a member from the server." },
  { name: "/timeout", cat: "Moderation", desc: "Temporarily mute a member." },
  { name: "/suggest", cat: "Community", desc: "Submit a suggestion for the server." },
  { name: "/announce", cat: "Staff", desc: "Post an announcement to a channel." },
  { name: "/roblox", cat: "Roblox", desc: "Look up a Roblox user." },
];

/* ===== STATE ===== */
const state = { token: null, user: null, guilds: null, botGuilds: null };
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ===== AUTH ===== */
function login() {
  const oauthState = crypto.randomUUID();
  sessionStorage.setItem("oauth_state", oauthState);
  const url = new URL("https://discord.com/oauth2/authorize");
  url.search = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: "identify guilds",
    state: oauthState,
    prompt: "none",
  });
  window.location.href = url.toString();
}

function readTokenFromUrl() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const token = hash.get("access_token");
  if (!token) return;
  if (hash.get("state") !== sessionStorage.getItem("oauth_state")) {
    toast("Login failed: invalid state.");
    return;
  }
  const expires = Date.now() + Number(hash.get("expires_in") || 604800) * 1000;
  localStorage.setItem("rm_token", JSON.stringify({ token, expires }));
  history.replaceState(null, "", window.location.pathname + "#/dashboard");
}

function loadToken() {
  try {
    const t = JSON.parse(localStorage.getItem("rm_token"));
    if (t && t.expires > Date.now()) return t.token;
  } catch {}
  localStorage.removeItem("rm_token");
  return null;
}

function logout() {
  localStorage.removeItem("rm_token");
  Object.assign(state, { token: null, user: null, guilds: null });
  location.hash = "";
  showLogin();
}

async function discord(path) {
  const res = await fetch("https://discord.com/api/v10" + path, {
    headers: { Authorization: `Bearer ${state.token}` },
  });
  if (res.status === 401) { logout(); throw new Error("Session expired"); }
  if (!res.ok) throw new Error(`Discord error ${res.status}`);
  return res.json();
}

/* ===== DATA ===== */
const canManage = (g) => g.owner || (BigInt(g.permissions) & 0x8n) || (BigInt(g.permissions) & 0x20n);

async function getGuilds() {
  if (state.guilds) return state.guilds;
  const all = await discord("/users/@me/guilds?with_counts=true");
  state.guilds = all.filter(canManage);
  if (BOT_API_URL && !state.botGuilds) {
    try { state.botGuilds = new Set(await (await fetch(BOT_API_URL)).json()); } catch { state.botGuilds = null; }
  }
  return state.guilds;
}

const botStatus = (id) => (state.botGuilds ? (state.botGuilds.has(id) ? "on" : "off") : "unknown");
const avatarUrl = (u) =>
  u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=128`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;
const iconHtml = (g) =>
  g.icon
    ? `<img class="server-icon" src="https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128" alt="">`
    : `<div class="server-icon">${esc(g.name.split(/\s+/).map((w) => w[0]).join("").slice(0, 3))}</div>`;

/* ===== VIEWS ===== */
function serverCard(g) {
  const s = botStatus(g.id);
  const label = { on: "Bot: Installed", off: "Bot: Not installed", unknown: "Bot: Unknown" }[s];
  const action =
    s === "on"
      ? `<a class="btn btn-primary" href="#/settings/${g.id}">Manage Server</a>`
      : `<a class="btn btn-ghost" href="${BOT_INVITE(g.id)}" target="_blank" rel="noopener">Add RuleMaster ↗</a>
         ${s === "unknown" ? `<a class="btn btn-primary" href="#/settings/${g.id}">Manage Server</a>` : ""}`;
  return `
    <article class="card server-card">
      <div class="server-head">
        ${iconHtml(g)}
        <div style="min-width:0">
          <h3>${esc(g.name)}</h3>
          <code>${g.id}</code>
        </div>
      </div>
      <div class="muted" style="font-size:13px">${g.approximate_member_count ? g.approximate_member_count.toLocaleString() + " members" : "Members: n/a"}</div>
      <span class="badge ${s}">${label}</span>
      ${action}
    </article>`;
}

const loadingGrid = () => `<div class="grid">${'<div class="skeleton"></div>'.repeat(6)}</div>`;

const views = {
  async dashboard() {
    const guilds = await getGuilds();
    const installed = state.botGuilds ? guilds.filter((g) => state.botGuilds.has(g.id)).length : "–";
    const members = guilds.reduce((a, g) => a + (g.approximate_member_count || 0), 0);
    return `
      <h1 style="font-size:28px;margin-bottom:6px">Welcome back, ${esc(state.user.global_name || state.user.username)} 👋</h1>
      <p class="muted" style="margin:0 0 26px">Here's what's happening with RuleMaster.</p>
      <div class="stats">
        <div class="card stat"><small>Manageable servers</small><strong>${guilds.length}</strong></div>
        <div class="card stat"><small>With RuleMaster</small><strong>${installed}</strong></div>
        <div class="card stat"><small>Total members</small><strong>${members.toLocaleString()}</strong></div>
        <div class="card stat"><small>Commands</small><strong>${COMMANDS.length}</strong></div>
      </div>
      <h3 class="section-title">Your servers</h3>
      <div class="grid">${guilds.slice(0, 6).map(serverCard).join("") || empty("No servers you can manage.")}</div>`;
  },

  async servers() {
    const guilds = await getGuilds();
    return `<div class="grid">${guilds.map(serverCard).join("") || empty("No servers you can manage.")}</div>`;
  },

  async commands() {
    return `
      <input class="search" id="cmdSearch" placeholder="Search commands…" aria-label="Search commands">
      <div class="grid" id="cmdGrid">${cmdCards(COMMANDS)}</div>`;
  },

  async settings(id) {
    const guilds = await getGuilds();
    if (!id) {
      return `<p class="muted" style="margin-top:0">Choose a server to configure.</p>
        <div class="grid">${guilds.map(serverCard).join("") || empty("No servers you can manage.")}</div>`;
    }
    const g = guilds.find((x) => x.id === id);
    if (!g) return empty("You don't have permission to manage this server.");
    const s = JSON.parse(localStorage.getItem("rm_settings_" + id) || "{}");
    return `
      <div class="card" style="margin-bottom:20px"><div class="server-head">${iconHtml(g)}<div><h3>${esc(g.name)}</h3><code>${g.id}</code></div></div></div>
      <form class="form card" id="settingsForm" data-id="${id}">
        <div class="field"><label>Command prefix</label><input name="prefix" value="${esc(s.prefix || "!")}"></div>
        <div class="field"><label>Log channel ID</label><input name="logChannel" value="${esc(s.logChannel || "")}" placeholder="123456789012345678"></div>
        <div class="field"><label>Language</label>
          <select name="lang">${["English", "Deutsch"].map((l) => `<option ${s.lang === l ? "selected" : ""}>${l}</option>`).join("")}</select></div>
        <div class="field"><label>Server rules</label><textarea name="rules">${esc(s.rules || "")}</textarea></div>
        ${toggle("automod", "Auto moderation", s.automod)}
        ${toggle("suggestions", "Suggestions system", s.suggestions)}
        ${toggle("welcome", "Welcome messages", s.welcome)}
        <div><button class="btn btn-primary" type="submit">Save changes</button></div>
      </form>`;
  },

  async docs() {
    return `<div class="card" style="max-width:760px;line-height:1.7">
      <h3>Getting started</h3>
      <p class="muted">1. Add RuleMaster to your server from the Servers page.<br>2. Open Settings for that server and configure it.<br>3. Use <code>/rules</code> in Discord to test.</p>
      <h3 style="margin-top:20px">Permissions</h3>
      <p class="muted">You can only manage servers where you are the owner, an administrator, or have “Manage Server”.</p>
    </div>`;
  },
};

const toggle = (name, label, on) => `
  <div class="switch-row"><span>${label}</span>
    <label class="switch"><input type="checkbox" name="${name}" ${on ? "checked" : ""}><span></span></label></div>`;
const empty = (msg) => `<div class="empty" style="grid-column:1/-1">${msg}</div>`;
const cmdCards = (list) =>
  list.map((c) => `<div class="card cmd"><span class="tag">${c.cat}</span><br><code>${c.name}</code><p>${c.desc}</p></div>`).join("") ||
  empty("No commands found.");

/* ===== ROUTER ===== */
const titles = { dashboard: "Dashboard", servers: "Servers", commands: "Commands", settings: "Settings", docs: "Documentation" };

async function route() {
  if (!state.token) return showLogin();
  const [, name = "dashboard", param] = (location.hash || "#/dashboard").split("/");
  const view = views[name] ? name : "dashboard";

  document.querySelectorAll(".nav a[data-route]").forEach((a) => a.classList.toggle("active", a.dataset.route === view));
  $("#pageTitle").textContent = titles[view];
  $("#sidebar").classList.remove("open");

  const content = $("#content");
  content.innerHTML = view === "commands" || view === "docs" ? "" : loadingGrid();
  try {
    content.innerHTML = await views[view](param);
    content.style.animation = "none"; content.offsetHeight; content.style.animation = "";
  } catch (e) {
    content.innerHTML = empty("Something went wrong: " + esc(e.message));
  }
}

/* ===== UI ===== */
function showLogin() {
  $("#appView").hidden = true;
  $("#loginView").hidden = false;
}

async function showApp() {
  $("#loginView").hidden = true;
  $("#appView").hidden = false;
  if (!state.user) state.user = await discord("/users/@me");
  $("#userName").textContent = state.user.global_name || state.user.username;
  $("#userId").textContent = "@" + state.user.username;
  $("#userAvatar").src = avatarUrl(state.user);
  $("#inviteTop").href = BOT_INVITE();
  route();
}

let toastTimer;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2500);
}

/* ===== EVENTS ===== */
$("#loginBtn").addEventListener("click", login);
$("#logoutBtn").addEventListener("click", logout);
$("#menuBtn").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
document.addEventListener("keydown", (e) => e.key === "Escape" && $("#sidebar").classList.remove("open"));
window.addEventListener("hashchange", route);

document.addEventListener("input", (e) => {
  if (e.target.id !== "cmdSearch") return;
  const q = e.target.value.toLowerCase();
  $("#cmdGrid").innerHTML = cmdCards(COMMANDS.filter((c) => (c.name + c.desc + c.cat).toLowerCase().includes(q)));
});

document.addEventListener("submit", (e) => {
  if (e.target.id !== "settingsForm") return;
  e.preventDefault();
  const f = e.target;
  const data = Object.fromEntries(new FormData(f));
  ["automod", "suggestions", "welcome"].forEach((k) => (data[k] = f[k].checked));
  localStorage.setItem("rm_settings_" + f.dataset.id, JSON.stringify(data));
  toast("Settings saved ✓");
});

/* ===== START ===== */
readTokenFromUrl();
state.token = loadToken();
state.token ? showApp().catch(() => showLogin()) : showLogin();
