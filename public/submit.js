const translateWithFallback =
  (typeof window !== "undefined" && window.deedsTranslateWithFallback) ||
  ((key, fallback) => fallback);

const feedbackToneClasses = {
  info: "text-slate-600",
  success: "text-teal-700",
  error: "text-rose-600",
};

function updateFeedback(message, tone = "info") {
  const feedback = document.getElementById("deedFeedback");
  if (!feedback) {
    return;
  }
  feedback.textContent = message || "";
  feedback.classList.remove(...Object.values(feedbackToneClasses));
  if (feedbackToneClasses[tone]) {
    feedback.classList.add(feedbackToneClasses[tone]);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("deedForm");
  if (!form) {
    return;
  }

  const template =
    typeof getSelectedDeedTemplate === "function"
      ? getSelectedDeedTemplate()
      : null;

  if (template) {
    const titleInput = document.getElementById("deedTitle");
    const descriptionInput = document.getElementById("deedDescription");
    const categorySelect = document.getElementById("deedCategory");

    let applied = false;

    if (titleInput && !titleInput.value && template.title) {
      titleInput.value = template.title;
      applied = true;
    }

    if (descriptionInput && !descriptionInput.value && template.description) {
      descriptionInput.value = template.description;
      applied = true;
    }

    if (categorySelect && template.category) {
      const options = Array.from(categorySelect.options || []);
      const hasOption = options.some(
        (option) => option.value === template.category,
      );
      if (hasOption) {
        categorySelect.value = template.category;
        applied = true;
      }
    }

    if (applied) {
      updateFeedback(
        translateWithFallback(
          "submit.messages.templateApplied",
          "We prefilled your selected deed. Update any details before submitting.",
        ),
        "info",
      );
    }

    if (typeof clearSelectedDeedTemplate === "function") {
      clearSelectedDeedTemplate();
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const profileRaw = localStorage.getItem("deeds.profile");
    if (!profileRaw) {
      alert(
        translateWithFallback(
          "submit.messages.loginRequired",
          "Please log in again before submitting a deed.",
        ),
      );
      window.location.href = "login.html";
      return;
    }

    let profile;
    try {
      profile = JSON.parse(profileRaw);
    } catch (error) {
      console.warn("Unable to parse cached profile", error);
      localStorage.removeItem("deeds.profile");
      alert(
        translateWithFallback(
          "submit.messages.profileParseError",
          "We couldn't read your profile. Please log in again.",
        ),
      );
      window.location.href = "login.html";
      return;
    }

    if (!profile?.id) {
      alert(
        translateWithFallback(
          "submit.messages.missingAccount",
          "We couldn't find your account. Please log in again.",
        ),
      );
      window.location.href = "login.html";
      return;
    }

    const submitButton = form.querySelector('button[type="submit"]');
    const formData = new FormData(form);
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const category = String(formData.get("category") || "").trim();
    const proofUrl = String(formData.get("proof_url") || "").trim();

    if (!title || !proofUrl || !description || !category) {
      updateFeedback(
        translateWithFallback(
          "submit.messages.missingFields",
          "Please complete all required fields before submitting your deed.",
        ),
        "error",
      );
      return;
    }

    const payload = {
      user_id: profile.id,
      title,
      description,
      category,
      proof_url: proofUrl,
    };

    updateFeedback(
      translateWithFallback(
        "submit.messages.submitting",
        "Submitting your deed…",
      ),
      "info",
    );

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.loading = "true";
    }

    try {
      const res = await fetch("/api/deeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        const message =
          data.message ||
          translateWithFallback(
            "submit.messages.saveError",
            "We couldn't save your deed right now.",
          );
        updateFeedback(message, "error");
        return;
      }

      form.reset();
      updateFeedback(
        translateWithFallback(
          "submit.messages.success",
          "Your deed was submitted and is waiting for verification.",
        ),
        "success",
      );

      window.dispatchEvent(new CustomEvent("deeds:submitted"));
    } catch (error) {
      console.error("Failed to submit deed", error);
      updateFeedback(
        translateWithFallback(
          "submit.messages.networkError",
          "We couldn't reach the server. Please check your connection and try again.",
        ),
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
