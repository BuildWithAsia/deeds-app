// ========== SERVICE WORKER REGISTRATION ==========
// Register service worker for PWA functionality
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log(
          "[PWA] Service Worker registered successfully:",
          registration.scope,
        );

        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60000); // Check every minute

        // Handle service worker updates
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker.addEventListener("statechange", () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // New service worker available, prompt user to refresh
              if (
                confirm(
                  "A new version of Deeds App is available. Reload to update?",
                )
              ) {
                newWorker.postMessage({ type: "SKIP_WAITING" });
                window.location.reload();
              }
            }
          });
        });
      })
      .catch((error) => {
        console.error("[PWA] Service Worker registration failed:", error);
      });

    // Handle service worker controller change
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

// ========== INSTALL PROMPT ==========
// Handle PWA install prompt
let deferredInstallPrompt;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredInstallPrompt = e;
  console.log("[PWA] Install prompt available");

  // Optionally show install button
  showInstallPromotion();
});

window.addEventListener("appinstalled", () => {
  console.log("[PWA] App installed successfully");
  deferredInstallPrompt = null;
});

function showInstallPromotion() {
  // Check if we should show the install button
  const installButton = document.getElementById("pwa-install-button");
  if (installButton && deferredInstallPrompt) {
    installButton.style.display = "block";
    installButton.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;

      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log("[PWA] User choice:", outcome);

      if (outcome === "accepted") {
        installButton.style.display = "none";
      }
      deferredInstallPrompt = null;
    });
  }
}

// ========== TRANSLATIONS & LANGUAGE ==========
const SUPPORTED_LANGUAGES = ["en", "ht"];
const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "deeds.lang";
const translationsCache = new Map();
let activeLanguage = DEFAULT_LANGUAGE;

// Inline fallback translations (used when JSON files can't be loaded)
const FALLBACK_TRANSLATIONS = {
  en: {
    common: { appName: "Deeds" },
    nav: {
      dashboard: "Dashboard",
      choose: "Choose deed",
      submit: "Submit deed",
      leaderboard: "Leaderboard",
      profile: "Profile",
      verify: "Verify queue",
      logout: "Log out",
    },
    language: {
      englishLabel: "Switch to English",
      creoleLabel: "Switch to Haitian Creole",
    },
  },
};

const SELECTED_DEED_KEY = "deeds.selectedTemplate";

function togglePw() {
  const pw = document.getElementById("pw");
  if (!pw) return;
  pw.type = pw.type === "password" ? "text" : "password";
}

function resolveTranslationKey(key, translations) {
  if (!key || !translations) {
    return null;
  }

  return key.split(".").reduce((acc, part) => {
    if (acc && typeof acc === "object" && part in acc) {
      return acc[part];
    }
    return null;
  }, translations);
}

