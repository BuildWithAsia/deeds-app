// Use translation function from script.js (already loaded)
// Don't redeclare - script.js already defines translateWithFallback and t()
// These functions are available globally from script.js

const toneClassMap = {
  success: "text-teal-700",
  error: "text-rose-600",
  info: "text-slate-600",
};

const statusToneClasses = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  verified: "border-teal-200 bg-teal-50 text-teal-700",
  muted: "border-slate-200 bg-slate-50 text-slate-600",
};

const statusDotClasses = {
  pending: "bg-amber-400",
  verified: "bg-teal-500",
  muted: "bg-slate-400",
};

function normalizeProfile(rawProfile) {
  if (!rawProfile || typeof rawProfile !== "object") {
    return null;
  }

  // Use role field as the source of truth
  const role = rawProfile.role || "user";
  const isAdmin = role === "admin";

  const sessionToken =
    typeof rawProfile.sessionToken === "string" && rawProfile.sessionToken
      ? rawProfile.sessionToken
      : typeof rawProfile.token === "string" && rawProfile.token
        ? rawProfile.token
        : null;

  return {
    ...rawProfile,
    role,
    isAdmin,
    sessionToken,
  };
}

function getActiveProfile() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.deedsSessionProfile) {
    return normalizeProfile(window.deedsSessionProfile);
  }

  const stored = window.localStorage?.getItem("deeds.profile");
  if (!stored) {
    return null;
  }

  try {
    return normalizeProfile(JSON.parse(stored));
  } catch (error) {
    console.warn("Unable to parse stored admin profile", error);
    return null;
  }
}

let activeProfile = getActiveProfile();
let currentQueueItems = [];

function requireAdminSession() {
  activeProfile = getActiveProfile();
  if (!activeProfile || !activeProfile.isAdmin || !activeProfile.sessionToken) {
    toastManager.error(
      t(
        "verify.adminRequired",
        "Administrator session required. Please log in again.",
      ),
    );
    return false;
  }
  return true;
}

function setFlash(message, tone = "info") {
  const flash = document.querySelector('[data-role="flash"]');
  if (!flash) return;

  flash.textContent = message || "";
  flash.classList.remove(...Object.values(toneClassMap));
  if (tone && toneClassMap[tone]) {
    flash.classList.add(toneClassMap[tone]);
  }
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch (error) {
    return value;
  }
}

function renderQueue(items) {
  currentQueueItems = Array.isArray(items) ? items : [];
  const table = document.querySelector('[data-role="table"]');
  const tbody = document.querySelector('[data-role="queue"]');
  const loading = document.querySelector('[data-role="loading"]');
  const emptyState = document.querySelector('[data-role="empty"]');

  if (!tbody || !table || !loading || !emptyState) {
    return;
  }

  tbody.innerHTML = "";

  if (!Array.isArray(items) || items.length === 0) {
    table.hidden = true;
    emptyState.hidden = false;
    loading.hidden = true;
    updateSummaryBadges({ pendingCount: 0, verifiedCount: 0 });
    return;
  }

  const verifiedItems = items.filter((item) => item?.status === "verified");
  const pendingItems = items.filter((item) => item?.status !== "verified");

  updateSummaryBadges({
    pendingCount: pendingItems.length,
    verifiedCount: verifiedItems.length,
  });

  emptyState.hidden = true;
  loading.hidden = true;
  table.hidden = false;

  items.forEach((item) => {
    const row = document.createElement("tr");
    row.className = "text-sm text-slate-700";
    row.dataset.deedId = item?.id;
    row.dataset.status = item?.status || "pending";

    const deedCell = document.createElement("td");
    deedCell.className = "px-6 py-4 align-top";
    const title = document.createElement("div");
    title.className = "font-semibold text-slate-900";
    title.textContent = item?.title || t("verify.untitled", "Untitled deed");
    const meta = document.createElement("div");
    meta.className = "mt-1 text-xs text-slate-500";
    meta.textContent = t(
      "verify.queueMeta",
      `Deed #${item?.id ?? "—"} • Member ${item?.user_id ?? "—"}`,
      { id: item?.id ?? "—", user: item?.user_id ?? "—" },
    );
    deedCell.appendChild(title);
    deedCell.appendChild(meta);

    // Add description if present
    if (item?.description) {
      const description = document.createElement("div");
      description.className = "mt-2 text-sm text-slate-600 max-w-md";
      description.textContent = item.description;
      deedCell.appendChild(description);
    }

    const badgeTone = item?.status === "verified" ? "verified" : "pending";
    const badgeLabel =
      item?.status === "verified"
        ? t("badges.verifiedLabel", "Verified")
        : t("badges.pendingLabel", "Pending");
    const statusBadge = createStatusBadge({
      label: badgeLabel,
      tone: badgeTone,
      extraClasses: ["mt-2"],
    });
    statusBadge.dataset.status = item?.status || "pending";
    statusBadge.setAttribute("aria-label", `${badgeLabel} status`);
    deedCell.appendChild(statusBadge);

    const submittedCell = document.createElement("td");
    submittedCell.className = "px-6 py-4 align-top text-slate-600";
    submittedCell.textContent = formatDate(item?.created_at);

    const proofCell = document.createElement("td");
    proofCell.className = "px-6 py-4 align-top";
    if (item?.proof_url) {
      // Check if URL is an image
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(item.proof_url);

      if (isImage) {
        const preview = document.createElement("div");
        preview.className = "space-y-2";

        const img = document.createElement("img");
        img.src = item.proof_url;
        img.alt = "Proof preview";
        img.className =
          "w-32 h-32 object-cover rounded border border-slate-200 shadow-sm hover:shadow-md transition cursor-pointer";
        img.loading = "lazy";
        img.onclick = () => window.open(item.proof_url, "_blank");
        preview.appendChild(img);

        const link = document.createElement("a");
        link.href = item.proof_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "block text-xs text-teal-700 hover:text-teal-800";
        link.textContent = t("verify.openProof", "Open full size");
        preview.appendChild(link);

        proofCell.appendChild(preview);
      } else {
        const link = document.createElement("a");
        link.href = item.proof_url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className =
          "inline-flex items-center gap-1 text-teal-700 hover:text-teal-800 underline";
        link.textContent = t("verify.openProof", "Open proof");
        proofCell.appendChild(link);
      }
    } else {
      proofCell.textContent = t("verify.noProof", "No link provided");
      proofCell.classList.add("text-slate-500");
    }

    const actionCell = document.createElement("td");
    actionCell.className = "px-6 py-4 align-top text-right";
    const button = document.createElement("button");
    const isVerified = item?.status === "verified";
    button.type = "button";
    button.textContent = isVerified
      ? t("badges.verifiedLabel", "Verified")
      : t("verify.verifyButton", "Verify");

    if (isVerified) {
      button.className =
        "inline-flex items-center justify-center rounded-lg bg-slate-200 px-4 py-2 text-sm font-semibold text-slate-500 shadow-sm cursor-not-allowed";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
    } else {
      button.className =
        "inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-600";
      button.addEventListener("click", () => verifyDeed(item?.id, button));
    }

    actionCell.appendChild(button);

    row.appendChild(deedCell);
    row.appendChild(submittedCell);
    row.appendChild(proofCell);
    row.appendChild(actionCell);

    tbody.appendChild(row);
  });
}

