import { luminance } from './color';
import type { PixelBuffer, RGBA } from './types';

const ALPHA_OPAQUE_MIN = 128;
const REFINE_ITERATIONS = 5;

type Rgb = [number, number, number];

/** 서로 다른 색 하나와 그 색이 나온 횟수 */
interface Entry {
  color: Rgb;
  count: number;
}

/**
 * 불투명 픽셀의 색을 최대 maxColors개로 줄인 팔레트를 만든다. 어두운 색 → 밝은 색 순서.
 *
 * 1. 서로 다른 색을 기준으로 median-cut 한다. 면적이 작아도 별개의 색이면 자기 칸을 갖는다.
 * 2. k-means로 몇 번 다듬어 성격이 다른 무리가 한 칸에 섞이지 않게 한다.
 * 3. 각 무리의 대표색은 평균이 아니라 무리에서 **가장 많이 나온 실제 색**이다(원본에 없는 색을 만들지 않는다).
 */
export function quantize(img: PixelBuffer, maxColors: number): RGBA[] {
  if (!Number.isInteger(maxColors) || maxColors < 1) {
    throw new RangeError(`색 수는 1 이상의 정수여야 해요: ${maxColors}`);
  }

  const entries = collectUnique(img);
  if (entries.length === 0) return [];
  if (entries.length <= maxColors) return sortByBrightness(entries.map(toRgba));

  const boxes = splitUntil(entries, maxColors);
  const clusters = refine(entries, boxes.map(centroid));
  return sortByBrightness(uniqueColors(clusters.filter((c) => c.length > 0).map(representative)));
}

function collectUnique(img: PixelBuffer): Entry[] {
  const found = new Map<number, Entry>();
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3]! < ALPHA_OPAQUE_MIN) continue;
    const r = img.data[i]!;
    const g = img.data[i + 1]!;
    const b = img.data[i + 2]!;
    const key = (r << 16) | (g << 8) | b;
    const entry = found.get(key);
    if (entry) entry.count++;
    else found.set(key, { color: [r, g, b], count: 1 });
  }
  return [...found.values()];
}

function widestChannel(box: Entry[]): { channel: number; range: number } {
  let best = { channel: 0, range: -1 };
  for (let c = 0; c < 3; c++) {
    let min = 255;
    let max = 0;
    for (const e of box) {
      min = Math.min(min, e.color[c]!);
      max = Math.max(max, e.color[c]!);
    }
    if (max - min > best.range) best = { channel: c, range: max - min };
  }
  return best;
}

/** 색 폭이 가장 넓은 상자를 서로 다른 색 개수 기준 가운데에서 나누는 일을 maxColors개가 될 때까지 되풀이한다. */
function splitUntil(entries: Entry[], maxColors: number): Entry[][] {
  const boxes: Entry[][] = [entries];
  while (boxes.length < maxColors) {
    let target = -1;
    let targetRange = 0;
    boxes.forEach((box, i) => {
      const { range } = widestChannel(box);
      if (box.length > 1 && range > targetRange) {
        target = i;
        targetRange = range;
      }
    });
    if (target === -1) break; // 더 나눌 수 있는 상자가 없다

    const box = boxes[target]!;
    const { channel } = widestChannel(box);
    // 같은 값일 때 순서가 흔들리지 않게 나머지 채널로도 비교한다(결정성)
    const sorted = [...box].sort(
      (a, b) =>
        a.color[channel]! - b.color[channel]! ||
        a.color[0] - b.color[0] ||
        a.color[1] - b.color[1] ||
        a.color[2] - b.color[2],
    );
    const mid = Math.floor(sorted.length / 2);
    boxes.splice(target, 1, sorted.slice(0, mid), sorted.slice(mid));
  }
  return boxes;
}

/** 나온 횟수로 가중한 평균색 */
function centroid(box: Entry[]): Rgb {
  let total = 0;
  const sum: Rgb = [0, 0, 0];
  for (const e of box) {
    total += e.count;
    for (let c = 0; c < 3; c++) sum[c] = sum[c]! + e.color[c]! * e.count;
  }
  return [sum[0] / total, sum[1] / total, sum[2] / total];
}

const distanceSq = (a: Rgb, b: Rgb) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;

/** k-means: 모든 색을 가장 가까운 중심에 배정하고 중심을 다시 구하는 일을 몇 번 되풀이한다. */
function refine(entries: Entry[], seeds: Rgb[]): Entry[][] {
  let centers = seeds;
  let clusters: Entry[][] = [];
  for (let iteration = 0; iteration < REFINE_ITERATIONS; iteration++) {
    clusters = centers.map(() => []);
    for (const e of entries) {
      let best = 0;
      let bestDist = Infinity;
      centers.forEach((center, i) => {
        const d = distanceSq(e.color, center);
        if (d < bestDist) {
          best = i;
          bestDist = d;
        }
      });
      clusters[best]!.push(e);
    }
    centers = clusters.map((cluster, i) => (cluster.length > 0 ? centroid(cluster) : centers[i]!));
  }
  return clusters;
}

/**
 * 무리의 대표색: 가장 많이 나온 색의 절반 이상 나온 실제 색들 중, 무리 중심에 가장 가까운 색.
 * - 단색 면(한 색이 압도적)은 그 색이 그대로 대표가 된다.
 * - 질감·잡음처럼 개수 차이가 작으면 가장자리의 색이 뽑히지 않고 중심에 가까운 색이 뽑힌다.
 */
function representative(cluster: Entry[]): RGBA {
  const center = centroid(cluster);
  const maxCount = Math.max(...cluster.map((e) => e.count));
  const best = cluster
    .filter((e) => e.count * 2 >= maxCount)
    .sort(
      (a, b) =>
        distanceSq(a.color, center) - distanceSq(b.color, center) ||
        b.count - a.count ||
        a.color[0] - b.color[0] ||
        a.color[1] - b.color[1] ||
        a.color[2] - b.color[2],
    )[0]!;
  return toRgba(best);
}

const toRgba = (e: Entry): RGBA => [e.color[0], e.color[1], e.color[2], 255];

function uniqueColors(colors: RGBA[]): RGBA[] {
  const seen = new Set<string>();
  return colors.filter((c) => {
    const k = c.join(',');
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function sortByBrightness(colors: RGBA[]): RGBA[] {
  return [...colors].sort(
    (a, b) => luminance(a) - luminance(b) || a[0] - b[0] || a[1] - b[1] || a[2] - b[2],
  );
}
