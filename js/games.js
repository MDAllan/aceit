import * as S from "./store.js";
import { h, md, clean, ic, toast, shuffle, confetti, pick } from "./ui.js";

export const DEFAULT_GAMES = ["match", "memory", "blitz", "guess", "speed", "picture"];

const META = {
  match: ["games", "#2563eb", "Matching cards", "Match each term with its meaning."],
  memory: ["cards", "#7c3aed", "Memory flip", "Flip two face-down cards to find pairs."],
  blitz: ["quiz", "#059669", "True or false blitz", "10 quick statements. Is it true?"],
  guess: ["bulb", "#f59e0b", "Guess the term", "Read the meaning, pick the right word."],
  speed: ["fire", "#dc2626", "60-second sprint", "Answer as many quiz questions as you can."],
  picture: ["zoom", "#0ea5e9", "Picture quiz", "Which topic does this picture belong to?"],
  timeline: ["chart", "#c0504d", "Clickable timeline", "Tap an eon or era to explore events."],
  order: ["list", "#8a5a44", "Order the events", "Stack layers from oldest to youngest."],
  halflife: ["star", "#14b8a6", "Half-life calculator", "Play with radioactive decay."],
};

export function renderGame(b, lec, all) {
  const imgSecs = lec.sections.filter((s) => s.images?.length && !/clicker|question/i.test(s.title));
  const ok = (g) => (g === "picture" ? imgSecs.length >= 4 : ["match", "memory", "blitz", "guess"].includes(g) ? lec.cards.length >= 8 : g === "speed" ? (lec.quiz || []).length >= 5 : true);
  const draw = () => {
    b.replaceChildren(h("p", { style: "color:var(--mute);margin:6px 0" }, "Pick a game. Playing any 3 counts toward your completion."),
      h(".grid", lec.games.filter((g) => META[g] && ok(g)).map((g, i) => {
        const [icon, col, name, desc] = META[g], played = S.progress().games[lec.id + ":" + g];
        return h("button.card.gcard", { style: `animation:rise .4s var(--ease) ${i * 40}ms backwards`, onclick: () => start(g) },
          h(".gi", { style: `background:${col}` }, ic(icon, 22)), h("div", { style: "flex:1" }, h("b", name), h(".src", { style: "margin:0" }, desc)),
          played ? h("span.pill", { style: "background:var(--ok)" }, "Played") : "");
      })));
  };
  const start = (g) => {
    b.replaceChildren(h("button.btn.alt.sm", { onclick: draw, style: "margin:8px 0" }, ic("left", 16), "All games"));
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
    b.append(h("h2", "Matching cards"), h("p", "Tap a term, then tap its meaning."), info, grid);
  },

  /* ---- memory: face-down pairs ---- */
  memory(b, lec, again) {
    const pool = pick(lec.cards, 6);
    const tiles = shuffle(pool.flatMap((c) => [{ id: c.id, t: c.front, k: "t" }, { id: c.id, t: txt(c), k: "d" }]));
    let open = [], lock = false, found = 0, moves = 0;
    const info = h(".src", "Moves: 0 · Pairs: 0/" + pool.length), grid = h(".mg.mem");
    tiles.forEach((t) => {
      const el = h("button.mc", { "aria-label": "Hidden card" }, h(".in", h(".f.fr", "?"), h(".f.bk", t.k === "t" ? h("b", md(t.t)) : md(t.t))));
      el.onclick = () => {
        if (lock || el.classList.contains("up")) return;
        el.classList.add("up"); open.push({ t, el });
        if (open.length < 2) return;
        moves++; lock = true; const [a, c] = open; open = [];
        if (a.t.id === c.t.id) { a.el.classList.add("done"); c.el.classList.add("done"); found++; lock = false; if (found === pool.length) { done(lec, "memory"); confetti(); toast(`Cleared in ${moves} moves!`); grid.after(h("button.btn", { style: "margin-top:12px", onclick: again }, "Play again")); } }
        else setTimeout(() => { a.el.classList.remove("up"); c.el.classList.remove("up"); lock = false; }, 900);
        info.textContent = `Moves: ${moves} · Pairs: ${found}/${pool.length}`;
      };
      grid.append(el);
    });
    b.append(h("h2", "Memory flip"), h("p", "Flip two cards. A term and its meaning make a pair."), info, grid);
  },

  /* ---- true / false blitz ---- */
  blitz(b, lec, again) {
    const rounds = pick(lec.cards, 10); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "blitz"); if (score >= 8) confetti(); return b.append(endCard("Blitz finished", score, rounds.length, again)); }
      const c = rounds[i], truth = Math.random() < 0.5;
      const other = pick(lec.cards.filter((x) => x.id !== c.id && txt(x) !== txt(c)), 1)[0];
      const shown = truth ? txt(c) : txt(other);
      const fb = h("div", { "aria-live": "polite" });
      const ans = (v) => {
        const ok = v === truth; if (ok) score++;
        fb.replaceChildren(h(".fb", h("b", ok ? "Correct! " : "Oops. "), truth ? "Yes: " : "Not quite. The real meaning: ", md(`${c.front} = ${txt(c)}`)), nextBtn(i + 1 === rounds.length, () => { i++; draw(); }));
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
      if (i >= rounds.length) { done(lec, "guess"); if (score >= 6) confetti(); return b.append(endCard("Terms guessed", score, rounds.length, again)); }
      const c = rounds[i], opts = shuffle([c, ...pick(lec.cards.filter((x) => x.id !== c.id), 3)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcd"[k]), h("span", md(o.front))); bt.onclick = () => {
        if (got) return; got = true; const ok = o === c; if (ok) score++;
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
    const finish = () => { if (over) return; over = true; done(lec, "speed"); if (score >= 6) confetti(); b.replaceChildren(endCard("Time's up!", score, i, again, h("p", `Best streak: ${best}`))); };
    const draw = () => {
      if (over) return;
      const q = qs[i % qs.length]; let got = false;
      const els = q.options.map((o, k) => { const bt = h("button.opt", h("b", "abcde"[k]), h("span", md(o))); bt.onclick = () => {
        if (got || over) return; got = true; const ok = k === q.answer; i++;
        if (ok) { score++; combo++; best = Math.max(best, combo); } else combo = 0;
        sc.textContent = score; cmb.textContent = combo >= 2 ? `${combo} streak` : "";
        els.forEach((x, j) => { if (j === q.answer) x.classList.add("ok"); else if (j === k) x.classList.add("no"); });
        setTimeout(draw, ok ? 450 : 1100);
      }; return bt; });
      body.replaceChildren(h(".card", h(".q", md(q.q)), els));
    };
    b.append(h("h2", "60-second sprint"), bar, body); draw();
  },

  /* ---- picture quiz ---- */
  picture(b, lec, again) {
    const secs = lec.sections.filter((s) => s.images?.length && !/clicker|question/i.test(s.title)), rounds = pick(secs, Math.min(8, secs.length)); let i = 0, score = 0;
    const draw = () => {
      b.replaceChildren();
      if (i >= rounds.length) { done(lec, "picture"); if (score >= rounds.length - 2) confetti(); return b.append(endCard("Picture quiz done", score, rounds.length, again)); }
      const s = rounds[i], im = pick(s.images, 1)[0], opts = shuffle([s, ...pick(secs.filter((x) => x !== s), 3)]); let got = false;
      const fb = h("div", { "aria-live": "polite" });
      const els = opts.map((o, k) => { const bt = h("button.opt", h("b", "abcd"[k]), h("span", clean(o.title))); bt.onclick = () => {
        if (got) return; got = true; const ok = o === s; if (ok) score++;
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
      b.append(h("h2", "Earth's timeline"), h("p", { style: "color:var(--mute)" }, "Top bar: all 4,570 million years to scale. Bottom bar: zoom on the last 542 million. Tap a block to filter events."),
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
      const render = () => out.replaceChildren(h(".src", "Youngest on top, oldest at the bottom."), h(".strat", items.map((it, k) => h(".layer", { style: `background:${it.color}` }, h("span", md(it.name)),
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
    b.append(h("h2", "Half-life calculator"), h("label", "Isotope"), sel, h("label", "Half-lives passed"), n, h("div", { style: "margin:10px 0" }, vis), out,
      h("h3", { style: "margin-top:16px" }, "Run it backwards: find the age"), h("label", "% of parent isotope still left"), rev, revOut);
    upd();
  },
};

const span = (v, unit) => (unit === "million years" && v >= 1000 ? (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " billion years" : (+v.toFixed(2)).toLocaleString() + " " + unit);
const fmt = (ma) => (ma >= 1000 ? (ma / 1000).toFixed(2).replace(/\.?0+$/, "") + " Ga" : ma >= 1 ? "~" + ma + " Ma" : Math.round(ma * 1000) + " ka");
