import { expect, it } from "vitest";

it("deliberately demonstrates a failing CI check", () => {
  expect(true).toBe(false);
});
