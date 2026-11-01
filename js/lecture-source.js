const COURSE_FIGURE_LECTURES = new Set(["skeletal", "muscular"]);

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
