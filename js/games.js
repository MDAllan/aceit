import * as S from "./store.js";
import { h, md, clean, ic, toast, shuffle, confetti, pick, floatXP } from "./ui.js";
import { shareGame } from "./share.js";
import { speedQuestions } from "./game-questions.js";
import { createReviewPool, uniquePairs } from "./game-pool.js";
import { prepareOptions } from "./quiz-options.js";

export const DEFAULT_GAMES = ["match", "memory", "blitz", "guess", "speed", "picture"];

const EMOJI = { match: "\u{1F9E9}", memory: "\u{1F9E0}", blitz: "\u26A1", guess: "\u{1F4A1}", speed: "\u23F1\uFE0F", picture: "\u{1F5BC}\uFE0F", timeline: "\u23F3", order: "\u{1FA9C}", halflife: "\u2622\uFE0F", sort: "\u{1F5C2}\uFE0F", calc: "\u{1F9EE}" };
const GCOL = { match: "#2F9E94", memory: "#7A6FDB", blitz: "#D9777F", guess: "#4E9FD0", speed: "#C8627A", picture: "#3AA687", timeline: "#8E7CC3", order: "#CC8A3A", halflife: "#3F9FB8", sort: "#B070C8", calc: "#4A63C9" };
const REVIEW_POOLS = new Map();
const reviewPool = (lec, game) => {
  const key = `${lec.id}:${game}`;
  if (!REVIEW_POOLS.has(key)) REVIEW_POOLS.set(key, createReviewPool());
  return REVIEW_POOLS.get(key);
};
const cardRound = (lec, game, cards, size, idOf) => reviewPool(lec, game).draw(cards, size, idOf);
const limitedRound = (available, selected, size, noun = "card") => {
  if (available.length < size) {
    const plural = available.length === 1 ? noun : `${noun}s`;
    return h(".src", `This topic has ${available.length} usable ${plural}; this round includes all ${available.length}.`);
  }
  if (selected.length < size) {
    const plural = selected.length === 1 ? noun : `${noun}s`;
    return h(".src", `This round has ${selected.length} new ${plural} left before the pool resets.`);
  }
  return "";
};
const META = {
  match: ["games", "#2F9E94", "Matching cards", "Match each term with its meaning."],
  memory: ["cards", "#7A6FDB", "Memory flip", "Flip two face-down cards to find pairs."],
  blitz: ["quiz", "#D9777F", "True or false blitz", "10 quick statements. Is it true?"],
  guess: ["bulb", "#4E9FD0", "Guess the term", "Read the meaning, pick the right word."],
  speed: ["fire", "#C8627A", "60-second sprint", "Match key terms and concepts under time pressure."],
  picture: ["zoom", "#3AA687", "Picture quiz", "Which topic does this picture belong to?"],
  timeline: ["chart", "#8E7CC3", "Clickable timeline", "Tap an eon or era to explore events."],
  order: ["list", "#CC8A3A", "Order the events", "Stack layers from oldest to youngest."],
  halflife: ["star", "#3F9FB8", "Half-life calculator", "Play with radioactive decay."],
  sort: ["sort", "#B070C8", "Sort it out", "Drop each item into the right group."],
  calc: ["calc", "#4A63C9", "Number cruncher", "Fresh calculations every time. Beat the numbers."],
};

// main.js listens here to show how a challenge went and to offer sharing after a game ends
let hook = null;
export const onGameEnd = (fn) => { hook = fn; };

export function renderGame(b, lec, all, opts = {}) {
  const imgSecs = lec.sections.filter((s) => s.images?.length && !/clicker|question/i.test(s.title));
  const ok = (g) => (g === "picture" ? imgSecs.length >= 1 : ["match", "memory"].includes(g) ? uniquePairs(lec.cards).length >= 1 : ["blitz", "guess"].includes(g) ? uniquePairs(lec.cards).length >= 2 : g === "speed" ? speedQuestions(lec.cards).length >= 5 : g === "sort" ? lec.sort?.length : g === "calc" ? lec.calc?.length : g === "order" ? lec.order?.length : true);
  const draw = () => {
    b.replaceChildren(h("p", { style: "color:var(--mute);margin:6px 0" }, "Games are optional practice and do not count toward course completion."),
      h(".grid", lec.games.filter((g) => META[g] && ok(g)).map((g, i) => {
        const [icon, col, name, desc] = META[g], played = S.progress().games[lec.id + ":" + g];
        return h("button.card.gcard", { style: `animation:rise .4s var(--ease) ${i * 40}ms backwards;--gc:${GCOL[g] || col}`, onclick: () => start(g) },
          h(".gi", EMOJI[g] || ""), h("div", { style: "flex:1" }, h("b", name), h(".src", { style: "margin:0" }, desc)),
          played ? h("span.pill.ok", "Played") : "");
      })));
  };
  const start = (g) => {
    b.style.setProperty("--c", GCOL[g] || "var(--brand)");
    b.replaceChildren(h(".row", { style: "margin:8px 0;justify-content:space-between" }, h("button.btn.alt.sm", { onclick: () => { b.style.removeProperty("--c"); draw(); } }, ic("left", 16), "All games"),
      h("button.btn.alt.sm", { onclick: () => shareGame({ lec, game: g, kind: "share", className: opts.className }) }, ic("send", 16), "Share")));
    const box = h("div"); b.append(box);
    const again = () => { box.replaceChildren(); G[g](box, lec, again); };
    G[g](box, lec, again);
  };
  if (opts.start && lec.games.includes(opts.start) && META[opts.start] && ok(opts.start)) start(opts.start); else draw();
}

const txt = (c) => c.short || c.back;
// a game ended: remember it (and the score for the badges); the hook runs a moment later, after the end card is on the screen
const done = (lec, g, score = null, total = null, box = null) => {
  S.gameDone(lec.id + ":" + g); S.gameResult(lec.id, g, score ?? 0, total ?? 0);
  if (hook && box) setTimeout(() => { try { hook({ lec, game: g, score, total, box }); } catch (e) { console.error(e); } }, 0);
};
const endCard = (title, score, total, again, extra) => h(".card.pop", { style: "text-align:center" }, h("h2", title), h(".score", `${score}/${total}`),
  extra || "", h("button.btn", { style: "margin-top:10px", onclick: again }, "Play again"));
const nextBtn = (last, fn) => h("button.btn", { style: "margin-top:10px", onclick: fn }, last ? "See score" : "Next", ic("right", 18));

