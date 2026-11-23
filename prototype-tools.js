(() => {
  "use strict";

  const waitlist = document.getElementById("drop-waitlist");
  const waitlistStatus = document.getElementById("waitlist-status");
  const waitlistKey = "fu7ure-preview:waitlist";

  try {
    if (localStorage.getItem(waitlistKey) === "joined") {
      waitlistStatus.textContent = "A demo signup is already saved on this device.";
    }
  } catch {
    // The signup walkthrough still works with storage disabled.
  }

  waitlist.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      localStorage.setItem(waitlistKey, "joined");
      waitlistStatus.textContent = "You joined the demo waitlist on this device.";
    } catch {
      waitlistStatus.textContent = "Demo signup complete for this visit.";
    }
    waitlist.reset();
  });

  const support = document.getElementById("demo-support");
  const message = support.elements.namedItem("message");
  message.addEventListener("input", () => message.setCustomValidity(""));
  support.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!message.value.trim()) {
      message.setCustomValidity("Enter a sample message.");
      message.reportValidity();
      return;
    }
    const random = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase();
    document.getElementById("support-status").textContent =
      "Demo request " + "HELP-" + random.padStart(7, "0") + " created for this visit.";
    support.reset();
  });
})();
