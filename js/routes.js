// Which screen an address points to: "#home", "#briefing", "#call", "#debrief", "#past".
// Pure; no DOM. Anything unknown (or no hash at all) means home, the introduction page.

export const ROUTES = ["home", "briefing", "call", "debrief", "past"];

export function parseRoute(hash) {
  const name = String(hash || "").replace(/^#\/?/, "").split(/[?&/]/)[0].toLowerCase();
  return ROUTES.includes(name) ? name : "home";
}

// The header tab that should look selected on each screen. The call screen and a
// debrief belong to "briefing" (the call you're on), except a debrief opened from
// Past calls, which belongs to "past".
export function activeTab(route, { debriefFromPast = false } = {}) {
  if (route === "call") return "briefing";
  if (route === "debrief") return debriefFromPast ? "past" : "briefing";
  return route;
}
