import { toErrorMessage } from "../app/[locale]/login/page";

test("Error objects surface their message", () => {
  expect(toErrorMessage(new Error("Missing env X"))).toBe("Missing env X");
});

test("non-Error values degrade to readable text", () => {
  expect(toErrorMessage("oops")).toBe("oops");
  expect(toErrorMessage(null)).toBe("Unknown error");
});
