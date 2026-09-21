// tests/tokengrants.test.ts
import { grantFor } from "../app/api/livekit-token/route";
process.env.SELLER_ALLOWLIST = "seller@hobyd.id";
test("seller publishes, bidder subscribes", () => {
  expect(grantFor("seller@hobyd.id", ["seller@hobyd.id"])).toBe("publisher");
  expect(grantFor("fan@x.id", ["seller@hobyd.id"])).toBe("subscriber");
});
