/**
 * Formats seconds as minutes and seconds.
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
}

/**
 * Converts a value to a finite number.
 * @param {*} value
 * @param {number} [fallback=0]
 * @returns {number}
 */
function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

/**
 * Formats seconds as a rounded minute label.
 * @param {number} seconds
 * @returns {string}
 */
function formatMinutes(seconds) {
  return `${Math.floor(seconds / 60)} minute${seconds === 60 ? "" : "s"}`;
}

/**
 * Saves selected service filters from the popup.
 * @returns {Promise<void>}
 */
async function updateEnabledFilterIdsFromUi() {
  const checked = Array.from(document.querySelectorAll("input[name='serviceFilter']:checked"))
    .map((el) => el.value);

  await browser.runtime.sendMessage({
    type: "SET_ENABLED_FILTER_IDS",
    enabledFilterIds: checked
  });

  await refreshStats();
}

/**
 * Renders the tracked-service checkbox list.
 * @param {Array<{id: string, displayName?: string}>} trackedSites
 * @param {string[]} enabledFilterIds
 * @returns {void}
 */
function renderFilterList(trackedSites, enabledFilterIds) {
  const filterListEl = document.getElementById("filterList");
  filterListEl.innerHTML = "";

  if (!Array.isArray(trackedSites) || trackedSites.length === 0) {
    filterListEl.textContent = "No services configured";
    return;
  }

  const enabledSet = new Set(Array.isArray(enabledFilterIds) ? enabledFilterIds : []);

  trackedSites.forEach((site) => {
    const item = document.createElement("label");
    item.className = "filter-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "serviceFilter";
    checkbox.value = site.id;
    checkbox.checked = enabledSet.has(site.id);
    checkbox.addEventListener("change", () => {
      updateEnabledFilterIdsFromUi().catch(() => {
        const statusEl = document.getElementById("statusText");
        statusEl.textContent = "Unable to save filter settings";
      });
    });

    const text = document.createElement("span");
    text.textContent = site.displayName || site.id;

    item.appendChild(checkbox);
    item.appendChild(text);
    filterListEl.appendChild(item);
  });
}

/**
 * Loads current stats and updates popup controls.
 * @returns {Promise<void>}
 */
async function refreshStats() {
  const stats = await browser.runtime.sendMessage({ type: "GET_STATS" });
  const sessionSeconds = toSafeNumber(stats && stats.sessionSeconds, 0);
  const dailySeconds = toSafeNumber(stats && stats.dailySeconds, 0);
  const limitSeconds = toSafeNumber(stats && stats.limitSeconds, 600);
  const motivationalMessage = (stats && stats.motivationalMessage) || "Good Job";
  const enabledFilterIds = (stats && stats.enabledFilterIds) || [];
  const isEnabled = (stats && typeof stats.isEnabled === "boolean") ? stats.isEnabled : true;
  const trackedSites = (stats && stats.trackedSites) || [];
  
  const timeEl = document.getElementById("timeValue");
  const statusEl = document.getElementById("statusText");
  const limitBadgeEl = document.getElementById("limitBadge");
  const limitSelectEl = document.getElementById("limitSelect");
  const messageSelectEl = document.getElementById("messageSelect");
  const enabledToggleEl = document.getElementById("enabledToggle");

  timeEl.textContent = formatDuration(sessionSeconds);
  enabledToggleEl.checked = isEnabled;
  statusEl.textContent =
    sessionSeconds >= limitSeconds
      ? "Limit exceeded"
      : `Below limit (Session reset after 10s inactivity) • Today: ${formatDuration(dailySeconds)}`;

  limitBadgeEl.textContent = `Prompt at ${formatMinutes(limitSeconds)}`;
  limitSelectEl.value = String(limitSeconds);
  messageSelectEl.value = motivationalMessage;
  renderFilterList(trackedSites, enabledFilterIds);
}

document.getElementById("resetBtn").addEventListener("click", async () => {
  await browser.runtime.sendMessage({ type: "RESET_STATS" });
  await refreshStats();
});

document.getElementById("limitSelect").addEventListener("change", async (event) => {
  const limitSeconds = Number(event.target.value);
  await browser.runtime.sendMessage({
    type: "SET_LIMIT_SECONDS",
    limitSeconds
  });
  await refreshStats();
});

document.getElementById("messageSelect").addEventListener("change", async (event) => {
  const motivationalMessage = event.target.value;
  await browser.runtime.sendMessage({
    type: "SET_MOTIVATIONAL_MESSAGE",
    motivationalMessage
  });
  await refreshStats();
});

/**
 * Wires the global enabled toggle in the popup.
 * @returns {Promise<void>}
 */
async function initializeToggle() {
  const enabledToggle = document.getElementById("enabledToggle");
  if (!enabledToggle) return;
  
  enabledToggle.addEventListener("click", async (event) => {
    event.stopPropagation();
    const isEnabled = event.target.checked;
    try {
      await browser.runtime.sendMessage({
        type: "SET_ENABLED",
        isEnabled
      });
      await refreshStats();
    } catch (err) {
      console.error("Failed to toggle enabled state:", err);
    }
  });
}

refreshStats().then(() => {
  initializeToggle();
}).catch(() => {
  const statusEl = document.getElementById("statusText");
  statusEl.textContent = "Unable to load stats";
  initializeToggle();
});
