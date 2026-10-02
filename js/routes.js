// Which screen an address points to: "#home", "#briefing", "#b2c", "#call",
// "#debrief", "#past". Pure; no DOM. Anything unknown (or no hash at all) means
// home, the introduction page.
//
// "#briefing" and "#b2c" are two different addresses (so Back/Forward and the nav
// tabs work correctly) that both render the same briefing screen, for the B2B and
// B2C modes respectively — see js/app.js.

export const ROUTES = ["home", "briefing", "b2c", "call", "debrief", "past"];

export function parseRoute(hash) {
  const name = String(hash || "").replace(/^#\/?/, "").split(/[?&/]/)[0].toLowerCase();
  return ROUTES.includes(name) ? name : "home";
}

// The header tab that should look selected on each screen. The call screen and a
// debrief belong to whichever briefing tab started them ("briefing" or "b2c"),
// except a debrief opened from Past calls, which belongs to "past".
export function activeTab(route, { debriefFromPast = false, fromTab = "briefing" } = {}) {
  if (route === "call") return fromTab;
  if (route === "debrief") return debriefFromPast ? "past" : fromTab;
  return route;
}
