// ============================================================
// qa.js
// Handles the feedback form submission via fetch(), so the
// page never navigates away to Formspree's default redirect.
// ============================================================

(function () {

    const form = document.getElementById("feedback-form");
    const result = document.getElementById("feedback-result");

    if (!form) return;

    form.addEventListener("submit", async (e) => {

        e.preventDefault();

        const submitButton = form.querySelector("button[type=submit]");
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
        result.textContent = "";

        try {

            const response = await fetch(form.action, {
                method: "POST",
                body: new FormData(form),
                headers: { "Accept": "application/json" }
            });

            if (response.ok) {

                const thanks = document.createElement("p");
                thanks.className = "muted-italic";
                thanks.textContent = "Thanks for the feedback!";
                form.replaceWith(thanks);

            } else {

                result.textContent = "Something went wrong submitting your feedback. Please try again, or email me directly.";
                submitButton.disabled = false;
                submitButton.textContent = "Send Feedback";
            }

        } catch (err) {

            result.textContent = "Network error — please check your connection and try again.";
            submitButton.disabled = false;
            submitButton.textContent = "Send Feedback";
        }
    });

})();