async function loadTranslations(language) {
  if (translationsCache.has(language)) {
    return translationsCache.get(language);
  }

  try {
    const response = await fetch(`/locales/${language}.json`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Failed to load ${language} translations`);
    }
    const data = await response.json();
    translationsCache.set(language, data);
    return data;
  } catch (error) {
    console.warn("Translation load failed, using fallback", error);
    // Use inline fallback translations
    const fallback =
      FALLBACK_TRANSLATIONS[language] ||
      FALLBACK_TRANSLATIONS[DEFAULT_LANGUAGE];
    if (fallback) {
      translationsCache.set(language, fallback);
      return fallback;
    }
    return null;
  }
}

function translate(key, vars = {}) {
  const translations = translationsCache.get(activeLanguage);
  const fallbackTranslations = translationsCache.get(DEFAULT_LANGUAGE);

  let template = resolveTranslationKey(key, translations);
  if (template == null) {
    template = resolveTranslationKey(key, fallbackTranslations);
  }

  if (typeof template !== "string") {
    return null;
  }

  return template.replace(/{{\s*([^\s}]+)\s*}}/g, (_, token) => {
    const value = token in vars ? vars[token] : null;
    return value != null ? String(value) : "";
  });
}

function translateWithFallback(key, fallback = "", vars = {}) {
  try {
    const result = translate(key, vars);
    if (typeof result === "string" && result.length > 0) {
      return result;
    }
  } catch (error) {
    console.warn("Translation fallback triggered", error);
  }
  return fallback ?? "";
}

if (typeof window !== "undefined") {
  window.deedsTranslate = translate;
  window.deedsTranslateWithFallback = translateWithFallback;
}

function applyTranslations() {
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n");
    if (!key) return;
    const text = translate(key);
    if (text) {
      element.textContent = text;
    }
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.getAttribute("data-i18n-placeholder");
    if (!key) return;
    const text = translate(key);
    if (text) {
      element.setAttribute("placeholder", text);
    }
  });

  document.querySelectorAll("[data-i18n-label]").forEach((element) => {
    const key = element.getAttribute("data-i18n-label");
    if (!key) return;
    const text = translate(key);
    if (text) {
      element.setAttribute("aria-label", text);
    }
  });
}

function updateLanguageToggle(language) {
  document.querySelectorAll("[data-lang-switch]").forEach((button) => {
    const isActive = button.dataset.langSwitch === language;
    button.classList.toggle("bg-teal-600", isActive);
    button.classList.toggle("text-white", isActive);
    button.classList.toggle("border-teal-600", isActive);
    button.classList.toggle("text-slate-600", !isActive);
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
  });
}

async function setLanguage(language) {
  const normalized = SUPPORTED_LANGUAGES.includes(language)
    ? language
    : DEFAULT_LANGUAGE;
  if (activeLanguage === normalized && translationsCache.has(normalized)) {
    applyTranslations();
    updateLanguageToggle(normalized);
    return normalized;
  }

  const translations = await loadTranslations(normalized);
  if (!translations) {
    return activeLanguage;
  }

  translationsCache.set(normalized, translations);
  activeLanguage = normalized;
  document.documentElement.lang = normalized;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized);
  } catch (error) {
    console.warn("Unable to persist language preference", error);
  }

  applyTranslations();
  updateLanguageToggle(normalized);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("deeds:languagechange", {
        detail: { language: normalized },
      }),
    );
  }
  return normalized;
}

async function initLocalization() {
  let preferred = DEFAULT_LANGUAGE;
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      preferred = stored;
    } else {
      const browserLang = navigator?.language?.slice(0, 2)?.toLowerCase();
      if (browserLang && SUPPORTED_LANGUAGES.includes(browserLang)) {
        preferred = browserLang;
      }
    }
  } catch (error) {
    console.warn("Unable to read language preference", error);
  }

  await setLanguage(preferred);

  document.querySelectorAll("[data-lang-switch]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.langSwitch;
      if (target) {
        setLanguage(target);
      }
    });
  });
}

const toneClassMap = {
  success: "text-teal-700",
  error: "text-rose-600",
  info: "text-slate-600",
};

const badgeToneClasses = {
  success: "border-teal-200 bg-teal-50 text-teal-800",
  info: "border-slate-200 bg-slate-50 text-slate-700",
};

const statusChipToneClasses = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  verified: "border-teal-200 bg-teal-50 text-teal-700",
  muted: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusChipDotClasses = {
  pending: "bg-amber-400",
  verified: "bg-teal-500",
  muted: "bg-slate-400",
};

let latestDeedSummary = null;

let sessionProfile = null;

function normalizeDeedTemplate(template) {
  if (!template || typeof template !== "object") {
    return null;
  }

  const normalized = {
    id: template.id != null && template.id !== "" ? String(template.id) : null,
    title: String(template.title || "").trim(),
    category: String(template.category || "").trim(),
    description: String(template.description || "").trim(),
  };

  if (!normalized.title) {
    return null;
  }

  return normalized;
}

function saveSelectedDeedTemplate(template) {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const normalized = normalizeDeedTemplate(template);
  if (!normalized) {
    return null;
  }

  try {
    localStorage.setItem(SELECTED_DEED_KEY, JSON.stringify(normalized));
    return normalized;
  } catch (error) {
    console.warn("Unable to save selected deed template", error);
    return null;
  }
}

function getSelectedDeedTemplate() {
  if (typeof localStorage === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(SELECTED_DEED_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return normalizeDeedTemplate(parsed);
  } catch (error) {
    console.warn("Unable to read selected deed template", error);
    clearSelectedDeedTemplate();
    return null;
  }
}

function clearSelectedDeedTemplate() {
  if (typeof localStorage === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(SELECTED_DEED_KEY);
  } catch (error) {
    console.warn("Unable to clear selected deed template", error);
  }
}

function normalizeStoredProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== "object") {
    return null;
  }

  const normalized = { ...rawProfile };

  // Use role field as the source of truth
  const role = rawProfile.role || "user";
  const isAdmin = role === "admin";

  const sessionToken =
    typeof rawProfile.sessionToken === "string" && rawProfile.sessionToken
      ? rawProfile.sessionToken
      : typeof rawProfile.token === "string" && rawProfile.token
        ? rawProfile.token
        : null;

  normalized.role = role;
  normalized.isAdmin = isAdmin;
  normalized.sessionToken = sessionToken;
  if (sessionToken && !normalized.token) {
    normalized.token = sessionToken;
  }

  return normalized;
}

function setSessionProfile(profile) {
  sessionProfile = profile;
  if (typeof window !== "undefined") {
    window.deedsSessionProfile = profile;
  }
}

function saveProfile(profile) {
  const normalized = normalizeStoredProfile(profile);
  if (!normalized) {
    clearProfile();
    return null;
  }
  if (typeof localStorage === "undefined") {
    setSessionProfile(normalized);
    return normalized;
  }
  try {
    localStorage.setItem("deeds.profile", JSON.stringify(normalized));
  } catch (error) {
    console.warn("Unable to persist profile", error);
  }
  setSessionProfile(normalized);
  return normalized;
}

function getProfile() {
  const data = localStorage.getItem("deeds.profile");
  if (!data) {
    return null;
  }
  try {
    return normalizeStoredProfile(JSON.parse(data));
  } catch (error) {
    console.warn("Unable to parse cached profile", error);
    clearProfile();
    return null;
  }
}

function clearProfile() {
  localStorage.removeItem("deeds.profile");
  clearSelectedDeedTemplate();
  setSessionProfile(null);
}

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const PROTECTED_PAGES = new Set([
  "dashboard.html",
  "submit.html",
  "leaderboard.html",
  "profile.html",
]);

const ADMIN_PAGES = new Set([
  "verify.html",
  "admin/verify.html",
  "admin/dashboard.html",
]);

function isProfileExpired(profile) {
  if (!profile?.timestamp) {
    return false;
  }
  return Date.now() - Number(profile.timestamp) > PROFILE_TTL_MS;
}

function hydrateUI(profile) {
  if (typeof window === "undefined") {
    return;
  }

  const page = window.location.pathname.split("/").pop();
  if (page === "dashboard.html" || page === "profile.html") {
    hydrateDashboard(profile);
  }
  if (profile) {
    renderStatusBadges(latestDeedSummary);
    updateStatusCounters(latestDeedSummary);
  }
}

let currentPage = "";
if (typeof window !== "undefined") {
  const pathname = window.location.pathname;
  currentPage = pathname.split("/").pop();
  const fullPath = pathname.startsWith("/") ? pathname.slice(1) : pathname;

  const isProtected = PROTECTED_PAGES.has(currentPage);
  const isAdmin =
    ADMIN_PAGES.has(currentPage) ||
    ADMIN_PAGES.has(fullPath) ||
    pathname.includes("/admin/");

  if (isProtected || isAdmin) {
    const profile = getProfile();
    if (!profile || isProfileExpired(profile) || !profile?.sessionToken) {
      clearProfile();
      window.location.href = "/login.html";
    } else if (isAdmin && !profile.isAdmin) {
      // Non-admin trying to access admin pages
      alert("Access denied. Administrator privileges required.");
      window.location.href = "/dashboard.html";
    } else {
      setSessionProfile(profile);
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => hydrateUI(profile));
      } else {
        hydrateUI(profile);
      }
    }
  }
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function buildBadgeDescriptors(summary) {
  if (!summary) {
    return [];
  }

  const descriptors = [];

  if (summary.pendingCount > 0) {
    descriptors.push({
      titleKey: "badges.pending.title",
      descriptionKey: "badges.pending.description",
      tone: "info",
      vars: { count: summary.pendingCount },
    });
  }

  if (summary.verifiedCount >= 1) {
    descriptors.push({
      titleKey: "badges.firstVerified.title",
      descriptionKey: "badges.firstVerified.description",
      tone: "success",
      vars: { count: summary.verifiedCount },
    });
  }

  if (summary.verifiedCount >= 5) {
    descriptors.push({
      titleKey: "badges.communityBuilder.title",
      descriptionKey: "badges.communityBuilder.description",
      tone: "success",
      vars: { count: summary.verifiedCount },
    });
  }

  if (summary.verifiedCount >= 10) {
    descriptors.push({
      titleKey: "badges.blockCaptain.title",
      descriptionKey: "badges.blockCaptain.description",
      tone: "success",
      vars: { count: summary.verifiedCount },
    });
  }

  return descriptors;
}

function renderStatusBadges(summary) {
  const pendingCount = summary?.pendingCount ?? 0;
  const verifiedCount = summary?.verifiedCount ?? 0;

  document
    .querySelectorAll('[data-role="status-badges"]')
    .forEach((container) => {
      container.innerHTML = "";

      const statusOverview = document.createElement("div");
      statusOverview.className = "sm:col-span-2";

      const chipRow = document.createElement("div");
      chipRow.className = "flex flex-wrap items-center gap-2";

      const pendingChip = createStatusChip(
        "badges.pendingLabel",
        "Pending",
        pendingCount,
        pendingCount > 0 ? "pending" : "muted",
      );

      const verifiedChip = createStatusChip(
        "badges.verifiedLabel",
        "Verified",
        verifiedCount,
        verifiedCount > 0 ? "verified" : "muted",
      );

      chipRow.appendChild(pendingChip);
      chipRow.appendChild(verifiedChip);
      statusOverview.appendChild(chipRow);
      container.appendChild(statusOverview);

      const descriptors = buildBadgeDescriptors(summary);
      if (!descriptors.length) {
        const empty = document.createElement("p");
        empty.className = "text-sm text-slate-500 sm:col-span-2";
        empty.textContent =
          translate("badges.none") ||
          "Complete a deed to unlock your first badge.";
        container.appendChild(empty);
        return;
      }

      descriptors.forEach((descriptor) => {
        const badge = document.createElement("div");
        const tone = descriptor.tone && badgeToneClasses[descriptor.tone];
        badge.className = `rounded-xl border px-4 py-3 text-sm shadow-sm ${
          tone || "border-slate-200 bg-white text-slate-700"
        }`;

        const title = document.createElement("p");
        title.className = "font-semibold text-slate-900";
        title.textContent =
          translate(descriptor.titleKey, descriptor.vars) || "Status badge";

        const description = document.createElement("p");
        description.className = "mt-1 text-xs text-slate-600";
        description.textContent =
          translate(descriptor.descriptionKey, descriptor.vars) || "";

        badge.appendChild(title);
        badge.appendChild(description);
        container.appendChild(badge);
      });
    });
}

function createStatusChip(labelKey, fallback, count, tone) {
  const label = translate(labelKey, { count }) || fallback;
  const resolvedTone = tone && statusChipToneClasses[tone] ? tone : "muted";

  const chip = document.createElement("span");
  chip.className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
    statusChipToneClasses[resolvedTone]
  }`;

  const indicator = document.createElement("span");
  indicator.className = `h-2 w-2 rounded-full ${
    statusChipDotClasses[resolvedTone] || statusChipDotClasses.muted
  }`;
  indicator.setAttribute("aria-hidden", "true");

  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;

  const countBadge = document.createElement("span");
  countBadge.className =
    "rounded bg-white/60 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-current";
  countBadge.textContent = String(count ?? 0);

  chip.appendChild(indicator);
  chip.appendChild(labelSpan);
  chip.appendChild(countBadge);

  return chip;
}

function updateStatusCounters(summary) {
  const pendingCount = summary?.pendingCount ?? 0;
  const verifiedCount = summary?.verifiedCount ?? 0;
  const latestVerified = summary?.latestVerifiedAt ?? null;

  document
    .querySelectorAll('[data-status-count="pending"]')
    .forEach((element) => {
      element.textContent = pendingCount;
    });

  document
    .querySelectorAll('[data-status-count="verified"]')
    .forEach((element) => {
      element.textContent = verifiedCount;
    });

  document.querySelectorAll("[data-status-latest]").forEach((element) => {
    element.textContent = latestVerified
      ? formatDateTime(latestVerified)
      : translate("badges.latestPlaceholder") || "—";
  });
}

async function refreshDeedStatus(profile) {
  if (!profile?.id || !profile?.sessionToken) {
    renderStatusBadges(latestDeedSummary);
    return;
  }

  try {
    const response = await fetch(
      `/api/deeds?user_id=${profile.id}&status=all`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${profile.sessionToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }

    const data = await response.json();
    const deeds = Array.isArray(data) ? data : [];
    const verified = deeds.filter((item) => item?.status === "verified");
    const pending = deeds.filter((item) => item?.status !== "verified");

    const latestVerifiedRecord = verified.reduce((latest, item) => {
      const candidate = item?.verified_at || item?.created_at;
      if (!candidate) {
        return latest;
      }
      const timestamp = new Date(candidate).getTime();
      if (Number.isNaN(timestamp)) {
        return latest;
      }
      if (!latest || timestamp > latest.timestamp) {
        return { timestamp, value: candidate };
      }
      return latest;
    }, null);

    const summary = {
      totalCount: deeds.length,
      verifiedCount: verified.length,
      pendingCount: pending.length,
      latestVerifiedAt: latestVerifiedRecord?.value ?? null,
    };

    latestDeedSummary = summary;
    updateStatusCounters(summary);
    renderStatusBadges(summary);

    const updatedProfile = {
      ...profile,
      credits: summary.verifiedCount,
      completed: summary.verifiedCount,
      timestamp: Date.now(),
    };

    const normalizedProfile = saveProfile(updatedProfile);
    hydrateDashboard(normalizedProfile || updatedProfile);
  } catch (error) {
    console.error("Unable to refresh deed status", error);
    updateStatusCounters(null);
    renderStatusBadges(null);
  }
}

function setMessage(element, message, tone = "info") {
  if (!element) return;
  element.textContent = message;
  element.classList.remove(...Object.values(toneClassMap));
  if (toneClassMap[tone]) {
    element.classList.add(toneClassMap[tone]);
  }
}

function attachAuthForms() {
  document.querySelectorAll("[data-auth-form]").forEach((form) => {
    const mode = form.dataset.authForm;
    const messageElement = form.querySelector('[data-role="form-message"]');
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const email = String(formData.get("email") || "").trim();
      const password = String(formData.get("password") || "");
      const name = String(formData.get("name") || "").trim();

      if (!email || !password || (mode === "signup" && !name)) {
        setMessage(
          messageElement,
          "Please complete every field to continue.",
          "error",
        );
        return;
      }

      if (password.length < 8) {
        setMessage(
          messageElement,
          "Passwords need to be at least 8 characters long.",
          "error",
        );
        return;
      }

      const endpoint =
        mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const payload =
        mode === "signup" ? { name, email, password } : { email, password };

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.dataset.loading = "true";
        const spinner = submitButton.querySelector("[data-spinner]");
        if (spinner) spinner.classList.remove("hidden");
      }
      setMessage(messageElement, "Checking your details…", "info");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const result = await response.json().catch(() => null);
        if (!response.ok) {
          const fallback =
            result?.message ||
            "We could not verify your details. Please try again.";
          setMessage(messageElement, fallback, "error");
          return;
        }

        if (result?.profile) {
          clearSelectedDeedTemplate();
          saveProfile({
            ...result.profile,
            timestamp: Date.now(),
          });
        }

        setMessage(messageElement, result?.message || "Success!", "success");
        setTimeout(() => {
          let redirectTarget = "dashboard.html";
          if (mode === "signup") {
            redirectTarget = "choose.html";
          } else if (mode === "login" && result?.profile?.isAdmin) {
            // Redirect admins to verify page
            redirectTarget = "/admin/verify.html";
          }
          window.location.href = redirectTarget;
        }, 400);
      } catch (error) {
        console.error("Auth request failed", error);
        setMessage(
          messageElement,
          "We could not reach the server. Please check your connection and try again.",
          "error",
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          delete submitButton.dataset.loading;
          const spinner = submitButton.querySelector("[data-spinner]");
          if (spinner) spinner.classList.add("hidden");
        }
      }
    });
  });
}

