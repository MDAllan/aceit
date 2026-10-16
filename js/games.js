import * as S from "./store.js";
import { h, md, toast, shuffle } from "./ui.js";

const NAMES = {
  match: ["🧩 Matching cards", "Flip two cards: match each term with its meaning."],
  timeline: ["⏳ Clickable timeline", "Tap an eon or era, then tap events to see what happened and why."],
  order: ["🪨 Order the events", "Stack the rock layers and events from oldest to youngest."],
  halflife: ["☢️ Half-life calculator", "Play with radioactive decay to see how age dating works."],
};

export function renderGame(b, lec, all) {
  const draw = () => {
    b.replaceChildren();
    b.append(h(".grid", (lec.games || []).map((g) => h("button.card.lec", { onclick: () => start(g) },
      h(".ic", { style: `background:${lec.color}22` }, NAMES[g][0].split(" ")[0]),
      h("div", h("b", NAMES[g][0].replace(/^\S+\s/, "")), h("small", NAMES[g][1]))))));
  };
  const start = (g) => {
    b.replaceChildren(h("button.btn.alt.sm", { onclick: draw, style: "margin:10px 0" }, "← All games"));
    const box = h("div"); b.append(box);
    ({ match, timeline, order, halflife })[g](box, lec, all);
  };
  if (!lec.games?.length) return b.append(h(".card", "No games for this lecture yet."));
  draw();
}

/* ---- matching cards ---- */
function match(b, lec) {
  const pool = shuffle(lec.cards.filter((c) => c.short || c.back).slice()).slice(0, 6);
  const tiles = shuffle(pool.flatMap((c) => [{ id: c.id, t: c.front, k: "t" }, { id: c.id, t: c.short || c.back, k: "d" }]));
  let first = null, lock = false, found = 0, tries = 0;
  const info = h(".src", "Tries: 0 · Pairs: 0/" + pool.length);
  const grid = h(".mg");
  tiles.forEach((t) => {
    const el = h("button.mc", t.k === "t" ? h("b", md(t.t)) : md(t.t));
    el.onclick = () => {
      if (lock || el.classList.contains("done") || el === first?.el) return;
      el.classList.add("sel");
      if (!first) { first = { t, el }; return; }
      tries++; lock = true;
      const a = first; first = null;
      if (a.t.id === t.id && a.t.k !== t.k) {
        a.el.classList.replace("sel", "done"); el.classList.replace("sel", "done"); found++; lock = false;
        if (found === pool.length) { S.gameDone(lec.id + ":match"); toast("🎉 All matched in " + tries + " tries!"); grid.after(h("button.btn", { style: "margin-top:12px", onclick: () => { b.replaceChildren(); match(b, lec); } }, "Play again")); }
      } else {
        a.el.classList.add("shake"); el.classList.add("shake");
        setTimeout(() => { [a.el, el].forEach((x) => x.classList.remove("sel", "shake")); lock = false; }, 600);
      }
      info.textContent = `Tries: ${tries} · Pairs: ${found}/${pool.length}`;
    };
    grid.append(el);
  });
  b.append(h("h2", "🧩 Matching cards"), h("p", "Tap a term, then tap its meaning."), info, grid);
}

