import { CHAT_EXPIRE_MS, CHAT_VISIBLE_COUNT } from "../lib/chat";

test("overlay budget keeps layout fixed", () => {
  expect(CHAT_VISIBLE_COUNT).toBeLessThanOrEqual(8);
  expect(CHAT_EXPIRE_MS).toBeGreaterThanOrEqual(4000);
  expect(CHAT_EXPIRE_MS).toBeLessThanOrEqual(6000);
});