function getInitials(name = "") {
  if (!name) return "D";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "D";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (
    parts[0].slice(0, 1).toUpperCase() +
    parts[parts.length - 1].slice(0, 1).toUpperCase()
  );
}

function hydrateDashboard(profile) {
  if (!profile) {
    return;
  }
  const nameTarget = document.querySelector('[data-profile-field="name"]');
  const emailTarget = document.querySelector('[data-profile-field="email"]');
  const createdTarget = document.querySelector(
    '[data-profile-field="createdAt"]',
  );
  const completedTarget = document.querySelector(
    '[data-profile-field="completed"]',
  );
  const initialsTarget = document.querySelector(
    '[data-profile-field="initials"]',
  );

  if (!nameTarget && !emailTarget && !createdTarget) {
    return;
  }

  if (nameTarget) {
    nameTarget.textContent = profile.name || profile.email || "Friend";
  }
  if (emailTarget) {
    emailTarget.textContent = profile.email || "—";
  }
  if (createdTarget) {
    createdTarget.textContent = formatDate(
      profile.createdAt || profile.created,
    );
  }

  if (completedTarget) {
    const summaryCompleted = latestDeedSummary?.verifiedCount;
    const completedValue =
      summaryCompleted != null
        ? summaryCompleted
        : profile.completed != null
          ? profile.completed
          : profile.credits;
    if (completedValue != null) {
      completedTarget.textContent = completedValue;
    }
  }
  if (initialsTarget) {
    initialsTarget.textContent = getInitials(profile.name || profile.email);
  }
}