const G = {
  /* ---- matching cards: tap a term, then its meaning ---- */
  match(b, lec, again) {
    const cards = uniquePairs(lec.cards), pool = cardRound(lec, "match", cards, 6);
    const tiles = shuffle(pool.flatMap((c) => [{ id: c.id, t: c.front, k: "t" }, { id: c.id, t: txt(c), k: "d" }]));
    let first = null, lock = false, found = 0, tries = 0;
    const info = h(".src", "Tries: 0 · Pairs: 0/" + pool.length), grid = h(".mg");
    const feedback = h("div", { "aria-live": "polite" });
    tiles.forEach((t) => {
      const el = h("button.mc", t.k === "t" ? h("b", md(t.t)) : md(t.t));
      el.onclick = () => {
        if (lock || el.classList.contains("done") || el === first?.el) return;
        el.classList.add("sel");
        if (!first) { first = { t, el }; return; }
        tries++; lock = true; const a = first; first = null;
        if (a.t.id === t.id && a.t.k !== t.k) {
          a.el.classList.replace("sel", "done"); el.classList.replace("sel", "done"); found++; lock = false; feedback.replaceChildren();
          if (found === pool.length) { done(lec, "match", null, null, b); confetti(); toast(`All matched in ${tries} tries!`); grid.after(h("button.btn", { style: "margin-top:12px", onclick: again }, "Play again")); }
        } else {
          const termTile = a.t.k === "t" ? a.t : t.k === "t" ? t : null;
          const meaningTile = a.t.k === "d" ? a.t : t.k === "d" ? t : null;
          const term = termTile && pool.find((card) => card.id === termTile.id);
          const meaning = meaningTile && pool.find((card) => card.id === meaningTile.id);
          [a.t.id, t.id].forEach((id) => reviewPool(lec, "match").markMissed(id));
          const firstCard = pool.find((card) => card.id === a.t.id), secondCard = pool.find((card) => card.id === t.id);
          const explanation = term && meaning
            ? `${term.front} matches ${txt(term)}. The selected meaning, "${txt(meaning)}", belongs to ${meaning.front}.`
            : term
              ? `Both selected tiles are terms. ${firstCard.front} matches ${txt(firstCard)}; ${secondCard.front} matches ${txt(secondCard)}.`
              : `Both selected tiles are meanings. ${txt(firstCard)} belongs to ${firstCard.front}; ${txt(secondCard)} belongs to ${secondCard.front}.`;
          feedback.replaceChildren(h(".fb", h("b", "Not quite. "), explanation));
          a.el.classList.add("shake"); el.classList.add("shake"); setTimeout(() => { [a.el, el].forEach((x) => x.classList.remove("sel", "shake")); lock = false; }, 600);
        }
        info.textContent = `Tries: ${tries} · Pairs: ${found}/${pool.length}`;
      };
      grid.append(el);
    });
    b.append(h("h2", "Matching cards"), h("p", "Tap a term, then tap its meaning."), limitedRound(cards, pool, 6), info, grid, feedback);
  },

  /* ---- memory: face-down pairs ---- */
  memory(b, lec, again) {
    const cards = uniquePairs(lec.cards), pool = cardRound(lec, "memory", cards, 6);
    const tiles = shuffle(pool.flatMap((c) => [{ id: c.id, t: c.front, k: "t" }, { id: c.id, t: txt(c), k: "d" }]));
    let open = [], lock = false, found = 0, moves = 0;
    const info = h(".src", "Moves: 0 · Pairs: 0/" + pool.length), grid = h(".mg.mem");
    const feedback = h("div", { "aria-live": "polite" });
    tiles.forEach((t) => {
      // face-down: announced as "Hidden card"; face-up: announced by what it shows (the "?" is drawn by CSS, the hidden face is not read)
      const bk = h(".f.bk", t.k === "t" ? h("b", md(t.t)) : md(t.t)), sr = h("span.sr", "Hidden card");
      const el = h("button.mc", h(".in", h(".f.fr"), bk), sr);
      el.setUp = (up) => { el.classList.toggle("up", up); sr.hidden = up; };
      el.onclick = () => {
        if (lock || el.classList.contains("up")) return;
        el.setUp(true); open.push({ t, el });
        if (open.length < 2) return;
        moves++; lock = true; const [a, c] = open; open = [];
        if (a.t.id === c.t.id) { a.el.classList.add("done"); c.el.classList.add("done"); found++; lock = false; feedback.replaceChildren(); if (found === pool.length) { done(lec, "memory", null, null, b); confetti(); toast(`Cleared in ${moves} moves!`); grid.after(h("button.btn", { style: "margin-top:12px", onclick: again }, "Play again")); } }
        else {
          const first = pool.find((card) => card.id === a.t.id), second = pool.find((card) => card.id === c.t.id);
          reviewPool(lec, "memory").markMissed(first.id);
          reviewPool(lec, "memory").markMissed(second.id);
          feedback.replaceChildren(h(".fb", h("b", "Not quite. "), `${first.front} matches ${txt(first)}; ${second.front} matches ${txt(second)}.`));
          setTimeout(() => { a.el.setUp(false); c.el.setUp(false); lock = false; }, 900);
        }
        info.textContent = `Moves: ${moves} · Pairs: ${found}/${pool.length}`;
      };
      grid.append(el);
    });
    b.append(h("h2", "Memory flip"), h("p", "Flip two cards. A term and its meaning make a pair."), limitedRound(cards, pool, 6), info, grid, feedback);
  },

  /* ---- true / false blitz ---- */
  blitz(b, lec, again) {
    const cards = uniquePairs(lec.cards), rounds = cardRound(lec, "blitz", cards, 10); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "blitz", score, rounds.length, b); if (score >= 8) confetti(); return b.append(endCard("Blitz finished!", score, rounds.length, again)); }
      const c = rounds[i], truth = Math.random() < 0.5;
      const other = pick(cards.filter((x) => x.id !== c.id), 1)[0];
      const shown = truth ? txt(c) : txt(other);
      const fb = h("div", { "aria-live": "polite" });
      const ans = (v) => {
        const ok = v === truth; if (ok) { score++; floatXP("\u2705 +1"); }
        else reviewPool(lec, "blitz").markMissed(c.id);
        fb.replaceChildren(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F605} Oops. "), truth ? "Yes: " : "Not quite. The real meaning: ", md(`${c.front} = ${txt(c)}`)), nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
        btns.forEach((x) => (x.disabled = true));
      };
      const btns = [h("button.btn.ok", { onclick: () => ans(true) }, "True"), h("button.btn.warn", { onclick: () => ans(false) }, "False")];
      b.append(limitedRound(cards, rounds, 10), h(".src", `Statement ${i + 1} of ${rounds.length}`), h(".bar", h("i", { style: `width:${(i / rounds.length) * 100}%` })),
        h(".card", { style: "margin-top:10px;text-align:center" }, h("p", { style: "color:var(--mute);margin:0" }, "True or false?"), h("h2", { style: "margin:.4rem 0" }, md(c.front)), h("p", { style: "font-size:1.05rem" }, "means: ", h("b", md(shown))), h(".tf", btns), fb));
    };
    draw();
  },

  /* ---- guess the term ---- */
  guess(b, lec, again) {
    const cards = uniquePairs(lec.cards), rounds = cardRound(lec, "guess", cards, 8); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "guess", score, rounds.length, b); if (score >= 6) confetti(); return b.append(endCard("Terms guessed!", score, rounds.length, again)); }
      const c = rounds[i], opts = shuffle([c, ...pick(cards.filter((x) => x.id !== c.id), 3)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcd"[k]), h("span", md(o.front))); bt.onclick = () => {
        if (got) return; got = true; const ok = o === c; if (ok) { score++; floatXP("\u2705 +1"); } else reviewPool(lec, "guess").markMissed(c.id);
        els.forEach((x, j) => { if (opts[j] === c) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(ok ? "" : h(".fb", h("b", "Not quite. "), `${c.front} means ${txt(c)}.`), nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
      }; return bt; });
      b.append(limitedRound(cards, rounds, 8), h(".src", `Round ${i + 1} of ${rounds.length}`), h(".bar", h("i", { style: `width:${(i / rounds.length) * 100}%` })),
        h(".card", { style: "margin-top:10px" }, h("p", { style: "color:var(--mute);margin:0 0 4px" }, "Which term is this?"), h(".q", md(c.back)), els, fb));
    };
    draw();
  },

  /* ---- 60-second sprint ---- */
  speed(b, lec, again) {
    const sourceQuestions = speedQuestions(uniquePairs(lec.cards));
    const qs = cardRound(lec, "speed", sourceQuestions, sourceQuestions.length);
    let i = 0, score = 0, combo = 0, best = 0, t = 60, over = false;
    const clock = h(".timer", "60"), sc = h("b", "0"), cmb = h("span.combo", "");
    const bar = h(".row", { style: "justify-content:space-between" }, h("span", "Time ", clock), h("span", "Score ", sc), cmb);
    const body = h("div");
    const tick = setInterval(() => { if (!b.isConnected) return clearInterval(tick); t--; clock.textContent = t; if (t <= 0) { clearInterval(tick); finish(); } }, 1000);
    const finish = () => { if (over) return; over = true; done(lec, "speed", score, i, b); if (score >= 6) confetti(); b.replaceChildren(endCard("\u23F1\uFE0F Time's up!", score, i, again, h("p", `Best streak: ${best}`))); };
    const draw = () => {
      if (over) return;
      const q = qs[i % qs.length], presented = prepareOptions(q); let got = false;
      const els = presented.options.map((option, k) => { const bt = h("button.opt", h("b", "abcde"[k]), h("span", md(option.text))); bt.onclick = () => {
        if (got || over) return; got = true; const ok = option.id === presented.options[presented.answerIndex]?.id; i++;
        if (ok) { score++; combo++; best = Math.max(best, combo); floatXP("\u2705 +1"); } else combo = 0;
        if (!ok) reviewPool(lec, "speed").markMissed(q.id);
        sc.textContent = score; cmb.textContent = combo >= 2 ? `${combo} streak` : "";
        els.forEach((x, j) => { if (j === presented.answerIndex) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        setTimeout(draw, ok ? 450 : 1100);
      }; return bt; });
      body.replaceChildren(h(".card", h(".q", md(q.q)), els));
    };
    b.append(h("h2", "60-second sprint"), bar, body); draw();
  },

  /* ---- picture quiz ---- */
  picture(b, lec, again) {
    const secs = lec.sections.filter((s) => s.images?.length && !/clicker|question/i.test(s.title)), rounds = cardRound(lec, "picture", secs, 8); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "picture", score, rounds.length, b); if (score >= rounds.length - 2) confetti(); return b.append(endCard("Picture quiz done!", score, rounds.length, again)); }
      const s = rounds[i], im = pick(s.images, 1)[0], opts = shuffle([s, ...pick(secs.filter((x) => x !== s), 3)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcd"[k]), h("span", clean(o.title))); bt.onclick = () => {
        if (got) return; got = true; const ok = o === s; if (ok) { score++; floatXP("\u2705 +1"); } else reviewPool(lec, "picture").markMissed(s.id);
        els.forEach((x, j) => { if (opts[j] === s) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
      }; return bt; });
      b.append(limitedRound(secs, rounds, 8, "picture topic"), h(".src", `Picture ${i + 1} of ${rounds.length}`), h(".bar", h("i", { style: `width:${(i / rounds.length) * 100}%` })),
        h(".card", { style: "margin-top:10px" }, h(".fig", { style: "cursor:default;margin-bottom:10px" }, h("img", { src: im.src, alt: "Mystery picture" })), h(".q", "Which topic is this picture from?"), els, fb));
    };
    draw();
  },

  /* ---- clickable timeline ---- */
  timeline(b, lec) {
    const T = lec.timeline; if (!T) return b.append(h("p", "No timeline data."));
    let range = null, openEv = null, played = false;
    const kindName = { life: "Life", earth: "Earth", super: "Supercontinent", extinct: "Extinction", climate: "Climate" };
    const kindIcon = { life: "star", earth: "fire", super: "list", extinct: "alert", climate: "chart" };
    const bar = (items, total) => h(".tl", items.map((e) => { const w = ((e.from - e.to) / total) * 100;
      return h("button" + (range === e ? ".on" : ""), { style: `width:${w}%;background:${e.color}`, title: e.name, "aria-label": e.name, onclick: () => { range = range === e ? null : e; openEv = null; draw(); } }, w > 7 ? e.name : ""); }));
    const draw = () => {
      b.replaceChildren();
      const inRange = T.events.filter((e) => !range || (e.ma <= range.from && e.ma >= range.to));
      b.append(h("h2", "Earth's timeline"), h("p", { style: "color:var(--mute)" }, "Top bar: all 4,570 million years to scale. Bottom bar: zoom on the last 542 million. Tap a block to filter events."),
        h(".src", "Whole history (4570 to 0 Ma)"), bar(T.eons, T.total), h(".src", "Zoom: Phanerozoic eras (542 to 0 Ma)"), bar(T.eras, 542),
        h(".row", range ? [h("span.pill", { style: `background:${range.color}` }, `${range.name}: ${range.from} to ${range.to} Ma`), h("button.btn.alt.sm", { onclick: () => { range = null; draw(); } }, "Show all")] : h(".src", "Showing all events")),
        range?.note ? h(".card", { style: "margin:8px 0" }, h("b", "About the " + range.name), h("p", { style: "margin:.2rem 0 0" }, md(range.note))) : "",
        h("div", inRange.map((e, k) => { const on = openEv === e;
          return h("button.ev", { style: `animation-delay:${Math.min(k, 10) * 25}ms`, onclick: () => { openEv = on ? null : e; if (!on && !played) { played = true; done(lec, "timeline"); } draw(); } },
            h("span.k", ic(kindIcon[e.kind] || "star", 20)), h("span.ma", e.show || fmt(e.ma)),
            h("div", { style: "flex:1" }, h("b", e.title), " ", h("span.pill", kindName[e.kind] || ""),
              on ? [h("div", { style: "margin-top:6px" }, md(e.text)), e.why ? h(".acc.why.open", { style: "margin-top:6px;padding:8px 12px" }, h("b", "Why: "), md(e.why)) : "", S.canSeeRefs() ? h(".src.admin", e.src) : ""] : "")); })));
    };
    draw();
  },

  /* ---- order the events ---- */
  order(b, lec) {
    const sc = lec.order; if (!sc?.length) return b.append(h("p", "Coming soon."));
    let n = 0;
    const draw = () => {
      b.replaceChildren();
      const s = sc[n % sc.length];
      let items = shuffle(s.layers.map((x, i) => ({ ...x, i })));
      if (items.every((x, i) => x.i === i)) items.reverse();
      const out = h("div"), fb = h("div", { "aria-live": "polite" });
      const render = () => out.replaceChildren(h(".src", `Top: ${s.topLabel || "youngest"}. Bottom: ${s.bottomLabel || "oldest"}.`), h(".strat", items.map((it, k) => h(".layer", { style: `background:${it.color}` }, h("span", md(it.name)),
        h(".mv", h("button", { "aria-label": "Move up", disabled: k === 0, onclick: () => { [items[k - 1], items[k]] = [items[k], items[k - 1]]; render(); } }, ic("up", 18)),
          h("button", { "aria-label": "Move down", disabled: k === items.length - 1, onclick: () => { [items[k + 1], items[k]] = [items[k], items[k + 1]]; render(); } }, ic("down", 18)))))));
      render();
      b.append(h("h2", s.title), h("p", md(s.prompt)), out,
        h(".row", { style: "margin-top:12px" }, h("button.btn", { onclick: () => {
          const ok = items.every((x, k) => x.i === s.layers.length - 1 - k);
          fb.replaceChildren(h(".fb", h("b", ok ? "Correct! " : "Not yet. "), md(s.why), ok ? "" : h(".src", "Correct, top to bottom: " + s.layers.slice().reverse().map((x) => clean(x.name)).join(" > "))));
          if (ok) { done(lec, "order"); confetti(60); toast("Nice!"); }
        } }, "Check order"), h("button.btn.alt", { onclick: () => { n++; draw(); } }, "Next puzzle")), fb);
    };
    draw();
  },

  /* ---- half-life calculator ---- */
  halflife(b, lec) {
    const iso = lec.halflife || [{ name: "Carbon-14", half: 5730, unit: "years" }];
    const sel = h("select", { "aria-label": "Isotope" }, iso.map((x, i) => h("option", { value: i }, `${x.name} (half-life ${span(x.half, x.unit)})`)));
    const n = h("input", { type: "range", min: 0, max: 8, step: 0.5, value: 2, "aria-label": "Half-lives passed" });
    const out = h("div"), vis = h("div");
    let counted = false;
    const upd = () => {
      const x = iso[sel.value], k = +n.value, frac = Math.pow(0.5, k), age = k * x.half;
      vis.replaceChildren(h(".bar", { style: "height:26px" }, h("i", { style: `width:${frac * 100}%;background:var(--accent)` })));
      out.replaceChildren(h("p", h("b", k + " half-lives"), " have passed = ", h("b", span(age, x.unit))), h("p", `Parent left: ${(frac * 100).toFixed(2)}% · Daughter made: ${(100 - frac * 100).toFixed(2)}%`),
        h(".acc.why.open", { style: "padding:10px 14px" }, h("b", "Why it works: "), "Every half-life, half of the remaining parent atoms decay. It never reaches zero; it just halves again and again. Measure the parent and daughter amounts and you can run the clock backwards."));
      if (!counted) { counted = true; done(lec, "halflife"); }
    };
    sel.onchange = n.oninput = upd;
    const rev = h("input", { type: "number", min: 0.01, max: 100, step: 0.01, placeholder: "e.g. 25", style: "max-width:160px", "aria-label": "Percent of parent left" });
    const revOut = h("p");
    rev.oninput = () => { const p = +rev.value; if (!(p > 0 && p <= 100)) { revOut.textContent = ""; return; } const x = iso[sel.value], k = Math.log2(100 / p);
      revOut.replaceChildren("If ", h("b", p + "%"), " of the parent is left, the sample is about ", h("b", span(k * x.half, x.unit)), ` old (${k.toFixed(2)} half-lives).`); };
    b.append(h("h2", "Half-life calculator"), h("label", "Isotope"), sel, h("label", "Half-lives passed"), n, h("div", { style: "margin:10px 0" }, vis), out,
      h("h3", { style: "margin-top:16px" }, "Run it backwards: find the age"), h("label", "% of parent isotope still left"), rev, revOut);
    upd();
  },

  /* ---- sort it out ---- */
  sort(b, lec, again) {
    const acts = shuffle(lec.sort.slice()); let ai = 0;
    const run = (act) => {
      const sourceItems = act.items.map((item, index) => ({ ...item, id: item.id || `${lec.id}:${act.title}:${index}` }));
      const items = cardRound(lec, `sort:${act.title}`, sourceItems, 8); let i = 0, score = 0;
      const draw = () => {
        b.replaceChildren();
        if (i >= items.length) { done(lec, "sort", score, items.length, b); if (score >= items.length - 1) confetti(); const more = ai + 1 < acts.length;
          return b.append(h(".card.pop", { style: "text-align:center" }, h("h2", act.title), h(".score", `${score}/${items.length}`), h("button.btn", { style: "margin-top:10px", onclick: () => { ai = (ai + 1) % acts.length; run(acts[ai]); } }, more ? "Next activity" : "Play again"))); }
        const it = items[i]; let got = false; const fb = h("div", { "aria-live": "polite" });
        const bt = act.buckets.map((name, k) => h("button.btn.alt", { onclick: () => {
          if (got) return; got = true; const ok = k === it.b; if (ok) { score++; floatXP("\u2705 +1"); }
          bt.forEach((x, j) => { x.disabled = true; if (j === it.b) x.classList.add("ok"); });
          if (!ok) reviewPool(lec, `sort:${act.title}`).markMissed(it.id);
          fb.append(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F914} Not quite. "), `It belongs with "${act.buckets[it.b]}".`, act.why && !ok ? h("span", " ", md(act.why)) : ""), nextBtn(i + 1 === items.length, () => { i++; draw(); }));
        } }, md(name)));
        b.append(h("h2", act.title), act.prompt ? h("p", { style: "color:var(--mute)" }, md(act.prompt)) : "", limitedRound(sourceItems, items, 8, "item"), h(".src", `Item ${i + 1} of ${items.length}`), h(".bar", h("i", { style: `width:${(i / items.length) * 100}%` })),
          h(".card", { style: "margin-top:10px" }, h(".sortitem", md(it.text)), h(".bkts.c" + Math.min(act.buckets.length, 3), bt), fb));
      };
      draw();
    };
    run(acts[0]);
  },

  /* ---- number cruncher: random numbers, exact answers ---- */
  calc(b, lec, again) {
    const ids = lec.calc, rounds = 8; let i = 0, score = 0, combo = 0;
    const gids = ids.filter((id) => CALC[id]);
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds) { done(lec, "calc", score, rounds, b); if (score >= 6) confetti(); return b.append(endCard("Calculations done!", score, rounds, again)); }
      const gid = gids[i % gids.length]; let g; do { g = CALC[gid](); } while (g.wrong.length < 3);
      const opts = shuffle([g.ans, ...g.wrong.slice(0, 4)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcde"[k]), h("span", o)); bt.onclick = () => {
        if (got) return; got = true; const ok = o === g.ans; if (ok) { score++; combo++; floatXP("\u2705 +1"); } else combo = 0;
        els.forEach((x, j) => { if (opts[j] === g.ans) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F914} Not quite. "), combo >= 3 ? h("span.combo", `\u{1F525} ${combo} in a row! `) : "", md(g.why)), nextBtn(i + 1 === rounds, () => { i++; draw(); }));
      }; return bt; });
      const hint = h(".fb", { style: "display:none;margin:6px 0" }, "\u{1F4A1} ", HINTS[gid] || "Think about which formula connects the quantities.");
      const hb = h("button.chip", { onclick: () => { hint.style.display = ""; hb.disabled = true; } }, "\u{1F4A1} Hint");
      b.append(h(".src", `Problem ${i + 1} of ${rounds}`), h(".bar", h("i", { style: `width:${(i / rounds) * 100}%` })), h(".card", { style: "margin-top:10px" }, h(".q", g.q), h("div", { style: "margin-bottom:6px" }, hb), hint, els, fb));
    };
    draw();
  },
};

