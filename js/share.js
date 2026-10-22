// Sharing a game and challenging a friend. A link carries only the game and (for a challenge) the score to beat and the sender's first name.
import * as S from "./store.js";
import { toast } from "./ui.js";

const GAME_NAMES = { match: "Matching cards", memory: "Memory flip", blitz: "True or false blitz", guess: "Guess the term", speed: "60-second sprint", picture: "Picture quiz",
  timeline: "Clickable timeline", order: "Order the events", halflife: "Half-life calculator", sort: "Sort it out", calc: "Number cruncher" };
export const gameName = (g) => GAME_NAMES[g] || "game";
// games that end with a score out of a total (the others can be shared, not challenged)
export const SCORED = ["blitz", "guess", "speed", "picture", "sort", "calc"];

export function gameUrl(lecId, game, { score, total, by } = {}) {
  const q = new URLSearchParams();
  if (Number.isInteger(score) && Number.isInteger(total) && total > 0) { q.set("s", score); q.set("n", total); }
  if (by) q.set("by", by.slice(0, 24));
  return `${location.origin}${location.pathname}#/play/${encodeURIComponent(lecId)}/${encodeURIComponent(game)}${q.toString() ? "?" + q : ""}`;
}
// the score in a challenge link is only shown, never trusted for anything but the comparison on the receiver's own screen
export function parseChallenge(query) {
  const s = Number(query.get("s")), n = Number(query.get("n")), by = (query.get("by") || "").replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, 24);
  return Number.isInteger(s) && Number.isInteger(n) && n >= 1 && n <= 1000 && s >= 0 && s <= n ? { score: s, total: n, by } : { by };
}

// kind "share": the game itself; kind "challenge": the game plus the score to beat. Counts once per game per day for the badges.
export async function shareGame({ lec, game, kind = "share", score, total, className }) {
  const name = S.myName().split(/\s+/)[0] || "A friend", g = gameName(game), cls = className || lec.title;
  const url = gameUrl(lec.id, game, kind === "challenge" ? { score, total, by: name } : { by: name });
  const text = kind === "challenge"
    ? `${name} scored ${score}/${total} in ${g} (${cls}). Can you beat it?`
    : `${name} is playing ${g} for ${cls} on Ace It. Try it!`;
  let done = false;
  try {
    if (navigator.share) { await navigator.share({ title: "Ace It", text, url }); done = true; }
    else if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied. Paste it to a friend."); done = true; }
    else { window.prompt("Copy this link and send it to a friend:", url); done = true; }
  } catch (e) {
    if (e && e.name === "AbortError") return false; // they closed the share sheet
    try { await navigator.clipboard.writeText(`${text} ${url}`); toast("Link copied. Paste it to a friend."); done = true; } catch { toast("Could not share. Try again."); }
  }
  if (done) {
    const day = S.localDay(), key = `${kind}:${lec.id}:${game}:${day}`;
    if (S.mark("shareDays", key)) S.bump(kind === "challenge" ? "challengesSent" : "shares");
  }
  return done;
}
