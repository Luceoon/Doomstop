function formatDuration(seconds) {
  const total = Number.isFinite(Number(seconds)) ? Number(seconds) : 0;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}m ${secs}s`;
}

async function loadBreakPageData() {
  try {
    const stats = await browser.runtime.sendMessage({ type: "GET_STATS" });
    if (stats && stats.motivationalMessage) {
      document.getElementById("message").textContent = stats.motivationalMessage;
    }

    const dailyTimeLine = document.getElementById("dailyTimeLine");
    if (dailyTimeLine) {
      dailyTimeLine.textContent = `Time wasted doomscrolling today: ${formatDuration(stats && stats.dailySeconds)}`;
    }
  } catch (error) {
    console.error("Could not load break page data:", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", loadBreakPageData);
} else {
  loadBreakPageData();
}
