const GEOLOGY_FIGURES = {
  interior: {
    title: "A layered planet",
    caption: "Earth's outer shell is thin above a thick mantle and a dense, iron-rich core.",
    nodes: [["crust", "Crust", "Thin, rigid surface"], ["mantle", "Mantle", "Hot, slowly flowing rock"], ["core", "Core", "Dense metallic center"]],
  },
  plates: {
    title: "Three ways plates meet",
    caption: "Plates move apart, move together, or slide past one another.",
    nodes: [["rift", "Divergent", "Move apart"], ["collision", "Convergent", "Move together"], ["fault", "Transform", "Slide past"]],
  },
  minerals: {
    title: "Identify a mineral",
    caption: "Combine observable properties instead of relying on color alone.",
    nodes: [["crystal", "Observe", "Luster and shape"], ["scratch", "Test", "Hardness and streak"], ["cleavage", "Compare", "Breakage pattern"]],
  },
  igneous: {
    title: "Cooling leaves a texture",
    caption: "Slow cooling underground allows larger crystals; rapid cooling makes smaller crystals.",
    nodes: [["magma", "Magma", "Molten rock"], ["cooling", "Cooling", "Slow or fast"], ["crystal", "Texture", "Crystal size"]],
  },
  eruptions: {
    title: "Why eruptions differ",
    caption: "Viscous magma can trap gas; pressure builds until gas and magma escape.",
    nodes: [["magma", "Magma", "Viscosity matters"], ["gas", "Gas builds", "Pressure rises"], ["volcano", "Eruption", "Style varies"]],
  },
  sedimentary: {
    title: "From rock to sediment",
    caption: "Weathering makes particles; transport moves them; deposition begins a new layer.",
    nodes: [["weather", "Weathering", "Breaks rock down"], ["transport", "Transport", "Moves particles"], ["layers", "Deposition", "Particles settle"]],
  },
  metamorphism: {
    title: "Changing rock without melting",
    caption: "Heat, pressure, and fluids reorganize minerals while the rock remains solid.",
    nodes: [["heat", "Heat", "Raises temperature"], ["pressure", "Pressure", "Changes conditions"], ["crystal", "New minerals", "Rock stays solid"]],
  },
  stratigraphy: {
    title: "Read relative time",
    caption: "Layer order and cross-cutting features reveal which events happened first.",
    nodes: [["layers", "Layering", "Lower is older"], ["fault", "Cross-cutting", "Feature is younger"], ["timeline", "Order events", "Build a sequence"]],
  },
  fossils: {
    title: "How a fossil can form",
    caption: "Rapid burial protects remains while minerals or sediment preserve evidence of past life.",
    nodes: [["fossil", "Burial", "Remains are covered"], ["layers", "Preservation", "Evidence is protected"], ["fossil", "Discovery", "Fossil is exposed"]],
  },
  biography: {
    title: "Earth's history spans deep time",
    caption: "The planet's history includes early crust, changing oceans and atmosphere, and evolving life.",
    nodes: [["earth", "Early Earth", "A changing planet"], ["layers", "Changing surface", "Crust and oceans"], ["timeline", "Life evolves", "Across deep time"]],
  },
  deformation: {
    title: "Stress changes rock",
    caption: "Rock may bend slowly or break, depending on conditions such as temperature and strain rate.",
    nodes: [["pressure", "Stress", "Force on rock"], ["fold", "Bend", "Ductile response"], ["fault", "Break", "Brittle response"]],
  },
  massmovement: {
    title: "A slope can fail",
    caption: "Gravity pulls material downhill; water, steepness, and weak layers can reduce stability.",
    nodes: [["slope", "Unstable slope", "Gravity acts"], ["water", "Weakening", "Water can add weight"], ["slide", "Movement", "Material moves downhill"]],
  },
  earthquakes: {
    title: "A fault releases stored strain",
    caption: "When a locked fault slips, seismic energy travels outward as waves.",
    nodes: [["fault", "Locked fault", "Strain builds"], ["rupture", "Rupture", "Fault slips"], ["wave", "Seismic waves", "Energy travels"]],
  },
};

const deckImage = (src, id) => typeof src === "string"
  && (src.startsWith(`img/${id}/`) || src.startsWith("img/geology/"));

function cleanText(text) {
  const kept = text.split(/(?<=[.!?])\s+/).filter((part) => !/\bslides?\b/i.test(part));
  const clean = kept.join(" ").replace(/\s{2,}/g, " ").trim();
  return clean || null;
}

export function stripInstructorDeck(id, value) {
  const isDeckFigure = (image) => image && (image.slide || deckImage(image.src, id));
  const visit = (item, key = "") => {
    if (typeof item === "string") return key === "id" ? item : cleanText(item);
    if (Array.isArray(item)) return item.map((child) => visit(child, key)).filter((child) => child !== null);
    if (!item || typeof item !== "object") return item;
    if (deckImage(item.src, id)) return null;

    const emptyDeckStep = key === "steps"
      && (isDeckFigure(item.img) || (item.figures || []).some((figure) => isDeckFigure(figure.img)))
      && !(item.bullets || []).length;
    const clean = {};
    for (const [childKey, child] of Object.entries(item)) {
      if (["slide", "slides", "slideFile", "sourceNotes"].includes(childKey)) continue;
      const next = visit(child, childKey);
      if (next !== null) clean[childKey] = next;
    }
    if (emptyDeckStep) return null;
    return clean;
  };
  return visit(value);
}

export function geologyVisual(id) {
  const figure = GEOLOGY_FIGURES[id];
  if (!figure) return "";
  const element = (tag, className = "", text = "") => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  };
  const diagram = element("div", "geo-diagram");
  diagram.setAttribute("aria-hidden", "true");
  diagram.append(element("span", "geo-track"), element("span", "geo-traveler"));
  for (const [shape, title, detail] of figure.nodes) {
    const node = element("div", "geo-node");
    node.append(element("span", `geo-symbol ${shape}`), element("strong", "", title), element("small", "", detail));
    diagram.append(node);
  }
  const caption = element("figcaption");
  caption.append(element("strong", "", figure.title), element("span", "", figure.caption));
  const result = element("figure", "geo-visual");
  result.setAttribute("aria-label", `${figure.title}. ${figure.caption}`);
  result.append(diagram, caption);
  return result;
}

export const geologyVisualIds = Object.keys(GEOLOGY_FIGURES);