function attachLogout() {
  document.querySelectorAll('[data-action="logout"]').forEach((button) => {
    button.addEventListener("click", async () => {
      // Call server logout endpoint to clear session cookie
      try {
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch (error) {
        console.error('Logout endpoint error:', error);
      }

      clearProfile();
      window.location.href = "login.html";
    });
  });
}

function attachDeedSelection() {
  if (currentPage !== "choose.html") {
    return;
  }

  const selectionButtons = document.querySelectorAll("[data-deed-option]");
  if (!selectionButtons.length) {
    return;
  }

  const feedbackTarget = document.querySelector(
    '[data-role="choose-feedback"]',
  );
  const existingTemplate =
    typeof getSelectedDeedTemplate === "function"
      ? getSelectedDeedTemplate()
      : null;

  if (existingTemplate && feedbackTarget) {
    const title =
      existingTemplate.title ||
      translate("choose.selectionFallbackTitle") ||
      "this deed";
    const existingMessage =
      translate("choose.selectionExisting", { title }) ||
      `${title} is saved for your submission.`;
    setMessage(feedbackTarget, existingMessage, "info");
  }

  selectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const dataset = button.dataset || {};

      const translatedTitleKey = dataset.deedTitleKey;
      const translatedDescriptionKey = dataset.deedDescriptionKey;
      const localizedTitle = translatedTitleKey
        ? translate(translatedTitleKey)
        : null;
      const localizedDescription = translatedDescriptionKey
        ? translate(translatedDescriptionKey)
        : null;

      const template = {
        id: dataset.deedId || null,
        title:
          (
            localizedTitle ||
            dataset.deedTitle ||
            button.textContent ||
            ""
          ).trim() || "",
        category: (dataset.deedCategory || "").trim(),
        description: (
          localizedDescription ||
          dataset.deedDescription ||
          ""
        ).trim(),
      };

      button.disabled = true;
      button.setAttribute("aria-pressed", "true");

      const savedTemplate = saveSelectedDeedTemplate(template);
      if (!savedTemplate) {
        button.disabled = false;
        button.removeAttribute("aria-pressed");
        const errorMessage =
          translate("choose.selectionError") ||
          "We couldn't save that deed. Please try again.";
        setMessage(feedbackTarget, errorMessage, "error");
        return;
      }

      button.blur();

      const displayTitle =
        savedTemplate.title ||
        translate("choose.selectionFallbackTitle") ||
        "this deed";
      const successMessage =
        translate("choose.selectionSaved", { title: displayTitle }) ||
        `Great choice! We'll prefill ${displayTitle} on your submission form.`;
      setMessage(feedbackTarget, successMessage, "success");

      window.setTimeout(() => {
        const redirectMessage =
          translate("choose.selectionRedirect", { title: displayTitle }) ||
          "Opening your submission form…";
        setMessage(feedbackTarget, redirectMessage, "info");
        window.location.href = "submit.html";
      }, 700);
    });
  });
}

