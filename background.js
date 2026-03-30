const DEFAULT_LIMIT_SECONDS = 10 * 60;
const ALLOWED_LIMIT_SECONDS = [60, 180, 300, 480, 600];
const REPROMPT_SECONDS = 60;
const SESSION_RESET_INACTIVITY_SECONDS = 10;

const STORAGE_KEYS = {
  sessionSeconds: "sessionSeconds",
  inactivitySeconds: "inactivitySeconds",
  lastPromptSecond: "lastPromptSecond",
  limitSeconds: "limitSeconds",
  motivationalMessage: "motivationalMessage",
  dailySeconds: "dailySeconds",
  lastTrackedAt: "lastTrackedAt",
  enabledFilterIds: "enabledFilterIds"
};

const DEFAULT_MOTIVATIONAL_MESSAGE = "Good Job";
const ALLOWED_MOTIVATIONAL_MESSAGES = ["Good Job", "Good Boy", "Good Girl", ];

function toSafeNumber(value, fallback = 0) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return fallback;
}

let trackedSitesConfig = null;

async function loadTrackedSitesConfig() {
  if (trackedSitesConfig) {
    return trackedSitesConfig;
  }

  try {
    const response = await fetch(browser.runtime.getURL("config.json"));
    const config = await response.json();
    trackedSitesConfig = config.trackedSites || [];
  } catch (error) {
    console.error("Failed to load config.json:", error);
    trackedSitesConfig = [];
  }

  return trackedSitesConfig;
}

function normalizeTrackedSites(rawSites) {
  if (!Array.isArray(rawSites)) {
    return [];
  }

  return rawSites
    .filter((site) => site && typeof site.id === "string" && typeof site.hostname === "string")
    .map((site) => ({
      id: site.id,
      displayName: typeof site.displayName === "string" ? site.displayName : site.hostname,
      hostname: site.hostname.toLowerCase(),
      paths: Array.isArray(site.paths) ? site.paths.filter((p) => typeof p === "string").map((p) => p.toLowerCase()) : []
    }));
}

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }

  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

function sanitizeEnabledFilterIds(rawEnabledFilterIds, trackedSites) {
  const validIds = trackedSites.map((site) => site.id);

  if (!Array.isArray(rawEnabledFilterIds)) {
    return validIds;
  }

  const rawSet = new Set(rawEnabledFilterIds.filter((id) => typeof id === "string"));
  return validIds.filter((id) => rawSet.has(id));
}

