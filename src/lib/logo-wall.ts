/**
 * Plans a logo wall for one column count: each logo gets a span of one or two
 * columns so that every row is full, keeping the logos in their given order.
 * Wide logos earn the double cells; `maxWide` caps how many there are.
 * A small dynamic programme — the wall only ever holds a few dozen logos.
 */
export function planSpans(ratios: number[], cols: number, maxWide: number, threshold = 2): (1 | 2)[] {
  const n = ratios.length;
  const memo = new Map<number, number>();
  // Best score from logo i onward, with `fill` columns already used in the current row and `wide` double cells placed.
  const best = (i: number, fill: number, wide: number): number => {
    if (i === n) return fill === 0 ? 0 : -Infinity;
    const key = (i * 64 + fill) * 64 + wide;
    const cached = memo.get(key);
    if (cached !== undefined) return cached;
    let score = best(i + 1, (fill + 1) % cols, wide);
    if (fill + 2 <= cols && wide < maxWide) {
      score = Math.max(score, ratios[i] - threshold + best(i + 1, (fill + 2) % cols, wide + 1));
    }
    memo.set(key, score);
    return score;
  };

  // No complete layout with double cells: every logo takes one column.
  if (best(0, 0, 0) === -Infinity) return ratios.map(() => 1);

  const spans: (1 | 2)[] = [];
  let fill = 0;
  let wide = 0;
  for (let i = 0; i < n; i++) {
    const single = best(i + 1, (fill + 1) % cols, wide);
    const double =
      fill + 2 <= cols && wide < maxWide ? ratios[i] - threshold + best(i + 1, (fill + 2) % cols, wide + 1) : -Infinity;
    if (double > single) {
      spans.push(2);
      fill = (fill + 2) % cols;
      wide++;
    } else {
      spans.push(1);
      fill = (fill + 1) % cols;
    }
  }
  return spans;
}
