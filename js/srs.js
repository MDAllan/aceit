// Spaced repetition (Leitner boxes). A card the student knows comes back after 1, 3, 7, 14, then 30 days;
// a card they miss goes back to box 1 and is due again today. Pure functions so they can be unit tested.
export const INTERVALS = [0, 1, 3, 7, 14, 30]; // days to wait after reaching box 1..5
export const MAX_BOX = 5;

// whole-day number in the student's own time zone
export const dayNum = (ms = Date.now(), offsetMin = new Date().getTimezoneOffset()) => Math.floor((ms - offsetMin * 60000) / 86400000);

export function nextState(prev, known, today = dayNum()) {
  const box = known ? Math.min((prev?.box || 0) + 1, MAX_BOX) : 1;
  return { box, due: known ? today + INTERVALS[box] : today };
}
// "due" = the student has seen this card before and its review date has arrived
export const isDue = (st, today = dayNum()) => !!st && st.due <= today;
export const dueCards = (cards, sr, today = dayNum()) => cards.filter((c) => isDue(sr[c.id], today));
export const mastery = (st) => (st ? st.box / MAX_BOX : 0);
