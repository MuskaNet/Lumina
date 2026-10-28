import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "./nav";
import { router } from "./router";

describe("routing rules navigation", () => {
  it("exposes a Vue route for the upstream routing rules feature", () => {
    expect(ADMIN_NAV.some((item) => item.id === "routing-rules")).toBe(true);
    expect(router.resolve("/admin/repository/routingrules").name).toBe("routing-rules");
  });
});
