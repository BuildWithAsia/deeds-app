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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const profileRaw = localStorage.getItem("deeds.profile");
    if (!profileRaw) {
      alert("Please log in again before submitting a deed.");
      window.location.href = "login.html";
      return;
    }

    let profile;
    try {
      profile = JSON.parse(profileRaw);
    } catch (error) {
      console.warn("Unable to parse cached profile", error);
      localStorage.removeItem("deeds.profile");
      alert("We couldn't read your profile. Please log in again.");
      window.location.href = "login.html";
      return;
    }

    if (!profile?.id) {
      alert("We couldn't find your account. Please log in again.");
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
        "Please complete all required fields before submitting your deed.",
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

    updateFeedback("Submitting your deed…", "info");

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
        const message = data.message || "We couldn't save your deed right now.";
        updateFeedback(message, "error");
        return;
      }

      form.reset();
      updateFeedback(
        "Your deed was submitted and is waiting for verification.",
        "success",
      );

      window.dispatchEvent(new CustomEvent("deeds:submitted"));
    } catch (error) {
      console.error("Failed to submit deed", error);
      updateFeedback(
        "We couldn't reach the server. Please check your connection and try again.",
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
