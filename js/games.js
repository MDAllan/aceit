import * as S from "./store.js";
import { h, md, clean, ic, toast, shuffle, confetti, pick, floatXP } from "./ui.js";

export const DEFAULT_GAMES = ["match", "memory", "blitz", "guess", "speed", "picture"];

const EMOJI = { match: "\u{1F9E9}", memory: "\u{1F9E0}", blitz: "\u26A1", guess: "\u{1F4A1}", speed: "\u23F1\uFE0F", picture: "\u{1F5BC}\uFE0F", timeline: "\u23F3", order: "\u{1FA9C}", halflife: "\u2622\uFE0F", sort: "\u{1F5C2}\uFE0F", calc: "\u{1F9EE}" };
const GCOL = { match: "#2F9E94", memory: "#7A6FDB", blitz: "#D9777F", guess: "#4E9FD0", speed: "#C8627A", picture: "#3AA687", timeline: "#8E7CC3", order: "#CC8A3A", halflife: "#3F9FB8", sort: "#B070C8", calc: "#4A63C9" };
const META = {
  match: ["games", "#2F9E94", "Matching cards", "Match each term with its meaning."],
  memory: ["cards", "#7A6FDB", "Memory flip", "Flip two face-down cards to find pairs."],
  blitz: ["quiz", "#D9777F", "True or false blitz", "10 quick statements. Is it true?"],
  guess: ["bulb", "#4E9FD0", "Guess the term", "Read the meaning, pick the right word."],
  speed: ["fire", "#C8627A", "60-second sprint", "Answer as many quiz questions as you can."],
  picture: ["zoom", "#3AA687", "Picture quiz", "Which topic does this picture belong to?"],
  timeline: ["chart", "#8E7CC3", "Clickable timeline", "Tap an eon or era to explore events."],
  order: ["list", "#CC8A3A", "Order the events", "Stack layers from oldest to youngest."],
  halflife: ["star", "#3F9FB8", "Half-life calculator", "Play with radioactive decay."],
  sort: ["sort", "#B070C8", "Sort it out", "Drop each item into the right group."],
  calc: ["calc", "#4A63C9", "Number cruncher", "Fresh calculations every time. Beat the numbers."],
};

export function renderGame(b, lec, all) {
  const imgSecs = lec.sections.filter((s) => s.images?.length && !/clicker|question/i.test(s.title));
  const ok = (g) => (g === "picture" ? imgSecs.length >= 4 : ["match", "memory", "blitz", "guess"].includes(g) ? lec.cards.length >= 8 : g === "speed" ? (lec.quiz || []).length >= 5 : g === "sort" ? lec.sort?.length : g === "calc" ? lec.calc?.length : g === "order" ? lec.order?.length : true);
  const draw = () => {
    b.replaceChildren(h("p", { style: "color:var(--mute);margin:6px 0" }, "Pick a game. Playing any 3 counts toward your completion."),
      h(".grid", lec.games.filter((g) => META[g] && ok(g)).map((g, i) => {
        const [icon, col, name, desc] = META[g], played = S.progress().games[lec.id + ":" + g];
        return h("button.card.gcard", { style: `animation:rise .4s var(--ease) ${i * 40}ms backwards;--gc:${GCOL[g] || col}`, onclick: () => start(g) },
          h(".gi", EMOJI[g] || ""), h("div", { style: "flex:1" }, h("b", name), h(".src", { style: "margin:0" }, desc)),
          played ? h("span.pill.ok", "Played") : "");
      })));
  };
  const start = (g) => {
    b.style.setProperty("--c", GCOL[g] || "var(--brand)");
    b.replaceChildren(h("button.btn.alt.sm", { onclick: () => { b.style.removeProperty("--c"); draw(); }, style: "margin:8px 0" }, ic("left", 16), "All games"));
    const box = h("div"); b.append(box);
    const again = () => { box.replaceChildren(); G[g](box, lec, again); };
    G[g](box, lec, again);
  };
  draw();
}

const txt = (c) => c.short || c.back;
const done = (lec, g) => S.gameDone(lec.id + ":" + g);
const endCard = (title, score, total, again, extra) => h(".card.pop", { style: "text-align:center" }, h("h2", title), h(".score", `${score}/${total}`),
  extra || "", h("button.btn", { style: "margin-top:10px", onclick: again }, "Play again"));
const nextBtn = (last, fn) => h("button.btn", { style: "margin-top:10px", onclick: fn }, last ? "See score" : "Next", ic("right", 18));

