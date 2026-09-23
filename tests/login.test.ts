// tests/login.test.ts

import { isEmailNotConfirmed, loginTarget } from "../app/[locale]/login/page";
import id from "../messages/id.json";
import en from "../messages/en.json";
test("login lands back on lobby", () => {
  expect(loginTarget("id")).toBe("/id");
  expect(loginTarget("en")).toBe("/en");
});
test("login keys exist in both locales", () => {
  for (const k of ["login", "email", "password", "signin", "signup", "verifyEmail", "emailNotConfirmed", "resendEmail", "resendSent"]) {
    expect(id).toHaveProperty(k);
    expect(en).toHaveProperty(k);
  }
});
test("detects unverified-email sign-in errors", () => {
  expect(isEmailNotConfirmed("Email not confirmed")).toBe(true);
  expect(isEmailNotConfirmed("Invalid login credentials")).toBe(false);
});