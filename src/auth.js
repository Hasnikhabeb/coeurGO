(() => {
"use strict";

const refs = {
  overlay: document.getElementById("authOverlay"),
  title: document.getElementById("authTitle"),
  copy: document.getElementById("authCopy"),
  loginTab: document.getElementById("authLoginTab"),
  signupTab: document.getElementById("authSignupTab"),
  form: document.getElementById("authForm"),
  nameField: document.getElementById("authNameField"),
  displayName: document.getElementById("authDisplayName"),
  email: document.getElementById("authEmail"),
  password: document.getElementById("authPassword"),
  message: document.getElementById("authMessage"),
  submit: document.getElementById("authSubmitBtn"),
  note: document.getElementById("authNote"),
  sessionBar: document.getElementById("sessionBar"),
  sessionName: document.getElementById("sessionName"),
  logoutBtn: document.getElementById("logoutBtn"),
  adminBtn: document.getElementById("adminPanelBtn"),
  adminPanel: document.getElementById("adminPanel"),
  adminClose: document.getElementById("adminCloseBtn"),
  adminSummary: document.getElementById("adminSummary"),
  adminList: document.getElementById("adminList")
};

let client = null;
let session = null;
let profile = null;
let mode = "login";
let initPromise = null;

function config() {
  return window.__COEURGO_SUPABASE_CONFIG__ || {};
}

function hasSupabaseConfig() {
  const { url, anonKey } = config();
  return Boolean(url && anonKey && window.supabase?.createClient);
}

function setHidden(element, hidden) {
  if (element) element.hidden = hidden;
}

function showMessage(text, type = "error") {
  if (!refs.message) return;
  refs.message.textContent = text;
  refs.message.dataset.type = type;
  refs.message.hidden = !text;
}

function roleLabel(role) {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Admin";
  return "Joueur";
}

function isAdminProfile(item = profile) {
  return ["admin", "super_admin"].includes(item?.role);
}

function isSuperAdmin() {
  return profile?.role === "super_admin";
}

function displayNameFor(userProfile = profile, fallbackEmail = "") {
  const email = userProfile?.email || fallbackEmail;
  return userProfile?.display_name || (email ? email.split("@")[0] : "Joueur");
}

function setMode(nextMode) {
  mode = nextMode === "signup" ? "signup" : "login";
  refs.loginTab?.classList.toggle("is-active", mode === "login");
  refs.signupTab?.classList.toggle("is-active", mode === "signup");
  setHidden(refs.nameField, mode !== "signup");
  if (refs.password) refs.password.autocomplete = mode === "signup" ? "new-password" : "current-password";
  if (refs.title) refs.title.textContent = mode === "signup" ? "Inscription" : "Connexion";
  if (refs.copy) {
    refs.copy.textContent = mode === "signup"
      ? "Cree ton compte pour suivre ton score et tes validations."
      : "Connecte-toi pour sauvegarder ton score et tes validations.";
  }
  if (refs.submit) refs.submit.textContent = mode === "signup" ? "Creer le compte" : "Se connecter";
  if (refs.note) {
    refs.note.textContent = mode === "signup"
      ? "Un email de confirmation peut etre demande selon le reglage Supabase."
      : "Les comptes sont securises par Supabase Auth.";
  }
  showMessage("");
}

function updateSessionUi() {
  const signedIn = Boolean(session?.user);
  document.body.classList.toggle("login-locked", hasSupabaseConfig() && !signedIn);
  setHidden(refs.overlay, signedIn || !hasSupabaseConfig());
  setHidden(refs.sessionBar, !signedIn);
  setHidden(refs.adminBtn, !signedIn || !isAdminProfile());
  if (refs.sessionName) {
    refs.sessionName.textContent = signedIn
      ? `${displayNameFor(profile, session.user.email)} - ${roleLabel(profile?.role)}`
      : "Invite";
  }
}

async function ensureProfile(user) {
  if (!client || !user) return null;
  const nextProfile = {
    id: user.id,
    email: user.email,
    display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || "Joueur"
  };

  await client.from("profiles").upsert(nextProfile, { onConflict: "id" });
  const { data, error } = await client
    .from("profiles")
    .select("id,email,display_name,role,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw error;
  return data || { ...nextProfile, role: "player" };
}

async function refreshSession(nextSession = session) {
  session = nextSession;
  profile = session?.user ? await ensureProfile(session.user) : null;
  updateSessionUi();
  if (session?.user) {
    window.dispatchEvent(new CustomEvent("coeurgo:auth-session", {
      detail: { profile, session }
    }));
  }
  return { enabled: hasSupabaseConfig(), session, profile };
}

async function submitAuth(event) {
  event.preventDefault();
  if (!client) return;
  const email = refs.email?.value.trim();
  const password = refs.password?.value || "";
  const displayName = refs.displayName?.value.trim();
  if (!email || !password) {
    showMessage("Email et mot de passe obligatoires.");
    return;
  }

  refs.submit.disabled = true;
  showMessage("");
  try {
    const response = mode === "signup"
      ? await client.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName || email.split("@")[0] } }
      })
      : await client.auth.signInWithPassword({ email, password });

    if (response.error) throw response.error;
    if (response.data.session) {
      await refreshSession(response.data.session);
      showMessage("");
      return;
    }
    showMessage("Compte cree. Verifie ton email pour activer la connexion.", "info");
  } catch (error) {
    showMessage(error.message || "Connexion impossible pour le moment.");
  } finally {
    refs.submit.disabled = false;
  }
}