const G = {
  /* ---- matching cards: tap a term, then its meaning ---- */
  match(b, lec, again) {
    const pool = pick(lec.cards, 6);
    const tiles = shuffle(pool.flatMap((c) => [{ id: c.id, t: c.front, k: "t" }, { id: c.id, t: txt(c), k: "d" }]));
    let first = null, lock = false, found = 0, tries = 0;
    const info = h(".src", "Tries: 0 · Pairs: 0/" + pool.length), grid = h(".mg");
    tiles.forEach((t) => {
      const el = h("button.mc", t.k === "t" ? h("b", md(t.t)) : md(t.t));
      el.onclick = () => {
        if (lock || el.classList.contains("done") || el === first?.el) return;
        el.classList.add("sel");
        if (!first) { first = { t, el }; return; }
        tries++; lock = true; const a = first; first = null;
        if (a.t.id === t.id && a.t.k !== t.k) {
          a.el.classList.replace("sel", "done"); el.classList.replace("sel", "done"); found++; lock = false;
          if (found === pool.length) { done(lec, "match"); confetti(); toast(`All matched in ${tries} tries!`); grid.after(h("button.btn", { style: "margin-top:12px", onclick: again }, "Play again")); }
        } else { a.el.classList.add("shake"); el.classList.add("shake"); setTimeout(() => { [a.el, el].forEach((x) => x.classList.remove("sel", "shake")); lock = false; }, 600); }
        info.textContent = `Tries: ${tries} · Pairs: ${found}/${pool.length}`;
      };
      grid.append(el);
    });
    b.append(h("h2", "\u{1F9E9} Matching cards"), h("p", "Tap a term, then tap its meaning."), info, grid);
  },

  /* ---- memory: face-down pairs ---- */
  memory(b, lec, again) {
    const pool = pick(lec.cards, 6);
    const tiles = shuffle(pool.flatMap((c) => [{ id: c.id, t: c.front, k: "t" }, { id: c.id, t: txt(c), k: "d" }]));
    let open = [], lock = false, found = 0, moves = 0;
    const info = h(".src", "Moves: 0 · Pairs: 0/" + pool.length), grid = h(".mg.mem");
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
        if (a.t.id === c.t.id) { a.el.classList.add("done"); c.el.classList.add("done"); found++; lock = false; if (found === pool.length) { done(lec, "memory"); confetti(); toast(`Cleared in ${moves} moves!`); grid.after(h("button.btn", { style: "margin-top:12px", onclick: again }, "Play again")); } }
        else setTimeout(() => { a.el.setUp(false); c.el.setUp(false); lock = false; }, 900);
        info.textContent = `Moves: ${moves} · Pairs: ${found}/${pool.length}`;
      };
      grid.append(el);
    });
    b.append(h("h2", "\u{1F9E0} Memory flip"), h("p", "Flip two cards. A term and its meaning make a pair."), info, grid);
  },

  /* ---- true / false blitz ---- */
  blitz(b, lec, again) {
    const rounds = pick(lec.cards, 10); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "blitz"); if (score >= 8) confetti(); return b.append(endCard("\u26A1 Blitz finished!", score, rounds.length, again)); }
      const c = rounds[i], truth = Math.random() < 0.5;
      const other = pick(lec.cards.filter((x) => x.id !== c.id && txt(x) !== txt(c)), 1)[0];
      const shown = truth ? txt(c) : txt(other);
      const fb = h("div", { "aria-live": "polite" });
      const ans = (v) => {
        const ok = v === truth; if (ok) { score++; floatXP("\u2705 +1"); }
        fb.replaceChildren(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F605} Oops. "), truth ? "Yes: " : "Not quite. The real meaning: ", md(`${c.front} = ${txt(c)}`)), nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
        btns.forEach((x) => (x.disabled = true));
      };
      const btns = [h("button.btn.ok", { onclick: () => ans(true) }, "True"), h("button.btn.warn", { onclick: () => ans(false) }, "False")];
      b.append(h(".src", `Statement ${i + 1} of ${rounds.length}`), h(".bar", h("i", { style: `width:${(i / rounds.length) * 100}%` })),
        h(".card", { style: "margin-top:10px;text-align:center" }, h("p", { style: "color:var(--mute);margin:0" }, "True or false?"), h("h2", { style: "margin:.4rem 0" }, md(c.front)), h("p", { style: "font-size:1.05rem" }, "means: ", h("b", md(shown))), h(".tf", btns), fb));
    };
    draw();
  },

  /* ---- guess the term ---- */
  guess(b, lec, again) {
    const rounds = pick(lec.cards, 8); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "guess"); if (score >= 6) confetti(); return b.append(endCard("\u{1F4A1} Terms guessed!", score, rounds.length, again)); }
      const c = rounds[i], opts = shuffle([c, ...pick(lec.cards.filter((x) => x.id !== c.id), 3)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcd"[k]), h("span", md(o.front))); bt.onclick = () => {
        if (got) return; got = true; const ok = o === c; if (ok) { score++; floatXP("\u2705 +1"); }
        els.forEach((x, j) => { if (opts[j] === c) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
      }; return bt; });
      b.append(h(".src", `Round ${i + 1} of ${rounds.length}`), h(".bar", h("i", { style: `width:${(i / rounds.length) * 100}%` })),
        h(".card", { style: "margin-top:10px" }, h("p", { style: "color:var(--mute);margin:0 0 4px" }, "Which term is this?"), h(".q", md(c.back)), els, fb));
    };
    draw();
  },

  /* ---- 60-second sprint ---- */
  speed(b, lec, again) {
    const qs = shuffle(lec.quiz.slice()); let i = 0, score = 0, combo = 0, best = 0, t = 60, over = false;
    const clock = h(".timer", "60"), sc = h("b", "0"), cmb = h("span.combo", "");
    const bar = h(".row", { style: "justify-content:space-between" }, h("span", "Time ", clock), h("span", "Score ", sc), cmb);
    const body = h("div");
    const tick = setInterval(() => { if (!b.isConnected) return clearInterval(tick); t--; clock.textContent = t; if (t <= 0) { clearInterval(tick); finish(); } }, 1000);
    const finish = () => { if (over) return; over = true; done(lec, "speed"); if (score >= 6) confetti(); b.replaceChildren(endCard("\u23F1\uFE0F Time's up!", score, i, again, h("p", `Best streak: ${best}`))); };
    const draw = () => {
      if (over) return;
      const q = qs[i % qs.length]; let got = false;
      const els = q.options.map((o, k) => { const bt = h("button.opt", h("b", "abcde"[k]), h("span", md(o))); bt.onclick = () => {
        if (got || over) return; got = true; const ok = k === q.answer; i++;
        if (ok) { score++; combo++; best = Math.max(best, combo); floatXP("\u2705 +1"); } else combo = 0;
        sc.textContent = score; cmb.textContent = combo >= 2 ? `${combo} streak` : "";
        els.forEach((x, j) => { if (j === q.answer) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        setTimeout(draw, ok ? 450 : 1100);
      }; return bt; });
      body.replaceChildren(h(".card", h(".q", md(q.q)), els));
    };
    b.append(h("h2", "\u23F1\uFE0F 60-second sprint"), bar, body); draw();
  },

  /* ---- picture quiz ---- */
  picture(b, lec, again) {
    const secs = lec.sections.filter((s) => s.images?.length && !/clicker|question/i.test(s.title)), rounds = pick(secs, Math.min(8, secs.length)); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "picture"); if (score >= rounds.length - 2) confetti(); return b.append(endCard("\u{1F5BC}\uFE0F Picture quiz done!", score, rounds.length, again)); }
      const s = rounds[i], im = pick(s.images, 1)[0], opts = shuffle([s, ...pick(secs.filter((x) => x !== s), 3)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcd"[k]), h("span", clean(o.title))); bt.onclick = () => {
        if (got) return; got = true; const ok = o === s; if (ok) { score++; floatXP("\u2705 +1"); }
        els.forEach((x, j) => { if (opts[j] === s) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        fb.append(nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
      }; return bt; });
      b.append(h(".src", `Picture ${i + 1} of ${rounds.length}`), h(".bar", h("i", { style: `width:${(i / rounds.length) * 100}%` })),
        h(".card", { style: "margin-top:10px" }, h(".fig", { style: "cursor:default;margin-bottom:10px" }, h("img", { src: im.src, alt: "Mystery picture" })), h(".q", "Which topic is this picture from?"), els, fb));
    };
    draw();
  },

  /* ---- clickable timeline ---- */
  timeline(b, lec) {
    const T = lec.timeline; if (!T) return b.append(h("p", "No timeline data."));
    let range = null, openEv = null;
    const kindName = { life: "Life", earth: "Earth", super: "Supercontinent", extinct: "Extinction", climate: "Climate" };
    const kindIcon = { life: "star", earth: "fire", super: "list", extinct: "alert", climate: "chart" };
    const bar = (items, total) => h(".tl", items.map((e) => { const w = ((e.from - e.to) / total) * 100;
      return h("button" + (range === e ? ".on" : ""), { style: `width:${w}%;background:${e.color}`, title: e.name, "aria-label": e.name, onclick: () => { range = range === e ? null : e; openEv = null; draw(); } }, w > 7 ? e.name : ""); }));
    const draw = () => {
      b.replaceChildren();
      const inRange = T.events.filter((e) => !range || (e.ma <= range.from && e.ma >= range.to));
      b.append(h("h2", "\u23F3 Earth's timeline"), h("p", { style: "color:var(--mute)" }, "Top bar: all 4,570 million years to scale. Bottom bar: zoom on the last 542 million. Tap a block to filter events."),
        h(".src", "Whole history (4570 to 0 Ma)"), bar(T.eons, T.total), h(".src", "Zoom: Phanerozoic eras (542 to 0 Ma)"), bar(T.eras, 542),
        h(".row", range ? [h("span.pill", { style: `background:${range.color}` }, `${range.name}: ${range.from} to ${range.to} Ma`), h("button.btn.alt.sm", { onclick: () => { range = null; draw(); } }, "Show all")] : h(".src", "Showing all events")),
        range?.note ? h(".card", { style: "margin:8px 0" }, h("b", "About the " + range.name), h("p", { style: "margin:.2rem 0 0" }, md(range.note))) : "",
        h("div", inRange.map((e, k) => { const on = openEv === e;
          return h("button.ev", { style: `animation-delay:${Math.min(k, 10) * 25}ms`, onclick: () => { openEv = on ? null : e; if (!on) done(lec, "timeline"); draw(); } },
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
    const upd = () => {
      const x = iso[sel.value], k = +n.value, frac = Math.pow(0.5, k), age = k * x.half;
      vis.replaceChildren(h(".bar", { style: "height:26px" }, h("i", { style: `width:${frac * 100}%;background:var(--accent)` })));
      out.replaceChildren(h("p", h("b", k + " half-lives"), " have passed = ", h("b", span(age, x.unit))), h("p", `Parent left: ${(frac * 100).toFixed(2)}% · Daughter made: ${(100 - frac * 100).toFixed(2)}%`),
        h(".acc.why.open", { style: "padding:10px 14px" }, h("b", "Why it works: "), "Every half-life, half of the remaining parent atoms decay. It never reaches zero; it just halves again and again. Measure the parent and daughter amounts and you can run the clock backwards."));
      done(lec, "halflife");
    };
    sel.onchange = n.oninput = upd;
    const rev = h("input", { type: "number", min: 0.01, max: 100, step: 0.01, placeholder: "e.g. 25", style: "max-width:160px", "aria-label": "Percent of parent left" });
    const revOut = h("p");
    rev.oninput = () => { const p = +rev.value; if (!(p > 0 && p <= 100)) { revOut.textContent = ""; return; } const x = iso[sel.value], k = Math.log2(100 / p);
      revOut.replaceChildren("If ", h("b", p + "%"), " of the parent is left, the sample is about ", h("b", span(k * x.half, x.unit)), ` old (${k.toFixed(2)} half-lives).`); };
    b.append(h("h2", "\u2622\uFE0F Half-life calculator"), h("label", "Isotope"), sel, h("label", "Half-lives passed"), n, h("div", { style: "margin:10px 0" }, vis), out,
      h("h3", { style: "margin-top:16px" }, "Run it backwards: find the age"), h("label", "% of parent isotope still left"), rev, revOut);
    upd();
  },

  /* ---- sort it out ---- */
  sort(b, lec, again) {
    const acts = shuffle(lec.sort.slice()); let ai = 0;
    const run = (act) => {
      const items = shuffle(act.items.slice()); let i = 0, score = 0;
      const draw = () => {
        b.replaceChildren();
        if (i >= items.length) { done(lec, "sort"); if (score >= items.length - 1) confetti(); const more = ai + 1 < acts.length;
          return b.append(h(".card.pop", { style: "text-align:center" }, h("h2", act.title), h(".score", `${score}/${items.length}`), h("button.btn", { style: "margin-top:10px", onclick: () => { ai = (ai + 1) % acts.length; run(acts[ai]); } }, more ? "Next activity" : "Play again"))); }
        const it = items[i]; let got = false; const fb = h("div", { "aria-live": "polite" });
        const bt = act.buckets.map((name, k) => h("button.btn.alt", { onclick: () => {
          if (got) return; got = true; const ok = k === it.b; if (ok) { score++; floatXP("\u2705 +1"); }
          bt.forEach((x, j) => { x.disabled = true; if (j === it.b) x.classList.add("ok"); });
          fb.append(h(".fb", h("b", ok ? "\u{1F389} Correct! " : "\u{1F914} Not quite. "), `It belongs with "${act.buckets[it.b]}".`, i === items.length - 1 || ok ? "" : "", act.why && !ok ? h("span", " ", md(act.why)) : ""), nextBtn(i + 1 === items.length, () => { i++; draw(); }));
        } }, md(name)));
        b.append(h("h2", act.title), act.prompt ? h("p", { style: "color:var(--mute)" }, md(act.prompt)) : "", h(".src", `Item ${i + 1} of ${items.length}`), h(".bar", h("i", { style: `width:${(i / items.length) * 100}%` })),
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
      if (i >= rounds) { done(lec, "calc"); if (score >= 6) confetti(); return b.append(endCard("\u{1F9EE} Calculations done!", score, rounds, again)); }
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
  kepler: "For a Sun-like star, period squared = distance cubed (years and AU), so period = distance^1.5.",
};