function parseUrl(rawUrl) {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

async function isTrackedShortFormUrl(rawUrl, enabledFilterIds) {
  const parsed = parseUrl(rawUrl);
  if (!parsed) {
    return false;
  }

  const hostname = parsed.hostname.replace(/^www\./, "").toLowerCase();
  const path = parsed.pathname.toLowerCase();

  const sites = normalizeTrackedSites(await loadTrackedSitesConfig());
  const enabledSet = new Set(Array.isArray(enabledFilterIds) ? enabledFilterIds : []);

  for (const site of sites) {
    if (!enabledSet.has(site.id)) {
      continue;
    }

    if (hostname.endsWith(site.hostname)) {
      if (site.paths.length === 0) {
        return true;
      }
      for (const pathPrefix of site.paths) {
        if (pathPrefix === "" || path.startsWith(pathPrefix)) {
          return true;
        }
      }
    }
  }

  return false;
}

async function getState() {
  const trackedSites = normalizeTrackedSites(await loadTrackedSitesConfig());

  const current = await browser.storage.local.get([
    STORAGE_KEYS.sessionSeconds,
    STORAGE_KEYS.inactivitySeconds,
    STORAGE_KEYS.lastPromptSecond,
    STORAGE_KEYS.limitSeconds,
    STORAGE_KEYS.motivationalMessage,
    STORAGE_KEYS.dailySeconds,
    STORAGE_KEYS.lastTrackedAt,
    STORAGE_KEYS.enabledFilterIds
  ]);

  const limitSeconds = sanitizeLimitSeconds(current[STORAGE_KEYS.limitSeconds]);
  const motivationalMessage = sanitizeMotivationalMessage(current[STORAGE_KEYS.motivationalMessage]);
  const enabledFilterIds = sanitizeEnabledFilterIds(current[STORAGE_KEYS.enabledFilterIds], trackedSites);
  const normalized = {
    [STORAGE_KEYS.sessionSeconds]: toSafeNumber(current[STORAGE_KEYS.sessionSeconds], 0),
    [STORAGE_KEYS.inactivitySeconds]: toSafeNumber(current[STORAGE_KEYS.inactivitySeconds], 0),
    [STORAGE_KEYS.lastPromptSecond]: toSafeNumber(current[STORAGE_KEYS.lastPromptSecond], 0),
    [STORAGE_KEYS.limitSeconds]: limitSeconds,
    [STORAGE_KEYS.motivationalMessage]: motivationalMessage,
    [STORAGE_KEYS.dailySeconds]: toSafeNumber(current[STORAGE_KEYS.dailySeconds], 0),
    [STORAGE_KEYS.lastTrackedAt]: toSafeNumber(current[STORAGE_KEYS.lastTrackedAt], 0),
    [STORAGE_KEYS.enabledFilterIds]: enabledFilterIds,
    trackedSites
  };

  if (current[STORAGE_KEYS.limitSeconds] !== limitSeconds) {
    await browser.storage.local.set({ [STORAGE_KEYS.limitSeconds]: limitSeconds });
  }

  if (current[STORAGE_KEYS.motivationalMessage] !== motivationalMessage) {
    await browser.storage.local.set({ [STORAGE_KEYS.motivationalMessage]: motivationalMessage });
  }

  if (!arraysEqual(current[STORAGE_KEYS.enabledFilterIds], enabledFilterIds)) {
    await browser.storage.local.set({ [STORAGE_KEYS.enabledFilterIds]: enabledFilterIds });
  }

  return normalized;
}

function sanitizeLimitSeconds(value) {
  const parsed = toSafeNumber(value, DEFAULT_LIMIT_SECONDS);
  if (ALLOWED_LIMIT_SECONDS.includes(parsed)) {
    return parsed;
  }
  return DEFAULT_LIMIT_SECONDS;
}

function sanitizeMotivationalMessage(value) {
  if (typeof value === "string" && ALLOWED_MOTIVATIONAL_MESSAGES.includes(value)) {
    return value;
  }
  return DEFAULT_MOTIVATIONAL_MESSAGE;
}

function isSameDayByTimestamp(tsA, tsB) {
  const a = new Date(tsA);
  const b = new Date(tsB);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

async function sendMessageToTab(tabId, payload) {
  try {
    await browser.tabs.sendMessage(tabId, payload);
  } catch {
    // Ignore messaging failures for tabs without content script access.
  }
}

async function getActiveTab() {
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

function createLimitMessage(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  return `You have doomscrolled for ${minutes} minutes. Time for a break?`;
}

async function notifyAndPrompt(tab, totalSeconds) {
  const message = createLimitMessage(totalSeconds);

  await browser.notifications.create({
    type: "basic",
    title: "Doomstop",
    message
  });

  try {
    await browser.tabs.sendMessage(tab.id, {
      type: "SHOW_LIMIT_PROMPT",
      message
    });
  } catch {
    // Content script might not be ready; notification still informs the user.
  }
}

async function tick() {
  const tab = await getActiveTab();
  const state = await getState();
  const isTracked = Boolean(tab?.url && (await isTrackedShortFormUrl(tab.url, state[STORAGE_KEYS.enabledFilterIds])));
  const now = Date.now();

  let sessionSeconds = state[STORAGE_KEYS.sessionSeconds];
  let inactivitySeconds = state[STORAGE_KEYS.inactivitySeconds];
  let lastPromptSecond = state[STORAGE_KEYS.lastPromptSecond];
  let dailySeconds = state[STORAGE_KEYS.dailySeconds];
  let lastTrackedAt = state[STORAGE_KEYS.lastTrackedAt];
  const limitSeconds = state[STORAGE_KEYS.limitSeconds];

  if (isTracked) {
    if (lastTrackedAt > 0 && !isSameDayByTimestamp(lastTrackedAt, now)) {
      dailySeconds = 0;
    }

    sessionSeconds += 1;
    dailySeconds += 1;
    inactivitySeconds = 0;
    lastTrackedAt = now;
  } else {
    inactivitySeconds += 1;
  }

  if (inactivitySeconds >= SESSION_RESET_INACTIVITY_SECONDS && sessionSeconds > 0) {
    sessionSeconds = 0;
    lastPromptSecond = 0;
  }

  await browser.storage.local.set({
    [STORAGE_KEYS.sessionSeconds]: sessionSeconds,
    [STORAGE_KEYS.inactivitySeconds]: inactivitySeconds,
    [STORAGE_KEYS.lastPromptSecond]: lastPromptSecond,
    [STORAGE_KEYS.dailySeconds]: dailySeconds,
    [STORAGE_KEYS.lastTrackedAt]: lastTrackedAt
  });

  if (tab?.id !== undefined) {
    if (isTracked) {
      await sendMessageToTab(tab.id, {
        type: "UPDATE_USAGE_OVERLAY",
        sessionSeconds,
        dailySeconds
      });
    } else {
      await sendMessageToTab(tab.id, { type: "HIDE_USAGE_OVERLAY" });
    }
  }

  const shouldPrompt =
    isTracked &&
    sessionSeconds >= limitSeconds &&
    sessionSeconds - lastPromptSecond >= REPROMPT_SECONDS;

  if (shouldPrompt) {
    lastPromptSecond = sessionSeconds;
    await browser.storage.local.set({
      [STORAGE_KEYS.lastPromptSecond]: lastPromptSecond
    });
    await notifyAndPrompt(tab, sessionSeconds);
  }
}

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === "TAKE_BREAK" && sender.tab && sender.tab.id !== undefined) {
    browser.tabs.update(sender.tab.id, { url: browser.runtime.getURL("break.html") });
  }

  if (message && message.type === "GET_MOTIVATIONAL_MESSAGE") {
    getState().then((state) => {
      sendResponse({
        motivationalMessage: state[STORAGE_KEYS.motivationalMessage]
      });
    });
    return true;
  }

  if (message && message.type === "GET_STATS") {
    getState().then((state) => {
      sendResponse({
        sessionSeconds: state[STORAGE_KEYS.sessionSeconds],
        dailySeconds: state[STORAGE_KEYS.dailySeconds],
        inactivitySeconds: state[STORAGE_KEYS.inactivitySeconds],
        limitSeconds: state[STORAGE_KEYS.limitSeconds],
        motivationalMessage: state[STORAGE_KEYS.motivationalMessage],
        enabledFilterIds: state[STORAGE_KEYS.enabledFilterIds],
        trackedSites: state.trackedSites.map((site) => ({
          id: site.id,
          displayName: site.displayName
        }))
      });
    });
    return true;
  }

  if (message && message.type === "SET_ENABLED_FILTER_IDS") {
    getState().then(async (state) => {
      const enabledFilterIds = sanitizeEnabledFilterIds(message.enabledFilterIds, state.trackedSites);
      await browser.storage.local.set({ [STORAGE_KEYS.enabledFilterIds]: enabledFilterIds });
      sendResponse({ ok: true, enabledFilterIds });
    });
    return true;
  }

  if (message && message.type === "SET_LIMIT_SECONDS") {
    const limitSeconds = sanitizeLimitSeconds(message.limitSeconds);
    browser.storage.local.set({
      [STORAGE_KEYS.limitSeconds]: limitSeconds,
      [STORAGE_KEYS.lastPromptSecond]: 0
    }).then(() => {
      sendResponse({ ok: true, limitSeconds });
    });
    return true;
  }

  if (message && message.type === "SET_MOTIVATIONAL_MESSAGE") {
    const motivationalMessage = sanitizeMotivationalMessage(message.motivationalMessage);
    browser.storage.local.set({
      [STORAGE_KEYS.motivationalMessage]: motivationalMessage
    }).then(() => {
      sendResponse({ ok: true, motivationalMessage });
    });
    return true;
  }

  if (message && message.type === "RESET_STATS") {
    const reset = {
      [STORAGE_KEYS.sessionSeconds]: 0,
      [STORAGE_KEYS.inactivitySeconds]: SESSION_RESET_INACTIVITY_SECONDS,
      [STORAGE_KEYS.lastPromptSecond]: 0
    };
    browser.storage.local.set(reset).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return undefined;
});

let tickInProgress = false;

setInterval(() => {
  if (tickInProgress) {
    return;
  }

  tickInProgress = true;
  tick().catch(() => {
    // Ignore tick failures and continue on next second.
  }).finally(() => {
    tickInProgress = false;
  });
}, 1000);
