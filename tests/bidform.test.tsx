// tests/bidform.test.tsx
import { minBid } from "../components/BidForm";
test("min acceptable bid is current+1", () => {
  expect(minBid(1250000)).toBe(1250001);
});
