import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/services/password";

describe("password service", () => {
  it("hashes passwords and verifies only the original password", async () => {
    const hash = await hashPassword("very-secure-password");

    expect(hash).not.toContain("very-secure-password");
    expect(await verifyPassword("very-secure-password", hash)).toBe(true);
    expect(await verifyPassword("wrong-password", hash)).toBe(false);
  });
});