function normalizeRemoteState(data) {
  if (!data) return null;
  return {
    score: data.score,
    missionStep: data.mission_step,
    currentAEDId: data.current_aed_id,
    verifiedIds: data.verified_ids || [],
    photos: data.photos || {},
    customAeds: data.custom_aeds || []
  };
}

async function loadGameState() {
  if (!client || !session?.user) return null;
  const { data, error } = await client
    .from("game_states")
    .select("score,mission_step,current_aed_id,verified_ids,photos,custom_aeds,updated_at")
    .eq("user_id", session.user.id)
    .maybeSingle();
  if (error) throw error;
  return normalizeRemoteState(data);
}

async function saveGameState(snapshot) {
  if (!client || !session?.user || !snapshot) return;
  const payload = {
    user_id: session.user.id,
    score: Number(snapshot.score) || 0,
    mission_step: Number(snapshot.missionStep) || 0,
    current_aed_id: snapshot.currentAEDId || null,
    verified_ids: Array.isArray(snapshot.verifiedIds) ? snapshot.verifiedIds : [],
    photos: snapshot.photos && typeof snapshot.photos === "object" ? snapshot.photos : {},
    custom_aeds: Array.isArray(snapshot.customAeds) ? snapshot.customAeds : [],
    updated_at: new Date().toISOString()
  };
  const { error } = await client.from("game_states").upsert(payload, { onConflict: "user_id" });
  if (error) throw error;
}

async function recordScoreEvent(event) {
  if (!client || !session?.user || !event) return;
  const { error } = await client.from("score_events").insert({
    user_id: session.user.id,
    action: String(event.action || "score"),
    points: Number(event.points) || 0,
    aed_id: event.aedId || null,
    metadata: event.metadata && typeof event.metadata === "object" ? event.metadata : {}
  });
  if (error) throw error;
}

