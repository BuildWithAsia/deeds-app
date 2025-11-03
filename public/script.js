const SUPPORTED_LANGUAGES = ["en", "ht"];
const DEFAULT_LANGUAGE = "en";
const LANGUAGE_STORAGE_KEY = "deeds.lang";
const translationsCache = new Map();
let activeLanguage = DEFAULT_LANGUAGE;

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
    console.warn("Translation load failed", error);
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

if (typeof window !== "undefined") {
  window.deedsTranslate = translate;
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

function normalizeStoredProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== "object") {
    return null;
  }

  const normalized = { ...rawProfile };

  const adminFlag =
    rawProfile.isAdmin != null
      ? !!rawProfile.isAdmin
      : rawProfile.is_admin != null
        ? !!rawProfile.is_admin
        : false;

  const sessionToken =
    typeof rawProfile.sessionToken === "string" && rawProfile.sessionToken
      ? rawProfile.sessionToken
      : typeof rawProfile.token === "string" && rawProfile.token
        ? rawProfile.token
        : null;

  normalized.isAdmin = adminFlag;
  normalized.is_admin =
    rawProfile.is_admin != null ? !!rawProfile.is_admin : adminFlag;
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
  localStorage.setItem("deeds.profile", JSON.stringify(normalized));
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
  setSessionProfile(null);
}

const PROFILE_TTL_MS = 24 * 60 * 60 * 1000;
const PROTECTED_PAGES = new Set([
  "dashboard.html",
  "submit.html",
  "leaderboard.html",
  "profile.html",
  "verify.html",
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
  currentPage = window.location.pathname.split("/").pop();

  if (PROTECTED_PAGES.has(currentPage)) {
    const profile = getProfile();
    if (!profile || isProfileExpired(profile) || !profile?.sessionToken) {
      clearProfile();
      window.location.href = "login.html";
    } else if (currentPage === "verify.html" && !profile.isAdmin) {
      window.location.href = "dashboard.html";
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
    hydrateDashboard(profile);
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
          saveProfile({
            ...result.profile,
            timestamp: Date.now(),
          });
        }

        setMessage(messageElement, result?.message || "Success!", "success");
        setTimeout(() => {
          window.location.href = "dashboard.html";
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
    button.addEventListener("click", () => {
      clearProfile();
      window.location.href = "login.html";
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
  if (!tbody) {
    return;
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
    tbody.innerHTML = "";

    let totalVerified = 0;

    entries.forEach((user, index) => {
      const row = document.createElement("tr");
      const name = user?.name || translate("leaderboard.anonymous") || "—";
      const credits = Number(user?.credits ?? 0);
      const deedCount = Number(user?.deedCount ?? 0);
      totalVerified += deedCount;

      const labelKey =
        deedCount === 1
          ? "leaderboard.deedLabelSingular"
          : "leaderboard.deedLabelPlural";
      const deedLabel =
        translate(labelKey) || (deedCount === 1 ? "deed" : "deeds");
      const deedMetaText = deedCount
        ? translate("leaderboard.verifiedMeta", {
            count: deedCount,
            label: deedLabel,
          }) || `${deedCount} ${deedLabel}`
        : "";

      const deedMetaHtml = deedMetaText
        ? `<div class="mt-0.5 text-xs text-slate-400">${deedMetaText}</div>`
        : "";

      row.innerHTML = `
        <td class="px-4 py-3 font-medium text-slate-600">${index + 1}</td>
        <td class="px-4 py-3">${name}</td>
        <td class="px-4 py-3 text-right">
          <div class="text-sm font-semibold text-slate-700">${credits}</div>
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

    if (totalElement) {
      const totalMessage =
        translate("leaderboard.totalCount", { count: totalVerified }) ||
        `${totalVerified} verified deeds`;
      totalElement.textContent = totalMessage;
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
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("DOMContentLoaded", async () => {
    await initLocalization();
    attachAuthForms();
    attachLogout();

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
