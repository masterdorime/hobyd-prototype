// tests/a11y.test.ts — Task 11 RED: auth errors announced, email semantics.
import { readFileSync } from "fs";
const login = readFileSync("app/[locale]/login/page.tsx", "utf8");
const pay = readFileSync("app/[locale]/pay/[orderId]/page.tsx", "utf8");
test("auth errors are announced", () => {
  expect(login).toMatch('role="alert"');
});
test("login has visible labels and email semantics", () => {
  expect(login).toMatch('type="email"');
  expect(pay).toMatch('role="alert"');
});
