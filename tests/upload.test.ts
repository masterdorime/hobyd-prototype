import {
  validateImageFile,
  itemImagePath,
  MAX_IMAGE_BYTES,
} from "../lib/upload";

test("accepts jpeg/png/webp within 5MB", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    expect(validateImageFile({ name: "a", type, size: 1024 }).ok).toBe(true);
  }
  expect(MAX_IMAGE_BYTES).toBe(5 * 1024 * 1024);
});

test("rejects bad type and oversize", () => {
  expect(validateImageFile({ name: "a.gif", type: "image/gif", size: 10 }).ok).toBe(false);
  expect(validateImageFile({ name: "", type: "image/png", size: 10 }).ok).toBe(false);
  expect(
    validateImageFile({ name: "big.png", type: "image/png", size: MAX_IMAGE_BYTES + 1 }).ok,
  ).toBe(false);
});

test("itemImagePath nests under room with right ext", () => {
  expect(itemImagePath("room1", "image/jpeg")).toMatch(/^room1\/.+\.jpg$/);
  expect(itemImagePath("room1", "image/png")).toMatch(/\.png$/);
  expect(itemImagePath("room1", "image/webp")).toMatch(/\.webp$/);
});