/* ---- clickable timeline ---- */
function timeline(b, lec) {
  const T = lec.timeline; if (!T) return b.append(h("p", "No timeline data."));
  let range = null, openEv = null;
  const kindIcon = { life: "🦠", earth: "🌋", super: "🌐", extinct: "☠️", climate: "🧊" };
  const kindName = { life: "Life", earth: "Earth", super: "Supercontinent", extinct: "Extinction", climate: "Climate" };
  const bar = (items, total, from) => h(".tl", items.map((e) => {
    const w = ((e.from - e.to) / total) * 100;
    const bt = h("button" + (range === e ? ".on" : ""), { style: `width:${w}%;background:${e.color}`, title: e.name, "aria-label": e.name, onclick: () => { range = range === e ? null : e; openEv = null; draw(); } }, w > 7 ? e.name : "");
    return bt;
  }));
  const draw = () => {
    b.replaceChildren();
    const inRange = T.events.filter((e) => !range || (e.ma <= range.from && e.ma >= range.to));
    b.append(h("h2", "⏳ Earth's timeline"), h("p", { style: "color:var(--mute)" }, "Top bar: all 4,570 Ma to scale. Bottom bar: zoom on the last 542 Ma. Tap a block to filter events."),
      h(".src", "Whole history (4570 → 0 Ma)"), bar(T.eons, T.total),
      h(".src", "Zoom: Phanerozoic eras (542 → 0 Ma)"), bar(T.eras, 542),
      h(".row", range ? [h("span.pill", { style: `background:${range.color}` }, range.name + ": " + range.from + "–" + range.to + " Ma"), h("button.btn.alt.sm", { onclick: () => { range = null; draw(); } }, "Show all")] : h(".src", "Showing all events")),
      range?.note ? h(".box.why", h("span.t", "About the " + range.name), md(range.note)) : "",
      h("div", inRange.map((e) => {
        const on = openEv === e;
        return h("button.ev", { onclick: () => { openEv = on ? null : e; if (!on) S.gameDone(lec.id + ":timeline"); draw(); } },
          h("span.k", kindIcon[e.kind] || "•"), h("span.ma", e.show || fmt(e.ma)),
          h("div", h("b", e.title), h("span.pill", { style: "margin-left:8px;background:#6b7280" }, kindName[e.kind] || ""),
            on ? [h("div", md(e.text)), e.why ? h(".box.why", h("span.t", "💡 Why"), md(e.why)) : "", h(".src", e.src)] : ""));
      })));
  };
  draw();
}
const span = (v, unit) => (unit === "million years" && v >= 1000 ? (v / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " billion years" : Math.round(v * 100) / 100 + "" === "" ? "" : (+v.toFixed(2)).toLocaleString() + " " + unit);
const fmt = (ma) => (ma >= 1000 ? (ma / 1000).toFixed(ma % 1000 ? 2 : 0).replace(/\.?0+$/, "") + " Ga" : ma >= 1 ? "~" + ma + " Ma" : Math.round(ma * 1000) + " ka");

/* ---- order the events ---- */
function order(b, lec) {
  const sc = lec.order; if (!sc?.length) return b.append(h("p", "Coming soon."));
  let n = 0;
  const draw = () => {
    b.replaceChildren();
    const s = sc[n % sc.length];
    let items = shuffle(s.layers.map((x, i) => ({ ...x, i })));
    if (items.every((x, i) => x.i === i)) items.reverse();
    const out = h("div");
    const render = () => {
      out.replaceChildren(h(".src", "Top of the page = youngest at the top of the stack."), h(".strat", items.map((it, k) => h(".layer", { style: `background:${it.color}` },
        h("span", it.name),
        h(".mv", h("button", { "aria-label": "Move up", disabled: k === 0, onclick: () => { [items[k - 1], items[k]] = [items[k], items[k - 1]]; render(); } }, "↑"),
          h("button", { "aria-label": "Move down", disabled: k === items.length - 1, onclick: () => { [items[k + 1], items[k]] = [items[k], items[k + 1]]; render(); } }, "↓"))))));
    };
    render();
    const fb = h("div");
    b.append(h("h2", "🪨 " + s.title), h("p", md(s.prompt)), out,
      h(".row", { style: "margin-top:12px" }, h("button.btn", { onclick: () => {
        // layers are listed OLDEST first in the data; the stack on screen is YOUNGEST first
        const ok = items.every((x, k) => x.i === s.layers.length - 1 - k);
        fb.replaceChildren(h(".fb", h("b", ok ? "✅ Correct! " : "❌ Not yet. "), md(s.why), ok ? "" : h(".src", "Correct top-to-bottom: " + s.layers.slice().reverse().map((x) => x.name).join(" → "))));
        if (ok) { S.gameDone(lec.id + ":order"); toast("🎉 Nice!"); }
      } }, "Check order"), h("button.btn.alt", { onclick: () => { n++; draw(); } }, "Next puzzle")), fb);
  };
  draw();
}

/* ---- half-life calculator ---- */
function halflife(b, lec) {
  const iso = lec.halflife || [{ name: "Carbon-14", half: 5730, unit: "years" }];
  const sel = h("select", iso.map((x, i) => h("option", { value: i }, `${x.name} (half-life ${span(x.half, x.unit)})`)));
  const n = h("input", { type: "range", min: 0, max: 8, step: 0.5, value: 2 });
  const out = h("div"), vis = h(".row", { style: "gap:4px" });
  const upd = () => {
    const x = iso[sel.value], k = +n.value, frac = Math.pow(0.5, k), age = k * x.half;
    vis.replaceChildren(h(".bar", { style: "flex:1;height:26px" }, h("i", { style: `width:${frac * 100}%;background:var(--brand-2)` })));
    out.replaceChildren(
      h("p", h("b", k + " half-lives"), " have passed = ", h("b", span(age, x.unit))),
      h("p", `Parent left: ${(frac * 100).toFixed(2)}% · Daughter made: ${(100 - frac * 100).toFixed(2)}%`),
      h(".box.why", h("span.t", "💡 Why it works"), "Every half-life, half of the remaining parent atoms decay. It never drops to zero; it just halves again and again. Measure the ratio of parent to daughter, and you can run the clock backwards."));
    S.gameDone(lec.id + ":halflife");
  };
  sel.onchange = n.oninput = upd;
  const rev = h("input", { type: "number", min: 0.01, max: 100, step: 0.01, placeholder: "e.g. 25", style: "max-width:160px" });
  const revOut = h("p");
  rev.oninput = () => {
    const p = +rev.value; if (!(p > 0 && p <= 100)) { revOut.textContent = ""; return; }
    const x = iso[sel.value], k = Math.log2(100 / p), age = k * x.half;
    revOut.replaceChildren("If ", h("b", p + "%"), " of the parent is left, the sample is about ", h("b", span(age, x.unit)), ` old (${k.toFixed(2)} half-lives).`);
  };
  b.append(h("h2", "☢️ Half-life calculator"), h("label", "Isotope"), sel, h("label", "Half-lives passed"), n, vis, out,
    h("h3", { style: "margin-top:18px" }, "Run it backwards: find the age"), h("label", "% of parent isotope still left"), rev, revOut);
  upd();
}
