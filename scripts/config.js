let trackedSitesConfig = null;
let normalizedTrackedSites = null;

/**
 * Normalizes and validates tracked-site entries.
 * @param {Array} rawSites
 * @returns {Array<{id: string, displayName: string, hostname: string, paths: string[]}>}
 */
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
      paths: Array.isArray(site.paths)
        ? site.paths.filter((p) => typeof p === "string").map((p) => p.toLowerCase())
        : []
    }));
}

/**
 * Loads tracked-site configuration from config.json.
 * @returns {Promise<Array>}
 */
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

/**
 * Returns normalized tracked sites from config state.
 * @returns {Promise<Array<{id: string, displayName: string, hostname: string, paths: string[]}>>}
 */
async function getTrackedSites() {
  if (normalizedTrackedSites) {
    return normalizedTrackedSites;
  }

  const rawSites = await loadTrackedSitesConfig();
  normalizedTrackedSites = normalizeTrackedSites(rawSites);
  return normalizedTrackedSites;
}

globalThis.ConfigService = {
  loadTrackedSitesConfig,
  normalizeTrackedSites,
  getTrackedSites
};