async function refreshAdmin() {
  if (!client || !isAdminProfile()) return;
  if (refs.adminSummary) refs.adminSummary.textContent = "Chargement...";
  if (refs.adminList) refs.adminList.innerHTML = "";

  const [{ data: profiles, error: profilesError }, { data: states, error: statesError }] = await Promise.all([
    client.from("profiles").select("id,email,display_name,role,created_at").order("created_at", { ascending: false }),
    client.from("game_states").select("user_id,score,verified_ids,updated_at")
  ]);
  if (profilesError) throw profilesError;
  if (statesError) throw statesError;

  const statesByUser = new Map((states || []).map(item => [item.user_id, item]));
  const items = profiles || [];
  if (refs.adminSummary) {
    refs.adminSummary.textContent = `${items.length} compte${items.length > 1 ? "s" : ""} - roles ${isSuperAdmin() ? "modifiables" : "lecture seule"}`;
  }
  if (!refs.adminList) return;

  refs.adminList.innerHTML = "";
  for (const item of items) {
    const state = statesByUser.get(item.id) || {};
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML = `
      <div class="admin-user">
        <strong></strong>
        <span></span>
        <small></small>
      </div>
      <div class="admin-stats">
        <span>${Number(state.score) || 0} XP</span>
        <span>${Array.isArray(state.verified_ids) ? state.verified_ids.length : 0} DAE</span>
      </div>
      <select class="admin-role" ${isSuperAdmin() ? "" : "disabled"}>
        <option value="player">Joueur</option>
        <option value="admin">Admin</option>
        <option value="super_admin">Super admin</option>
      </select>
    `;
    row.querySelector("strong").textContent = displayNameFor(item);
    row.querySelector("span").textContent = item.email || "email inconnu";
    row.querySelector("small").textContent = state.updated_at
      ? `Score mis a jour ${new Date(state.updated_at).toLocaleString("fr-FR")}`
      : "Aucun score synchronise";
    const select = row.querySelector("select");
    select.value = item.role || "player";
    select.addEventListener("change", async () => {
      select.disabled = true;
      try {
        const { error } = await client.rpc("set_user_role", {
          target_user_id: item.id,
          next_role: select.value
        });
        if (error) throw error;
        await refreshAdmin();
      } catch (error) {
        showMessage(error.message || "Role impossible a modifier.");
        select.value = item.role || "player";
        select.disabled = false;
      }
    });
    refs.adminList.append(row);
  }
}

async function init() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    setMode("login");
    if (!hasSupabaseConfig()) {
      document.body.classList.remove("login-locked");
      setHidden(refs.overlay, true);
      setHidden(refs.sessionBar, true);
      return { enabled: false, session: null, profile: null };
    }

    client = window.supabase.createClient(config().url, config().anonKey);
    refs.loginTab?.addEventListener("click", () => setMode("login"));
    refs.signupTab?.addEventListener("click", () => setMode("signup"));
    refs.form?.addEventListener("submit", submitAuth);
    refs.logoutBtn?.addEventListener("click", async () => {
      await client.auth.signOut();
      session = null;
      profile = null;
      updateSessionUi();
      window.dispatchEvent(new CustomEvent("coeurgo:auth-signout"));
    });
    refs.adminBtn?.addEventListener("click", async () => {
      setHidden(refs.adminPanel, false);
      try {
        await refreshAdmin();
      } catch (error) {
        if (refs.adminSummary) refs.adminSummary.textContent = error.message || "Administration indisponible.";
      }
    });
    refs.adminClose?.addEventListener("click", () => setHidden(refs.adminPanel, true));

    client.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        refreshSession(nextSession).catch(error => showMessage(error.message || "Session incomplete."));
      }
      if (event === "SIGNED_OUT") {
        session = null;
        profile = null;
        updateSessionUi();
      }
    });

    const { data, error } = await client.auth.getSession();
    if (error) showMessage(error.message || "Session Supabase indisponible.");
    return refreshSession(data?.session || null);
  })();
  return initPromise;
}

window.CoeurGoAuth = Object.freeze({
  init,
  loadGameState,
  saveGameState,
  recordScoreEvent,
  refreshAdmin,
  getProfile: () => profile,
  isReady: () => Boolean(session?.user)
});
})();