async function loadLeaderboard() {
  const tbody = document.getElementById("leaderboard-body");
  const totalElement = document.querySelector(
    '[data-role="leaderboard-total"]',
  );
  const updatedElement = document.querySelector(
    '[data-role="leaderboard-updated"]',
  );
  const blocksList = document.getElementById("leaderboard-blocks");
  const blocksEmpty = document.querySelector(
    '[data-role="leaderboard-blocks-empty"]',
  );
  const shoutoutsList = document.getElementById("leaderboard-shoutouts");
  const shoutoutsEmpty = document.querySelector(
    '[data-role="leaderboard-shoutouts-empty"]',
  );
  if (!tbody) {
    return;
  }

  if (blocksList) {
    blocksList.innerHTML = "";
  }
  if (blocksEmpty) {
    blocksEmpty.hidden = true;
  }
  if (shoutoutsList) {
    shoutoutsList.innerHTML = "";
  }
  if (shoutoutsEmpty) {
    shoutoutsEmpty.hidden = true;
  }

  try {
    const response = await fetch("/api/leaderboard", {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }

    const data = await response.json();
    const entries = Array.isArray(data) ? data : [];

    // Remove skeleton loaders
    tbody.querySelectorAll("[data-skeleton]").forEach((el) => el.remove());
    tbody.innerHTML = "";

    let totalVerified = 0;
    const regionTotals = new Map();

    // Get current user profile to highlight their row
    const currentProfile = getProfile();
    const currentUserId = currentProfile?.id;

    entries.forEach((user, index) => {
      const row = document.createElement("tr");
      const name = user?.name || translate("leaderboard.anonymous") || "—";
      const credits = Number(user?.credits ?? 0);
      const verified = Number(user?.verified ?? 0);
      const total = Number(user?.total ?? 0);
      totalVerified += verified;

      // Highlight current user's row
      const isCurrentUser = currentUserId && user?.id === currentUserId;
      if (isCurrentUser) {
        row.className = "bg-teal-50";
      }

      const normalizedRegion =
        typeof user?.region === "string" && user.region.trim().length > 0
          ? user.region.trim()
          : translate("leaderboard.regionUnknown") || "Across the neighborhood";
      if (verified > 0) {
        regionTotals.set(
          normalizedRegion,
          (regionTotals.get(normalizedRegion) || 0) + verified,
        );
      }

      const labelKey =
        verified === 1
          ? "leaderboard.deedLabelSingular"
          : "leaderboard.deedLabelPlural";
      const deedLabel =
        translate(labelKey) || (verified === 1 ? "deed" : "deeds");
      const deedMetaText = verified
        ? translate("leaderboard.verifiedMeta", {
            count: verified,
            label: deedLabel,
          }) || `${verified} verified`
        : "";

      const deedMetaHtml = deedMetaText
        ? `<div class="mt-0.5 text-xs text-slate-400">${deedMetaText}</div>`
        : "";

      const userBadge = isCurrentUser
        ? `<span class="ml-2 inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[0.65rem] font-semibold text-teal-700">You</span>`
        : "";

      row.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-600">${index + 1}</td>
        <td class="px-4 py-3"><span class="font-medium">${name}</span>${userBadge}</td>
        <td class="px-4 py-3 text-right">
          <div class="text-sm font-semibold text-slate-700">${credits} credits</div>
          ${deedMetaHtml}
        </td>`;
      tbody.appendChild(row);
    });

    if (tbody.children.length === 0) {
      const emptyRow = document.createElement("tr");
      const emptyMessage =
        translate("leaderboard.empty") ||
        "No neighbors on the leaderboard yet. Complete a deed to claim the top spot!";
      emptyRow.innerHTML = `
        <td class="px-4 py-6 text-center text-slate-500" colspan="3">
      ${emptyMessage}
        </td>`;
      tbody.appendChild(emptyRow);
    }

    if (blocksList) {
      const sortedRegions = Array.from(regionTotals.entries()).sort(
        (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
      );
      const topRegions = sortedRegions.slice(0, 3);

      if (topRegions.length === 0) {
        if (blocksEmpty) {
          blocksEmpty.hidden = false;
        }
      } else {
        topRegions.forEach(([regionName, count]) => {
          const regionLabelKey =
            count === 1
              ? "leaderboard.deedLabelSingular"
              : "leaderboard.deedLabelPlural";
          const regionLabel =
            translate(regionLabelKey) || (count === 1 ? "deed" : "deeds");
          const regionMeta =
            translate("leaderboard.verifiedMeta", {
              count,
              label: regionLabel,
            }) || `${count} ${regionLabel} verified`;

          const item = document.createElement("li");
          item.className =
            "flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2";
          item.innerHTML = `
            <span>${regionName}</span>
            <span class="font-semibold text-teal-700">${regionMeta}</span>
          `;
          blocksList.appendChild(item);
        });
      }
    }

    if (shoutoutsList) {
      const highlightNeighbors = entries
        .filter((user) => {
          const verified = Number(user?.verified ?? 0);
          const creditCount = Number(user?.credits ?? 0);
          return verified > 0 || creditCount > 0;
        })
        .slice(0, 2);

      if (highlightNeighbors.length === 0) {
        if (shoutoutsEmpty) {
          shoutoutsEmpty.hidden = false;
        }
      } else {
        highlightNeighbors.forEach((user) => {
          const name = user?.name || translate("leaderboard.anonymous") || "—";
          const verified = Number(user?.verified ?? 0);
          const regionName =
            typeof user?.region === "string" && user.region.trim().length > 0
              ? user.region.trim()
              : translate("leaderboard.regionUnknown") ||
                "Across the neighborhood";

          const metaParts = [];
          if (verified > 0) {
            const labelKey =
              verified === 1
                ? "leaderboard.deedLabelSingular"
                : "leaderboard.deedLabelPlural";
            const deedLabel =
              translate(labelKey) || (verified === 1 ? "deed" : "deeds");
            const deedMeta =
              translate("leaderboard.verifiedMeta", {
                count: verified,
                label: deedLabel,
              }) || `${verified} ${deedLabel} verified`;
            metaParts.push(deedMeta);
          }

          if (regionName) {
            metaParts.push(regionName);
          }

          const item = document.createElement("li");
          item.className = "rounded-xl border border-slate-100 bg-slate-50 p-4";
          const description = metaParts.join(" · ");
          item.innerHTML = `
            <p class="font-semibold">${name}</p>
            <p class="mt-1 text-slate-600">${description}</p>
          `;
          shoutoutsList.appendChild(item);
        });
      }
    }

    if (totalElement) {
      totalElement.textContent = totalVerified.toLocaleString();
    }

    if (updatedElement) {
      const now = new Date();
      const formattedTime = new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
      }).format(now);
      updatedElement.textContent =
        translate("leaderboard.updatedAt", { time: formattedTime }) ||
        `Updated ${formattedTime}`;
    }
  } catch (error) {
    console.error("Failed to load leaderboard", error);
    const errorMessage =
      translate("leaderboard.error") ||
      "We couldn't load the leaderboard right now. Please try again later.";
    tbody.innerHTML = `
      <tr>
        <td class="px-4 py-6 text-center text-slate-500" colspan="3">
          ${errorMessage}
        </td>
      </tr>`;

    if (blocksEmpty) {
      blocksEmpty.hidden = false;
    }
    if (shoutoutsEmpty) {
      shoutoutsEmpty.hidden = false;
    }
  }
}

function attachPasswordToggles() {
  document.querySelectorAll("[data-toggle-password]").forEach((button) => {
    const targetId = button.dataset.togglePassword;
    const input = document.getElementById(targetId);
    if (!input) return;

    const eyeIcon = button.querySelector('[data-icon="eye"]');
    const eyeOffIcon = button.querySelector('[data-icon="eye-off"]');

    button.addEventListener("click", () => {
      const isPassword = input.type === "password";
      input.type = isPassword ? "text" : "password";

      if (eyeIcon) eyeIcon.classList.toggle("hidden", isPassword);
      if (eyeOffIcon) eyeOffIcon.classList.toggle("hidden", !isPassword);

      button.setAttribute(
        "aria-label",
        isPassword ? "Hide password" : "Show password",
      );
    });
  });
}

function autoFocusEmailField() {
  const emailInput =
    document.getElementById("login-email") ||
    document.getElementById("signup-email");
  if (emailInput && !emailInput.value) {
    setTimeout(() => emailInput.focus(), 100);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    await initLocalization();
    attachAuthForms();
    attachLogout();
    attachDeedSelection();
    attachPasswordToggles();
    autoFocusEmailField();

    if (!sessionProfile && PROTECTED_PAGES.has(currentPage)) {
      const profile = getProfile();
      if (profile && !isProfileExpired(profile)) {
        setSessionProfile(profile);
      }
    }

    if (sessionProfile) {
      hydrateUI(sessionProfile);
      refreshDeedStatus(sessionProfile);
    }

    if (currentPage === "leaderboard.html") {
      await loadLeaderboard();
      window.setInterval(loadLeaderboard, 10_000);
    }
  });

  window.addEventListener("deeds:submitted", () => {
    if (sessionProfile) {
      refreshDeedStatus(sessionProfile);
    }
  });
}

const testingExports = {
  cacheTranslations(language, data) {
    translationsCache.set(language, data);
  },
  clearTranslations() {
    translationsCache.clear();
  },
  setActiveLanguage(language) {
    activeLanguage = language;
  },
  getActiveLanguage() {
    return activeLanguage;
  },
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    resolveTranslationKey,
    translate,
    buildBadgeDescriptors,
    SUPPORTED_LANGUAGES,
    DEFAULT_LANGUAGE,
    testing: testingExports,
  };
}