const span = (v, unit) => (unit === "million years" && v >= 1000 ? (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " billion years" : (+v.toFixed(2)).toLocaleString() + " " + unit);
const fmt = (ma) => (ma >= 1000 ? (ma / 1000).toFixed(2).replace(/\.?0+$/, "") + " Ga" : ma >= 1 ? "~" + ma + " Ma" : Math.round(ma * 1000) + " ka");

/* ---------- generators for the number cruncher ---------- */
const rnd = (a) => a[Math.floor(Math.random() * a.length)];
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
const num = (x) => { const a = Math.abs(x); if (a !== 0 && (a >= 1e5 || a < 0.01)) { const e = Math.floor(Math.log10(a)); const m = +(x / 10 ** e).toPrecision(3); return `${m} x 10^${e}`; } return (+x.toPrecision(4)).toLocaleString("en-US", { maximumFractionDigits: 6 }); };
const frac = (n, d) => { const g = gcd(n, d); n /= g; d /= g; return d === 1 ? `${n} times the original` : n === 1 ? `1/${d} of the original` : `${n}/${d} of the original`; };
const uniq = (ans, list) => { const out = []; for (const x of list) if (x !== ans && !out.includes(x)) out.push(x); return out; };
const CALC = {
  "inv-square"() {
    const f = rnd([2, 3, 4, 5, 10]), shrink = Math.random() < 0.5;
    const ans = shrink ? frac(1, f * f) : frac(f * f, 1);
    return { q: shrink ? `The distance between two objects is multiplied by ${f}. The gravitational force between them becomes:` : `The distance between two objects is divided by ${f}. The gravitational force between them becomes:`, ans,
      wrong: uniq(ans, shrink ? [frac(1, f), frac(f, 1), frac(f * f, 1), frac(1, f * f * f), frac(2, f)] : [frac(f, 1), frac(1, f), frac(1, f * f), frac(f * f * f, 1), frac(f, 2)]),
      why: `Gravity follows the inverse-square law: force is proportional to 1/d^2. ${shrink ? `Multiplying d by ${f} divides the force by ${f}^2 = ${f * f}.` : `Dividing d by ${f} multiplies the force by ${f}^2 = ${f * f}.`}` };
  },
  "gravity-masses"() {
    let a, c, d;
    do { a = rnd([2, 3, 4, 5]); c = rnd([2, 3]); d = rnd([2, 3, 4]); } while (a * c === d * d);
    const ans = frac(a * c, d * d);
    return { q: `One mass is multiplied by ${a}, the other mass by ${c}, and the distance between them by ${d}. The gravitational force becomes:`, ans,
      wrong: uniq(ans, [frac(a * c, d), frac(a * c * d * d, 1), frac(a + c, d * d), frac(a * c * d, 1), frac(a * c, 2 * d), frac(d * d, a * c), frac(a * c + d, d * d)]),
      why: `F = G m1 m2 / d^2. Masses multiply the force by ${a} x ${c} = ${a * c}. The distance divides it by ${d}^2 = ${d * d}. Net factor: ${a * c}/${d * d}.` };
  },
  "c-lambda"() {
    const opts = [["500 nm", 5e-7], ["650 nm", 6.5e-7], ["21 cm", 0.21], ["3 cm", 0.03], ["1 m", 1], ["10 m", 10], ["100 nm", 1e-7], ["2 mm", 0.002]];
    const [lab, lam] = rnd(opts), f = 3e8 / lam, ans = `${num(f)} Hz`;
    return { q: `A wave has a wavelength of ${lab}. Using c = 3 x 10^8 m/s, its frequency is closest to:`, ans,
      wrong: uniq(ans, [`${num(f * 1000)} Hz`, `${num(f / 1000)} Hz`, `${num(3e8 * lam)} Hz`, `${num(lam / 3e8)} Hz`, `${num(f * 100)} Hz`]),
      why: `c = wavelength x frequency, so frequency = c / wavelength = (3 x 10^8 m/s) / ${num(lam)} m = ${num(f)} Hz. Convert the wavelength to metres first.` };
  },
  photon() {
    const k = rnd([2, 3, 4, 5, 10]), shorter = Math.random() < 0.5, ans = shorter ? `${k} times as much` : `1/${k} as much`;
    return { q: `The wavelength of a photon is ${shorter ? "divided" : "multiplied"} by ${k}. Its energy becomes:`, ans,
      wrong: uniq(ans, shorter ? [`1/${k} as much`, `${k * k} times as much`, `1/${k * k} as much`, "unchanged", `${k + 1} times as much`] : [`${k} times as much`, `1/${k * k} as much`, `${k * k} times as much`, "unchanged", `1/${k + 1} as much`]),
      why: `Photon energy is proportional to frequency, and frequency is proportional to 1/wavelength. So energy is proportional to 1/wavelength: ${shorter ? `dividing the wavelength by ${k} multiplies the energy by ${k}` : `multiplying the wavelength by ${k} divides the energy by ${k}`}.` };
  },
  kinetic() {
    const m = rnd([2, 3, 5, 10, 0.5, 1200, 1500]), v = rnd([2, 4, 10, 20, 30, 25]), ke = 0.5 * m * v * v, ans = `${num(ke)} J`;
    return { q: `An object of mass ${num(m)} kg moves at ${v} m/s. Its kinetic energy is:`, ans,
      wrong: uniq(ans, [`${num(m * v * v)} J`, `${num(0.5 * m * v)} J`, `${num(m * v)} J`, `${num(0.5 * m * v * v * 2 * 2)} J`, `${num(0.5 * m * 2 * v)} J`]),
      why: `Kinetic energy = 1/2 x m x v^2 = 0.5 x ${num(m)} x ${v}^2 = ${num(ke)} J. The speed is squared before multiplying.` };
  },
  "ke-double"() {
    const k = rnd([2, 3, 4, 5]), ans = `${k * k} times as much`;
    return { q: `A car's speed is multiplied by ${k}. Its kinetic energy becomes:`, ans, wrong: uniq(ans, [`${k} times as much`, `${2 * k} times as much`, `${k * k * k} times as much`, `${k / 2} times as much`, "unchanged"]),
      why: `Kinetic energy is proportional to v^2. Multiplying v by ${k} multiplies the energy by ${k}^2 = ${k * k}.` };
  },
  momentum() {
    const m = rnd([2, 5, 10, 60, 1000, 1500]), v = rnd([2, 3, 5, 10, 20, 30]), p = m * v, ans = `${num(p)} kg m/s`;
    return { q: `An object of mass ${num(m)} kg moves at ${v} m/s. Its momentum is:`, ans, wrong: uniq(ans, [`${num(m * v * v)} kg m/s`, `${num(m / v)} kg m/s`, `${num(0.5 * m * v * v)} kg m/s`, `${num(m + v)} kg m/s`, `${num(p * 2)} kg m/s`, `${num(p / 2)} kg m/s`, `${num(p * 10)} kg m/s`, `${num(p + m)} kg m/s`]),
      why: `Momentum = mass x velocity = ${num(m)} kg x ${v} m/s = ${num(p)} kg m/s. Unlike kinetic energy, velocity is not squared.` };
  },
  force() {
    const m = rnd([2, 5, 10, 50, 1000]), a = rnd([2, 3, 4, 5, 10]), F = m * a, ans = `${num(F)} N`;
    return { q: `A net force acts on a ${num(m)} kg object and gives it an acceleration of ${a} m/s^2. The net force is:`, ans, wrong: uniq(ans, [`${num(m / a)} N`, `${num(a / m)} N`, `${num(m + a)} N`, `${num(F * a)} N`, `${num(F / 2)} N`]),
      why: `Newton's second law: F = m x a = ${num(m)} kg x ${a} m/s^2 = ${num(F)} N.` };
  },
  doppler() {
    const dl = rnd([1, 2, 5, 10, 15]), away = Math.random() < 0.5, v = dl * 600, obs = 500 + (away ? dl : -dl);
    const ans = `${num(v)} km/s, ${away ? "moving away from us" : "moving toward us"}`;
    return { q: `A spectral line has a rest wavelength of 500 nm. In a distant object it is observed at ${obs} nm. Using c = 3 x 10^5 km/s, the object is moving at about:`, ans,
      wrong: uniq(ans, [`${num(v)} km/s, ${away ? "moving toward us" : "moving away from us"}`, `${num(v / 2)} km/s, ${away ? "moving away from us" : "moving toward us"}`, `${num(v * 10)} km/s, ${away ? "moving away from us" : "moving toward us"}`, `${num(dl)} km/s, ${away ? "moving away from us" : "moving toward us"}`]),
      why: `Speed = c x (change in wavelength / rest wavelength) = 300,000 x (${dl}/500) = ${num(v)} km/s. A longer observed wavelength (redshift) means moving away; a shorter one (blueshift) means moving toward us.` };
  },
  "tel-area"() {
    const k = rnd([2, 3, 4, 5]), base = rnd([1, 2, 3, 4, 5]), bigger = Math.random() < 0.7, dA = bigger ? base : base * k, dB = bigger ? base * k : base;
    const ans = bigger ? `${k * k} times as much light` : `1/${k * k} as much light`;
    return { q: `Telescope A has a mirror ${dA} m across and telescope B has a mirror ${dB} m across. Compared with telescope A, telescope B collects:`, ans,
      wrong: uniq(ans, bigger ? [`${k} times as much light`, `${2 * k} times as much light`, `${k ** 3} times as much light`, `1/${k * k} as much light`, `1/${k} as much light`] : [`1/${k} as much light`, `1/${2 * k} as much light`, `1/${k ** 3} as much light`, `${k * k} times as much light`, `${k} times as much light`]),
      why: `Light-collecting area is proportional to the diameter squared. B's mirror is ${bigger ? "" : "1/"}${k} times the diameter of A's, so it collects ${bigger ? `${k}^2 = ${k * k} times` : `(1/${k})^2 = 1/${k * k}`} as much light.` };
  },
  "tel-res"() {
    const v = rnd([0, 1, 2]);
    if (v === 0) {
      const k = rnd([2, 3, 4, 5, 10]), ans = frac(1, k);
      return { q: `A telescope's mirror is made ${k} times wider and it observes the same wavelength of light. The smallest angle it can separate becomes:`, ans,
        wrong: uniq(ans, [frac(1, k * k), frac(k, 1), frac(k * k, 1), frac(1, k + 1), frac(2, k)]),
        why: `The smallest angle is proportional to wavelength / diameter. A mirror ${k} times wider divides that angle by ${k}, so the telescope can see finer detail (a smaller angle is sharper). It is not squared: that rule is for light-collecting area.` };
    }
    if (v === 1) {
      const k = rnd([2, 3, 4, 5, 10]), ans = frac(k, 1);
      return { q: `The same telescope observes light with a wavelength ${k} times longer. The smallest angle it can separate becomes:`, ans,
        wrong: uniq(ans, [frac(1, k), frac(k * k, 1), frac(1, k * k), frac(k + 1, 1), frac(k, 2)]),
        why: `The smallest angle is proportional to wavelength / diameter. With the diameter unchanged, a wavelength ${k} times longer makes the angle ${k} times larger, so the image is blurrier.` };
    }
    let a, c;
    do { a = rnd([2, 3, 4, 5]); c = rnd([2, 3, 4, 5]); } while (a === c || (c * a) % 2 === 1 && a * c > 20);
    const ans = frac(c, a);
    return { q: `A telescope's mirror is made ${a} times wider and it now observes light with a wavelength ${c} times longer. The smallest angle it can separate becomes:`, ans,
      wrong: uniq(ans, [frac(a, c), frac(a * c, 1), frac(1, a * c), frac(c * c, a), frac(c, a * a)]),
      why: `The smallest angle is proportional to wavelength / diameter. The longer wavelength multiplies it by ${c}; the wider mirror divides it by ${a}. Net factor: ${c}/${a}.` };
  },
  "atm-pressure"() {
    const F = rnd([200, 500, 600, 1000, 1200, 3000, 5000]), A = rnd([0.5, 2, 4, 5, 10]), P = F / A, ans = `${num(P)} Pa`;
    return { q: `A force of ${num(F)} N pushes evenly on an area of ${num(A)} m^2. The pressure is:`, ans,
      wrong: uniq(ans, [`${num(F * A)} Pa`, `${num(A / F)} Pa`, `${num(F + A)} Pa`, `${num(P * 2)} Pa`, `${num(P / 10)} Pa`, `${num(P * 10)} Pa`]),
      why: `Pressure = force / area = ${num(F)} N / ${num(A)} m^2 = ${num(P)} Pa. One pascal is one newton per square metre.` };
  },
  "atm-units"() {
    const v = rnd([0, 1, 2, 3]);
    if (v === 0) {
      const k = rnd([2, 5, 12, 50, 89, 101]), ans = `${num(k * 1000)} Pa`;
      return { q: `A pressure of ${k} kPa is the same as:`, ans, wrong: uniq(ans, [`${num(k * 100)} Pa`, `${num(k * 10)} Pa`, `${num(k * 100000)} Pa`, `${num(k / 1000)} Pa`]),
        why: `1 kPa = 1000 Pa, so ${k} kPa = ${k} x 1000 = ${num(k * 1000)} Pa.` };
    }
    if (v === 1) {
      const b = rnd([2, 3, 5, 10]), ans = `${num(b * 100000)} Pa`;
      return { q: `A pressure of ${b} bar is the same as:`, ans, wrong: uniq(ans, [`${num(b * 1000)} Pa`, `${num(b * 101325)} Pa`, `${num(b * 10000)} Pa`, `${num(b * 1000000)} Pa`]),
        why: `1 bar = 100,000 Pa, so ${b} bar = ${num(b * 100000)} Pa. (1 atmosphere is a little more: 101,325 Pa.)` };
    }
    if (v === 2) {
      const a = rnd([2, 3, 4, 10]), ans = `${num(a * 101325)} Pa`;
      return { q: `A pressure of ${a} atmospheres is closest to:`, ans, wrong: uniq(ans, [`${num(a * 100000 * 10)} Pa`, `${num(a * 1000)} Pa`, `${num(a * 14.7)} Pa`, `${num(a * 6894.76)} Pa`]),
        why: `1 atm = 101,325 Pa (about 1.01 x 10^5 Pa), so ${a} atm = ${num(a * 101325)} Pa.` };
    }
    const kpa = rnd([89, 101, 50, 26]), atm = kpa / 101.325, ans = `${(+atm.toFixed(2))} atm`;
    return { q: `The air pressure at a place is ${kpa} kPa. In atmospheres that is about:`, ans,
      wrong: uniq(ans, [`${(+(kpa / 100 * 10).toFixed(1))} atm`, `${(+(atm * 101.325).toFixed(0))} atm`, `${(+(kpa / 14.7).toFixed(2))} atm`, `${(+(atm / 10).toFixed(3))} atm`]),
      why: `1 atm = 101.325 kPa, so ${kpa} kPa / 101.325 = ${(+atm.toFixed(2))} atm. Calgary, about 1 km up, sits near 89 kPa, roughly 0.88 atm.` };
  },
  "ah-thermal"() {
    const v = rnd([0, 1, 2, 3]);
    if (v === 0) {
      const r = rnd([2, 3, 4, 5]), up = Math.random() < 0.6, ans = up ? frac(r, 1) : frac(1, r);
      return { q: `The temperature of a gas (in kelvin) is ${up ? "multiplied" : "divided"} by ${r * r}. Its peak thermal velocity becomes:`, ans,
        wrong: uniq(ans, up ? [frac(r * r, 1), frac(1, r), frac(r ** 4, 1), frac(1, r * r), frac(2 * r, 1)] : [frac(1, r * r), frac(r, 1), frac(r * r, 1), frac(1, 2 * r), frac(1, r ** 4)]),
        why: `v_thermal = √(2kT/m), so speed goes with the square root of T. ${up ? "Multiplying" : "Dividing"} T by ${r * r} ${up ? "multiplies" : "divides"} the speed by √${r * r} = ${r}.` };
    }
    if (v === 1) {
      const r = rnd([2, 3, 4]), ans = frac(1, r);
      return { q: `At the same temperature, one gas has particles ${r * r} times as massive as another. Its peak thermal velocity is:`, ans,
        wrong: uniq(ans, [frac(1, r * r), frac(r, 1), frac(r * r, 1), frac(1, 2 * r), frac(1, 1)]),
        why: `v_thermal = √(2kT/m) falls as 1/√m. Particles ${r * r} times as massive move 1/√${r * r} = 1/${r} as fast, which is why heavy gases escape less easily than hydrogen and helium.` };
    }
    if (v === 2) {
      let a, b; do { a = rnd([2, 3, 4]); b = rnd([2, 3, 4]); } while (a === b);
      const ans = frac(a, b);
      return { q: `A gas is heated so its kelvin temperature is ${a * a} times higher, and it is swapped for a gas whose particles are ${b * b} times as massive. The peak thermal velocity becomes:`, ans,
        wrong: uniq(ans, [frac(a * a, b * b), frac(b, a), frac(a * b, 1), frac(a * a, b), frac(a, b * b), frac(1, a * b)]),
        why: `v_thermal = √(2kT/m). Temperature x${a * a} gives speed x${a}; mass x${b * b} gives speed /${b}. Net factor: ${a}/${b}.` };
    }
    const T = rnd([100, 400, 900, 1600, 2500]), k = 1.38e-23, m = 1.67e-27, vms = Math.sqrt((2 * k * T) / m), ans = `${(vms / 1000).toFixed(1)} km/s`;
    return { q: `Using v_thermal = √(2kT/m) with k = 1.38 x 10^-23 J/K and a hydrogen-atom mass of 1.67 x 10^-27 kg, what is the peak thermal velocity of hydrogen atoms at ${T} K?`, ans,
      wrong: uniq(ans, [`${(vms / 1000 / Math.SQRT2).toFixed(1)} km/s`, `${(vms / 1000 * 2).toFixed(1)} km/s`, `${(vms / 1000 / 2).toFixed(1)} km/s`, `${num((2 * k * T) / m / 1000)} km/s`, `${(vms / 1000 * Math.SQRT2).toFixed(1)} km/s`]),
      why: `v = √(2 x 1.38 x 10^-23 x ${T} / 1.67 x 10^-27) = √(${num((2 * k * T) / m)}) m/s ≈ ${num(Math.round(vms))} m/s ≈ ${(vms / 1000).toFixed(1)} km/s.${T === 400 ? " That is just above the Moon's 2.4 km/s escape velocity, so the Moon cannot keep hydrogen." : ""}` };
  },
  "ah-escape"() {
    const vesc = rnd([2.4, 4, 5, 10, 20, 25]);
    if (Math.random() < 0.65) {
      const pct = rnd([5, 8, 10, 12, 30, 40, 50, 60, 80, 120]), vth = +(vesc * pct / 100).toFixed(2), lost = pct > 20;
      const say = (p, l) => `${p}% of escape velocity: ${l ? "lost within a few billion years" : "escapes only slowly; kept far longer"}`;
      const ans = say(pct, lost), inv = Math.round(vesc / vth * 100);
      return { q: `A gas in a world's exosphere has a peak thermal velocity of ${vth} km/s. The world's escape velocity is ${vesc} km/s. By the rule of thumb, what happens to the gas?`, ans,
        wrong: uniq(ans, [say(pct, !lost), say(inv, inv > 20), say(inv, !(inv > 20)), say(+(pct / 10).toFixed(1), false), say(Math.min(99, pct * 2), true)]),
        why: `Peak thermal velocity / escape velocity = ${vth} / ${vesc} = ${pct}%. Above about 20%, a gas is completely lost within a few billion years; well below it, only the rare fast tail escapes, slowly.` };
    }
    const ans = `${num(vesc * 0.2)} km/s`;
    return { q: `A world has an escape velocity of ${vesc} km/s. Using the 20% rule of thumb, roughly what peak thermal velocity would let a gas be lost within a few billion years?`, ans: `More than about ${ans}`,
      wrong: uniq(`More than about ${ans}`, [`More than about ${num(vesc)} km/s`, `More than about ${num(vesc * 0.02)} km/s`, `More than about ${num(vesc * 5)} km/s`, `More than about ${num(vesc * 0.5)} km/s`]),
      why: `20% of ${vesc} km/s is ${ans}. A gas whose peak thermal velocity is above that is lost within a few billion years, even though most particles are slower than escape velocity.` };
  },
  "sb-resonance"() {
    if (Math.random() < 0.5) {
      const [n, d] = rnd([[1, 2], [1, 3], [1, 4], [2, 5]]), p = 12 * n / d, ans = `${num(p)} years`;
      return { q: `Jupiter orbits the Sun every 12 years. An asteroid's orbital period is ${n}/${d} of Jupiter's. Its period is:`, ans,
        wrong: uniq(ans, [`${num(12 * d / n)} years`, `${num(p * 2)} years`, `${num(p / 2)} years`, `${num(12 + p)} years`, `${num(12 - n - d)} years`]),
        why: `Period = ${n}/${d} x 12 years = ${num(p)} years. A period that is a simple fraction of Jupiter's means repeated, well-timed tugs from Jupiter, so few asteroids stay there: a Kirkwood gap.` };
    }
    const k = rnd([2, 3, 4]), p = 12 / k, ans = `1/${k}`;
    return { q: `An asteroid takes ${p} years to orbit the Sun. Jupiter takes 12 years. What fraction of Jupiter's period is the asteroid's?`, ans,
      wrong: uniq(ans, [`${k}`, `1/${k * k}`, `1/${k + 1}`, `1/${2 * k}`, `${p}/${k}`]),
      why: `${p} / 12 = 1/${k}. Every ${12} years Jupiter has lined up with this asteroid at the same points, nudging it the same way each time, so the orbit gets cleared (a Kirkwood gap).` };
  },
  "sb-density"() {
    const d = rnd([2.4, 1.5, 0.5]), V = rnd([2, 4, 5, 10]), M = +(d * V).toFixed(2), ans = `${num(d)} g/cm^3`;
    const meaning = d > 2 ? "close to solid rock, like Eros (2.4 g/cm^3)" : d > 1 ? "too low for solid rock: probably a loose rubble pile, like Mathilde (1.5 g/cm^3)" : "less dense than water (1 g/cm^3): ice mixed with empty space, like a comet nucleus";
    return { q: `A small body has a mass of ${num(M)} x 10^18 g and a volume of ${V} x 10^18 cm^3. Its average density is:`, ans,
      wrong: uniq(ans, [`${num(+(V / M).toFixed(2))} g/cm^3`, `${num(M * V)} g/cm^3`, `${num(M + V)} g/cm^3`, `${num(d * 2)} g/cm^3`, `${num(d / 10)} g/cm^3`]),
      why: `Density = mass / volume = ${num(M)} / ${V} = ${num(d)} g/cm^3 (the 10^18 cancels). That is ${meaning}.` };
  },
  "stm-discharge"() {
    const w = rnd([4, 5, 8, 10, 12, 20]), d = rnd([0.5, 1, 1.5, 2, 3]), v = rnd([0.5, 1, 1.5, 2, 3]), A = w * d, Q = A * v, ans = `${num(Q)} m^3/s`;
    return { q: `A stream channel is ${w} m wide and ${num(d)} m deep, and the water flows at ${num(v)} m/s. Its discharge is:`, ans,
      wrong: uniq(ans, [`${num(A)} m^3/s`, `${num(w * v)} m^3/s`, `${num(w + d + v)} m^3/s`, `${num(Q * 2)} m^3/s`, `${num(A / v)} m^3/s`, `${num(Q / 2)} m^3/s`]),
      why: `Discharge = cross-sectional area x velocity. Area = ${w} m x ${num(d)} m = ${num(A)} m^2, so Q = ${num(A)} x ${num(v)} = ${num(Q)} m^3/s.` };
  },
  "stm-recurrence"() {
    if (Math.random() < 0.5) {
      const ri = rnd([2, 4, 5, 10, 20, 25, 50, 100, 200, 500]), p = 100 / ri, ans = `${num(p)}%`;
      return { q: `A ${ri}-year flood has what chance of happening in any one year?`, ans,
        wrong: uniq(ans, [`${num(ri)}%`, `${num(p * 10)}%`, `${num(p / 10)}%`, `${num(100 - p)}%`, `${num(p * 2)}%`]),
        why: `Chance each year = 100 / recurrence interval = 100 / ${ri} = ${num(p)}%. A ${ri}-year flood can still happen in two years in a row.` };
    }
    const p = rnd([50, 25, 20, 10, 5, 2, 1, 0.5, 0.2]), ri = 100 / p, ans = `${num(ri)} years`;
    return { q: `A flood has a ${num(p)}% chance of happening in any one year. Its recurrence interval is:`, ans,
      wrong: uniq(ans, [`${num(p)} years`, `${num(ri * 10)} years`, `${num(ri / 10)} years`, `${num(ri * 2)} years`, `${num(100 - p)} years`]),
      why: `Recurrence interval = 100 / (% chance each year) = 100 / ${num(p)} = ${num(ri)} years.` };
  },
  "gw-gradient"() {
    const j = rnd([200, 250, 400, 500, 1000, 2000]), dh = rnd([2, 4, 5, 10, 20]), h2 = rnd([50, 80, 100, 120]), h1 = h2 + dh, g = dh / j, ans = num(g);
    return { q: `Two wells are ${j} m apart along a groundwater flow path. The hydraulic head is ${h1} m in the first and ${h2} m in the second. The hydraulic gradient is:`, ans,
      wrong: uniq(ans, [num(j / dh), num(h1 / j), num(dh * j), num(g * 10), num(g / 10), num((h1 + h2) / j)]),
      why: `Hydraulic gradient = (h1 - h2) / flow path length = (${h1} - ${h2}) / ${j} = ${dh} / ${j} = ${num(g)}.` };
  },
  "gw-travel"() {
    const v = rnd([0.1, 0.2, 0.5, 1, 2]), d = rnd([100, 200, 365, 500, 1000]), t = d / v, ans = `${num(t)} days`;
    return { q: `Groundwater moves at about ${num(v)} m per day. How long does it take to travel ${d} m to a well?`, ans,
      wrong: uniq(ans, [`${num(d * v)} days`, `${num(t / 10)} days`, `${num(t * 10)} days`, `${num(v / d)} days`, `${num(t / 2)} days`]),
      why: `Time = distance / speed = ${d} m / ${num(v)} m per day = ${num(t)} days. Groundwater is slow because it squeezes through tiny pores.` };
  },
  "res-barrels"() {
    const v = Math.floor(Math.random() * 3);
    if (v === 0) {
      const b = rnd([2, 5, 10, 20, 50, 100]), ans = `${num(b * 159)} L`;
      return { q: `How many litres of oil are in ${b} barrels?`, ans,
        wrong: uniq(ans, [`${num(b * 42)} L`, `${num(b * 100)} L`, `${num(b * 1000)} L`, `${num(b * 1590)} L`, `${num(b * 15.9)} L`]),
        why: `1 barrel = 159 litres (or 42 gallons), so ${b} barrels = ${b} x 159 = ${num(b * 159)} L.` };
    }
    if (v === 1) {
      const b = rnd([2, 5, 10, 20, 50, 100]), ans = `${num(b * 42)} gallons`;
      return { q: `How many gallons of oil are in ${b} barrels?`, ans,
        wrong: uniq(ans, [`${num(b * 159)} gallons`, `${num(b * 100)} gallons`, `${num(b * 4.2)} gallons`, `${num(b * 420)} gallons`, `${num(b * 24)} gallons`]),
        why: `1 barrel = 42 gallons (or 159 litres), so ${b} barrels = ${b} x 42 = ${num(b * 42)} gallons.` };
    }
    const b = rnd([2, 5, 10, 20, 100]), L = b * 159, ans = `${b} barrels`;
    return { q: `A tank holds ${num(L)} litres of oil. How many barrels is that?`, ans,
      wrong: uniq(ans, [`${num(+(L / 42).toFixed(1))} barrels`, `${num(L / 100)} barrels`, `${num(L / 1000)} barrels`, `${num(b * 10)} barrels`, `${num(L * 159)} barrels`]),
      why: `1 barrel = 159 litres, so ${num(L)} L / 159 = ${b} barrels.` };
  },
  "res-lifetime"() {
    const use = rnd([2, 4, 5, 10, 20, 25]), yrs = rnd([20, 30, 45, 50, 65, 75, 120]), R = use * yrs, ans = `${yrs} years`;
    return { q: `A mineral has calculated reserves of ${num(R)} million tonnes, and the world uses ${use} million tonnes a year. About how long will the reserves last?`, ans,
      wrong: uniq(ans, [`${num(R)} years`, `${num(R * use)} years`, `${num(yrs * 2)} years`, `${num(yrs / 2)} years`, `${num(yrs * 10)} years`]),
      why: `Lifetime = reserves / amount used per year = ${num(R)} / ${use} = ${yrs} years, if use stays the same.` };
  },
  "moon-resonance"() {
    const v = rnd([0, 1, 2, 3]);
    if (v === 0) {
      const n = rnd([2, 3, 5, 6, 10]), ans = `${4 * n} orbits`;
      return { q: `Io, Europa and Ganymede share a 4 : 2 : 1 orbital resonance. While Ganymede completes ${n} orbits of Jupiter, how many orbits does Io complete?`, ans,
        wrong: uniq(ans, [`${n} orbits`, `${2 * n} orbits`, `${8 * n} orbits`, `${n + 4} orbits`, `${16 * n} orbits`]),
        why: `In the time Ganymede orbits once, Europa orbits twice and Io four times. So ${n} Ganymede orbits = 4 x ${n} = ${4 * n} Io orbits.` };
    }
    if (v === 1) {
      const m = rnd([8, 12, 16, 20, 40]), ans = `${m / 2} orbits`;
      return { q: `Io completes ${m} orbits of Jupiter. In the same time, how many orbits does Europa complete?`, ans,
        wrong: uniq(ans, [`${m / 4} orbits`, `${m} orbits`, `${2 * m} orbits`, `${m / 2 + 2} orbits`, `${4 * m} orbits`]),
        why: `Io orbits 4 times for every 2 Europa orbits, so Europa makes half as many: ${m} / 2 = ${m / 2} orbits (and Ganymede ${m / 4}).` };
    }
    if (v === 2) {
      const io = rnd([true, false]), ans = io ? "about 1.75 days" : "about 3.5 days";
      return { q: `Ganymede takes about 7 days to orbit Jupiter. Using the 4 : 2 : 1 resonance, about how long does ${io ? "Io" : "Europa"} take for one orbit?`, ans,
        wrong: uniq(ans, ["about 1.75 days", "about 3.5 days", "about 7 days", "about 14 days", "about 28 days"]),
        why: `${io ? "Io fits 4 orbits" : "Europa fits 2 orbits"} into Ganymede's one 7-day orbit, so each takes about 7 / ${io ? 4 : 2} = ${io ? "1.75" : "3.5"} days. Inner moons orbit faster.` };
    }
    const k = rnd([8, 12, 20, 40]), d = k * 7 / 4, ans = `about ${num(d)} days`;
    return { q: `Io completes 4 orbits in about 7 days. About how long does it take Io to complete ${k} orbits?`, ans,
      wrong: uniq(ans, [`about ${num(k * 7)} days`, `about ${num(k * 4)} days`, `about ${num(k * 7 / 2)} days`, `about ${num(k / 4)} days`, `about ${num(d * 2)} days`]),
      why: `${k} orbits is ${k} / 4 = ${k / 4} groups of 4 orbits, and each group takes about 7 days: ${k / 4} x 7 = ${num(d)} days.` };
  },
  "jov-gas"() {
    const M = rnd([14, 20, 25, 40, 50, 80, 95, 100, 200, 318]), seed = 10, gas = Math.round((M - seed) / M * 100), core = Math.round(seed / M * 100);
    if (rnd([0, 1]) === 0) {
      const ans = `${gas}%`;
      return { q: `A giant planet has ${M} Earth masses. It grew from an ice-rich seed of about ${seed} Earth masses and captured the rest as hydrogen and helium gas. About what percent of its mass is captured gas?`, ans,
        wrong: uniq(ans, [`${core}%`, `${M - seed}%`, `${Math.min(99, gas + 15)}%`, `${Math.max(1, gas - 20)}%`, `${Math.round(M / (M + seed) * 100)}%`, "50%"]),
        why: `Captured gas = ${M} - ${seed} = ${M - seed} Earth masses, and ${M - seed} / ${M} is about ${gas}%. The seed is the other ${100 - gas}%.` };
    }
    const ans = `${core}%`;
    return { q: `A giant planet has ${M} Earth masses and grew from an ice-rich seed of about ${seed} Earth masses. About what percent of its mass is the original seed?`, ans,
      wrong: uniq(ans, [`${gas}%`, `${seed}%`, `${Math.round(M / seed)}%`, `${Math.min(99, core * 2 + 5)}%`, `${Math.max(1, Math.round(core / 3))}%`, "50%"]),
      why: `Seed fraction = ${seed} / ${M}, about ${core}%. (For Jupiter, 10 / 318 is about 3%; for Saturn, 10 / 95 is about 10%.)` };
  },
  "jov-spin"() {
    const [k, P] = rnd([[5, 12], [10, 12], [4, 16], [5, 10], [10, 10], [6, 16], [8, 12], [4, 12], [11, 10], [9, 12]]), v = k * 24 / P, ans = `${num(v)} times faster`;
    return { q: `A giant planet's radius is ${k} times Earth's and it spins once every ${P} hours (Earth: 24 hours). A point on its equator moves how many times faster than a point on Earth's equator?`, ans,
      wrong: uniq(ans, [`${num(k)} times faster`, `${num(24 / P)} times faster`, `${num(k * P / 24)} times faster`, `${num(v * 2)} times faster`, `${num(k * k * 24 / P)} times faster`]),
      why: `Equator speed = circumference / period, and circumference is proportional to radius. So the ratio is (${k}) x (24 / ${P}) = ${num(v)}. A big radius and a short day both make it faster.` };
  },
  kepler() {
    const a = rnd([4, 9, 16, 25]), p = a ** 1.5, ans = `${p} years`;
    return { q: `A planet orbits a Sun-like star at an average distance of ${a} AU. Using Kepler's third law, its orbital period is:`, ans, wrong: uniq(ans, [`${a} years`, `${a * a} years`, `${a ** 3} years`, `${a / 2} years`, `${Math.sqrt(a)} years`]),
      why: `For a Sun-like star, p^2 = a^3 (p in years, a in AU). So p = a^1.5 = ${a}^1.5 = ${p} years.` };
  },
};

// first nudge before the full explanation: which idea or formula to reach for
const HINTS = {
  "inv-square": "Gravity follows an inverse-square law: force is proportional to 1 / (distance squared).",
  "gravity-masses": "F = G m1 m2 / d^2. Masses multiply the force; distance divides it by the square.",
  "c-lambda": "c = wavelength x frequency, so frequency = c / wavelength. Convert the wavelength to metres first.",
  photon: "Photon energy is proportional to frequency, and frequency is proportional to 1 / wavelength.",
  kinetic: "Kinetic energy = 1/2 x mass x speed squared. Square the speed first.",
  "ke-double": "Kinetic energy depends on speed squared, so a change in speed counts twice.",
  momentum: "Momentum = mass x velocity. Unlike kinetic energy, velocity is not squared.",
  force: "Newton's second law: force = mass x acceleration.",
  doppler: "Speed = c x (shift in wavelength / rest wavelength). A longer wavelength means moving away.",
  "tel-area": "Light-collecting area is proportional to the mirror's diameter squared.",
  "tel-res": "The smallest angle a telescope can separate is proportional to wavelength / diameter. A smaller angle means a sharper image.",
  kepler: "For a Sun-like star, period squared = distance cubed (years and AU), so period = distance^1.5.",
  "atm-pressure": "Pressure = force / area. One pascal (Pa) is one newton per square metre.",
  "atm-units": "1 kPa = 1000 Pa, 1 bar = 100,000 Pa and 1 atm = 101,325 Pa.",
  "ah-thermal": "Peak thermal velocity = √(2kT/m): it rises with the square root of the kelvin temperature and falls with the square root of the particle mass.",
  "ah-escape": "Rule of thumb: a gas whose peak thermal velocity is more than about 20% of the escape velocity is lost to space within a few billion years.",
  "sb-resonance": "Jupiter's period is 12 years. Asteroid period = fraction x 12, and fraction = asteroid period / 12.",
  "sb-density": "Density = mass / volume. Solid rock is about 2.4 g/cm^3, a rubble pile about 1.5, and less than 1 means lighter than water.",
  "stm-discharge": "Discharge = cross-sectional area x velocity, and area = width x depth for a simple channel.",
  "stm-recurrence": "Chance each year (%) = 100 / recurrence interval in years. A 100-year flood has a 1% chance every year.",
  "gw-gradient": "Hydraulic gradient = difference in head (h1 - h2) / length of the flow path between the two places.",
  "gw-travel": "Time = distance / speed. Keep the units the same: metres and metres per day give days.",
  "res-barrels": "1 barrel (bbl) of oil = 42 gallons = 159 litres.",
  "res-lifetime": "Lifetime (years) = calculated reserves / amount used each year.",
  "moon-resonance": "In the same time: Io 4 orbits, Europa 2, Ganymede 1 (about 7 days). Inner moons orbit faster.",
  "jov-gas": "Captured gas = total mass - seed mass (about 10 Earth masses). Divide each part by the total to get a percent.",
  "jov-spin": "Equator speed = circumference / period. Circumference grows with radius, so speed ratio = radius ratio x (24 h / period).",
};