async function fetchQueue() {
  if (!requireAdminSession()) {
    return;
  }

  const loading = document.querySelector('[data-role="loading"]');
  const emptyState = document.querySelector('[data-role="empty"]');
  const table = document.querySelector('[data-role="table"]');

  if (loading) loading.hidden = false;
  if (emptyState) emptyState.hidden = true;
  if (table) table.hidden = true;
  updateSummaryBadges({ isLoading: true });

  try {
    const token = activeProfile?.sessionToken;
    console.log("[Verify Queue] Active profile:", activeProfile);
    console.log("[Verify Queue] Token present:", !!token);

    if (!token) {
      console.error("[Verify Queue] No session token found");
      toastManager.error(
        t(
          "verify.missingToken",
          "Missing admin session token. Please sign in again.",
        ),
      );
      updateSummaryBadges({ isUnavailable: true });
      return;
    }

    console.log("[Verify Queue] Fetching /api/deeds?status=pending");
    const response = await adminFetch("/api/deeds?status=pending");

    console.log("[Verify Queue] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Verify Queue] Failed:", response.status, errorText);
      const message = t(
        "verify.loadError",
        `Unable to load pending deeds (status ${response.status}). Check console for details.`,
        { status: response.status },
      );
      toastManager.error(message);
      return;
    }

    const data = await response.json();
    console.log("[Verify Queue] Received data:", data);
    const items = Array.isArray(data) ? data : [];
    console.log("[Verify Queue] Items count:", items.length);

    // Filter to only show pending deeds (auto-remove verified)
    const pendingItems = items.filter((item) => item?.status === "pending");
    renderQueue(pendingItems);
    if (pendingItems.length === 0) {
      toastManager.info(
        t("verify.flashEmpty", "No pending deeds at the moment."),
      );
    } else {
      toastManager.success(
        t(
          "verify.flashLoaded",
          `${pendingItems.length} pending deed${pendingItems.length === 1 ? "" : "s"} loaded.`,
        ),
      );
    }
  } catch (error) {
    console.error("Failed to load pending deeds", error);
    toastManager.error(
      t(
        "verify.flashError",
        "We couldn't load the pending queue. Please try again shortly.",
      ),
    );
    updateSummaryBadges({ isUnavailable: true });
  } finally {
    if (loading) {
      loading.hidden = true;
    }
  }
}

