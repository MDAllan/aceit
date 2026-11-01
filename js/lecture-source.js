const COURSE_FIGURE_LECTURES = new Set(["skeletal", "muscular"]);
const FIGURE_STOP_WORDS = new Set(["a", "an", "and", "are", "as", "at", "by", "for", "from", "in", "into", "of", "on", "or", "the", "to", "with"]);
const SVG_SOURCE = /(?:\.svg(?:[?#].*)?|^data:image\/svg\+xml)/i;

function isSvgImage(value) {
  return !!value && typeof value === "object" && typeof value.src === "string" && SVG_SOURCE.test(value.src);
}

export function stripSvgFigures(value) {
  if (Array.isArray(value)) return value.map(stripSvgFigures).filter((item) => item !== null);
  if (!value || typeof value !== "object") return value;
  if (isSvgImage(value)) return null;
  if (isSvgImage(value.img) && !(value.bullets || []).length && Object.keys(value).every((key) => ["img", "title", "bullets"].includes(key))) return null;
  const clean = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "img" && isSvgImage(item)) continue;
    clean[key] = stripSvgFigures(item);
  }
  return clean;
}

function stepText(step) {
  return [step.title, ...(step.bullets || [])].join(" ").toLowerCase();
}

function words(value) {
  return value.match(/[a-z0-9]+/g)
    ?.map((word) => word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word)
    .filter((word) => word.length > 2 && !FIGURE_STOP_WORDS.has(word)) || [];
}

export function inlineCourseFigures(id, sourceSteps) {
  if (!COURSE_FIGURE_LECTURES.has(id)) return sourceSteps;
  const steps = sourceSteps || [];
  const narrative = steps.filter((step) => !step.img || (step.bullets || []).length).map((step) => ({
    ...step,
    figures: [...(step.figures || []), ...(step.img ? [{ img: step.img, title: step.title }] : [])],
  }));
  const figureSteps = steps.filter((step) => step.img && !(step.bullets || []).length);
  if (!narrative.length || !figureSteps.length) return steps;

  const stepWords = narrative.map((step) => new Set(words(stepText(step))));
  const loads = narrative.map(() => 0);
  for (let figureIndex = 0; figureIndex < figureSteps.length; figureIndex++) {
    const figure = figureSteps[figureIndex];
    const figureWords = words(figure.title);
    const scores = stepWords.map((set) => figureWords.reduce((score, word) => score + (set.has(word) ? 1 : 0), 0));
    const bestScore = Math.max(...scores);
    let target = -1;
    for (let i = 0; i < scores.length; i++) {
      if (scores[i] !== bestScore) continue;
      if (target < 0 || loads[i] < loads[target]) target = i;
    }
    if (bestScore === 0) target = Math.floor(figureIndex * narrative.length / figureSteps.length);
    narrative[target].figures.push({ img: figure.img, title: figure.title });
    loads[target]++;
  }
  return narrative;
}

function figureSources(lecture) {
  const sources = [];
  for (const section of lecture?.sections || []) {
    for (const image of section.images || []) {
      if (image?.src) sources.push(`src:${image.src}`);
      else if (image?.path) sources.push(`path:${image.bucket || ""}:${image.path}`);
    }
    for (const step of section.steps || []) {
      const image = step.img;
      if (image?.src) sources.push(`src:${image.src}`);
      else if (image?.path) sources.push(`path:${image.bucket || ""}:${image.path}`);
    }
  }
  for (const image of lecture?.images || []) {
    if (image?.src) sources.push(`src:${image.src}`);
    else if (image?.path) sources.push(`path:${image.bucket || ""}:${image.path}`);
  }
  return [...new Set(sources)].sort();
}

export function needsPublishedFigures(id, saved, published) {
  if (!COURSE_FIGURE_LECTURES.has(id) || !saved || !published) return false;
  const expected = figureSources(published);
  return expected.length > 0 && JSON.stringify(figureSources(saved)) !== JSON.stringify(expected);
}
