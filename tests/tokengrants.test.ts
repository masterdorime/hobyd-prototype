// tests/tokengrants.test.ts
import { grantFor } from "../app/api/livekit-token/route";

test("room owner publishes, everyone else subscribes", () => {
  expect(grantFor("user-1", "user-1")).toBe("publisher");
  expect(grantFor("user-2", "user-1")).toBe("subscriber");
  expect(grantFor("user-2", null)).toBe("subscriber");
});
