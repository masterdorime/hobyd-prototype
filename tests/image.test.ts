import { cropRect } from "../lib/image";

test("cropRect passes through near-16:9", () => {
  expect(cropRect(1600, 900)).toEqual({ sx: 0, sy: 0, sw: 1600, sh: 900 });
  expect(cropRect(1605, 900)).toEqual({ sx: 0, sy: 0, sw: 1605, sh: 900 });
});

test("cropRect trims sides of wide photos", () => {
  expect(cropRect(2000, 900)).toEqual({ sx: 200, sy: 0, sw: 1600, sh: 900 });
});

test("cropRect trims top/bottom of tall photos", () => {
  expect(cropRect(900, 1600)).toEqual({ sx: 0, sy: 547, sw: 900, sh: 506 });
});

test("cropRect output is always 16:9", () => {
  for (const [w, h] of [[4000, 3000], [1080, 1920], [800, 800], [1920, 1080]] as const) {
    const r = cropRect(w, h);
    expect(Math.abs(r.sw / r.sh - 16 / 9)).toBeLessThan(0.01);
    expect(r.sx).toBeGreaterThanOrEqual(0);
    expect(r.sy).toBeGreaterThanOrEqual(0);
    expect(r.sx + r.sw).toBeLessThanOrEqual(w);
    expect(r.sy + r.sh).toBeLessThanOrEqual(h);
  }
});