function updateSummaryBadges({
  pendingCount = 0,
  verifiedCount = 0,
  isLoading = false,
  isUnavailable = false,
} = {}) {
  const summary = document.querySelector('[data-role="summary"]');
  if (!summary) {
    return;
  }

  summary.innerHTML = "";

  if (isLoading) {
    const loading = document.createElement("span");
    loading.className = "text-xs text-slate-500";
    loading.textContent = t("verify.loading", "Loading queue…");
    summary.appendChild(loading);
    return;
  }

  if (isUnavailable) {
    const message = document.createElement("span");
    message.className = "text-xs text-rose-600";
    message.textContent = t("verify.summary.unavailable", "Queue unavailable");
    summary.appendChild(message);
    return;
  }

  const pendingBadge = createStatusBadge({
    label: t("badges.pendingLabel", "Pending"),
    count: pendingCount,
    tone: pendingCount > 0 ? "pending" : "muted",
  });

  const verifiedBadge = createStatusBadge({
    label: t("badges.verifiedLabel", "Verified"),
    count: verifiedCount,
    tone: verifiedCount > 0 ? "verified" : "muted",
  });

  summary.appendChild(pendingBadge);
  summary.appendChild(verifiedBadge);
}

function createStatusBadge({
  label,
  count,
  tone = "muted",
  extraClasses = [],
} = {}) {
  const resolvedTone = tone && statusToneClasses[tone] ? tone : "muted";
  const badge = document.createElement("span");
  badge.className = `inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
    statusToneClasses[resolvedTone]
  }`;

  extraClasses.forEach((cls) => {
    if (cls) {
      badge.classList.add(cls);
    }
  });

  const indicator = document.createElement("span");
  indicator.className = `h-2 w-2 rounded-full ${
    statusDotClasses[resolvedTone] || statusDotClasses.muted
  }`;
  indicator.setAttribute("aria-hidden", "true");

  const labelSpan = document.createElement("span");
  labelSpan.textContent = label || "";

  badge.appendChild(indicator);
  badge.appendChild(labelSpan);

  if (typeof count === "number") {
    const countBadge = document.createElement("span");
    countBadge.className =
      "rounded bg-white/60 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-current";
    countBadge.textContent = String(count);
    badge.appendChild(countBadge);
  }

  return badge;
}

async function verifyDeed(deedId, button) {
  if (!deedId || !button) {
    return;
  }

  if (!requireAdminSession()) {
    return;
  }

  const token = activeProfile?.sessionToken;
  if (!token) {
    toastManager.error(
      t(
        "verify.missingToken",
        "Missing admin session token. Please sign in again.",
      ),
    );
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = t("verify.verifying", "Verifying…");

  try {
    const response = await adminFetch("/api/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ deed_id: deedId }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok || !result?.success) {
      const message =
        result?.message || "We couldn't verify this deed. Please try again.";
      throw new Error(message);
    }

    let successMessage =
      t("verify.flashSuccess", "Deed verified and credits awarded.") ||
      "Deed verified and credits awarded.";

    if (result?.profile) {
      const fallbackName =
        result.profile.id != null ? `Member #${result.profile.id}` : "Member";
      const displayName = result.profile.name?.trim() || fallbackName;
      const totalCredits = Number(result.profile.credits ?? 0);
      const creditLabel = totalCredits === 1 ? "credit" : "credits";
      successMessage = `${displayName} now has ${totalCredits} ${creditLabel}.`;
    } else if (result?.creditsAwarded === 0) {
      successMessage =
        t(
          "verify.flashNoCredit",
          "Deed marked verified without awarding additional credits.",
        ) || "Deed marked verified without awarding additional credits.";
    }

    toastManager.success(successMessage, 6000);
    await fetchQueue();
  } catch (error) {
    console.error("Verify deed failed", error);
    toastManager.error(
      error?.message ||
        t("verify.verifyError", "Verification failed. Please retry."),
    );
  } finally {
    if (button.isConnected) {
      button.disabled = false;
      button.textContent = originalText;
    }
  }
}

// Keyboard shortcuts for admin verification
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ignore if user is typing in an input field
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
      return;
    }

    // V key: Verify first pending deed
    if (e.key === "v" || e.key === "V") {
      e.preventDefault();
      const firstPendingRow = document.querySelector(
        '[data-role="queue"] tr[data-status="pending"]',
      );
      if (firstPendingRow) {
        const verifyButton = firstPendingRow.querySelector(
          "button:not([disabled])",
        );
        if (verifyButton) {
          verifyButton.click();
          toastManager.success(
            t("verify.keyboardHint", "✓ Keyboard shortcut used"),
            2000,
          );
        }
      }
    }

    // R key: Refresh queue
    if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      toastManager.info(t("verify.refreshing", "Refreshing queue…"), 2000);
      fetchQueue();
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const refreshButton = document.querySelector('[data-action="refresh"]');
  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      toastManager.info(t("verify.refreshing", "Refreshing queue…"), 2000);
      fetchQueue();
    });
  }

  setupKeyboardShortcuts();
  fetchQueue();
});

window.addEventListener("deeds:languagechange", () => {
  renderQueue(currentQueueItems);
});
