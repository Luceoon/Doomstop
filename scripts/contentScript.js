/**
 * Builds the break prompt overlay element.
 * @param {string} message
 * @returns {HTMLDivElement}
 */
function createPromptOverlay(message) {
  const overlay = document.createElement("div");
  overlay.id = "shorts-guard-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: grid;
    place-items: center;
    z-index: 999999;
    font-family: "Segoe UI", Tahoma, sans-serif;
  `;

  const card = document.createElement("div");
  card.style.cssText = `
    background: linear-gradient(160deg, #fff9eb, #fffaf0);
    border: 2px solid #f0dfc4;
    border-radius: 16px;
    padding: 28px 24px;
    max-width: 420px;
    width: 90vw;
    text-align: center;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.25);
  `;

  const title = document.createElement("h2");
  title.textContent = "Time to take a break!";
  title.style.cssText = `
    margin: 0 0 12px;
    font-size: 24px;
    color: #d9480f;
    line-height: 1.2;
  `;

  const text = document.createElement("p");
  text.textContent = message;
  text.style.cssText = `
    margin: 0 0 20px;
    font-size: 15px;
    color: #5f5952;
    line-height: 1.5;
  `;

  const breakBtn = document.createElement("button");
  breakBtn.textContent = "Take a Break";
  breakBtn.style.cssText = `
    width: 100%;
    padding: 14px;
    margin-bottom: 10px;
    border: 0;
    border-radius: 10px;
    background: linear-gradient(180deg, #f76707, #d9480f);
    color: white;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(217, 72, 15, 0.3);
    transition: all 0.2s;
  `;
  breakBtn.onmouseover = () => {
    breakBtn.style.transform = "scale(1.02)";
    breakBtn.style.boxShadow = "0 6px 16px rgba(217, 72, 15, 0.4)";
  };
  breakBtn.onmouseout = () => {
    breakBtn.style.transform = "scale(1)";
    breakBtn.style.boxShadow = "0 4px 12px rgba(217, 72, 15, 0.3)";
  };

  const cancelBtn = document.createElement("a");
  cancelBtn.textContent = "Nah, let me watch";
  cancelBtn.href = "#";
  cancelBtn.style.cssText = `
    display: block;
    margin-top: 8px;
    font-size: 12px;
    color: #d9480f;
    text-decoration: underline;
    cursor: pointer;
    transition: all 0.2s;
  `;
  cancelBtn.onmouseover = () => {
    cancelBtn.style.color = "#a83608";
  };
  cancelBtn.onmouseout = () => {
    cancelBtn.style.color = "#d9480f";
  };

  breakBtn.addEventListener("click", async () => {
    overlay.remove();
    await browser.runtime.sendMessage({ type: "TAKE_BREAK" });
  });

  cancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    overlay.remove();
  });

  card.appendChild(title);
  card.appendChild(text);
  card.appendChild(breakBtn);
  card.appendChild(cancelBtn);
  overlay.appendChild(card);

  return overlay;
}

/**
 * Formats seconds as minutes and seconds.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  const total = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${secs}s`;
}

const OVERLAY_PROXIMITY_PX = 70;
const OVERLAY_MOVE_COOLDOWN_MS = 220;
let usageOverlayPosition = "top";
let usageOverlayLastMoveAt = 0;
let usageOverlayMouseHandlerAttached = false;

/**
 * Applies the current corner position to the timer overlay.
 * @param {HTMLDivElement} overlay
 * @returns {void}
 */
function applyUsageOverlayPosition(overlay) {
  if (usageOverlayPosition === "bottom") {
    overlay.style.top = "";
    overlay.style.bottom = "14px";
  } else {
    overlay.style.bottom = "";
    overlay.style.top = "14px";
  }
}

/**
 * Checks whether the cursor is close to the timer overlay.
 * @param {MouseEvent} event
 * @param {HTMLElement} overlay
 * @returns {boolean}
 */
function isCursorNearOverlay(event, overlay) {
  const rect = overlay.getBoundingClientRect();
  return (
    event.clientX >= rect.left - OVERLAY_PROXIMITY_PX &&
    event.clientX <= rect.right + OVERLAY_PROXIMITY_PX &&
    event.clientY >= rect.top - OVERLAY_PROXIMITY_PX &&
    event.clientY <= rect.bottom + OVERLAY_PROXIMITY_PX
  );
}

/**
 * Moves the timer overlay away when the cursor is near.
 * @param {MouseEvent} event
 * @returns {void}
 */
function maybeMoveUsageOverlay(event) {
  const overlay = document.getElementById("shorts-guard-timer-overlay");
  if (!overlay) {
    return;
  }

  const now = Date.now();
  if (now - usageOverlayLastMoveAt < OVERLAY_MOVE_COOLDOWN_MS) {
    return;
  }

  if (!isCursorNearOverlay(event, overlay)) {
    return;
  }

  usageOverlayPosition = usageOverlayPosition === "top" ? "bottom" : "top";
  applyUsageOverlayPosition(overlay);
  usageOverlayLastMoveAt = now;
}

/**
 * Returns the timer overlay, creating it if needed.
 * @returns {HTMLDivElement}
 */
function getOrCreateUsageOverlay() {
  let overlay = document.getElementById("shorts-guard-timer-overlay");
  if (overlay) {
    return overlay;
  }

  overlay = document.createElement("div");
  overlay.id = "shorts-guard-timer-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 999998;
    padding: 9px 11px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: rgba(28, 24, 20, 0.82);
    backdrop-filter: blur(3px);
    color: #fff8ea;
    font-family: "Segoe UI", Tahoma, sans-serif;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
    min-width: 168px;
    max-width: 220px;
  `;

  const sessionLine = document.createElement("div");
  sessionLine.id = "shorts-guard-session-line";
  sessionLine.style.cssText = "font-size: 13px; font-weight: 700; line-height: 1.3;";

  const dailyLine = document.createElement("div");
  dailyLine.id = "shorts-guard-daily-line";
  dailyLine.style.cssText = "margin-top: 3px; font-size: 11px; color: #ffd9a8; line-height: 1.25;";

  overlay.appendChild(sessionLine);
  overlay.appendChild(dailyLine);
  document.body.appendChild(overlay);

  if (!usageOverlayMouseHandlerAttached) {
    document.addEventListener("mousemove", maybeMoveUsageOverlay);
    usageOverlayMouseHandlerAttached = true;
  }

  return overlay;
}

/**
 * Updates text values in the timer overlay.
 * @param {number} sessionSeconds
 * @param {number} dailySeconds
 * @returns {void}
 */
function updateUsageOverlay(sessionSeconds, dailySeconds) {
  const overlay = getOrCreateUsageOverlay();
  const sessionLine = overlay.querySelector("#shorts-guard-session-line");
  const dailyLine = overlay.querySelector("#shorts-guard-daily-line");

  if (sessionLine) {
    sessionLine.textContent = `Session: ${formatDuration(sessionSeconds)}`;
  }

  if (dailyLine) {
    dailyLine.textContent = `Today total: ${formatDuration(dailySeconds)}`;
  }
}

/**
 * Removes the timer overlay and related listeners.
 * @returns {void}
 */
function hideUsageOverlay() {
  const overlay = document.getElementById("shorts-guard-timer-overlay");
  if (overlay) {
    overlay.remove();
  }

  if (usageOverlayMouseHandlerAttached) {
    document.removeEventListener("mousemove", maybeMoveUsageOverlay);
    usageOverlayMouseHandlerAttached = false;
  }

  usageOverlayPosition = "top";
}

browser.runtime.onMessage.addListener((message) => {
  if (!message) {
    return;
  }

  if (message.type === "UPDATE_USAGE_OVERLAY") {
    updateUsageOverlay(message.sessionSeconds, message.dailySeconds);
    return;
  }

  if (message.type === "HIDE_USAGE_OVERLAY") {
    hideUsageOverlay();
    return;
  }

  if (message.type !== "SHOW_LIMIT_PROMPT") {
    return;
  }

  const existing = document.getElementById("shorts-guard-overlay");
  if (existing) {
    existing.remove();
  }

  const overlay = createPromptOverlay(message.message);
  document.body.appendChild(overlay);
});
