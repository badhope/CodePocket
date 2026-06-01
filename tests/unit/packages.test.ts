import { describe, it, expect } from "vitest";
import {
  ECOSYSTEMS,
  renderManifest,
  type PackageEcosystem,
  type PackageRecord,
} from "@/lib/packages";

describe("ecosystem configuration", () => {
  it("all ecosystems have required fields", () => {
    const ecosystems: PackageEcosystem[] = ["npm", "pip", "cargo", "maven", "gem", "go"];
    for (const id of ecosystems) {
      const eco = ECOSYSTEMS[id];
      expect(eco, `ecosystem ${id} missing`).toBeDefined();
      expect(eco.id).toBe(id);
      expect(eco.label.length).toBeGreaterThan(0);
      expect(eco.manifestFile.length).toBeGreaterThan(0);
      expect(eco.installCmd.length).toBeGreaterThan(0);
      expect(eco.placeholder.length).toBeGreaterThan(0);
    }
  });

  it("npm has dev flag", () => {
    expect(ECOSYSTEMS.npm.devFlag).toBe("--save-dev");
  });

  it("pip has no dev flag", () => {
    expect(ECOSYSTEMS.pip.devFlag).toBeUndefined();
  });
});

describe("renderManifest", () => {
  function makePkg(ecosystem: PackageEcosystem, name: string, version?: string, dev = false): PackageRecord {
    return {
      id: `pkg-${name}`,
      projectId: "test-project",
      ecosystem,
      name,
      version: version ?? null,
      dev,
      createdAt: new Date().toISOString(),
    };
  }

  it("renders pip requirements.txt", () => {
    const pkgs = [makePkg("pip", "numpy", "1.24.0"), makePkg("pip", "pandas")];
    const manifest = renderManifest("pip", pkgs);
    expect(manifest).toContain("numpy==1.24.0");
    expect(manifest).toContain("pandas");
  });

  it("renders npm package.json", () => {
    const pkgs = [makePkg("npm", "lodash", "4.17.21"), makePkg("npm", "jest", undefined, true)];
    const manifest = renderManifest("npm", pkgs);
    const parsed = JSON.parse(manifest);
    expect(parsed.dependencies).toBeDefined();
    expect(parsed.dependencies.lodash).toBe("4.17.21");
    expect(parsed.devDependencies.jest).toBe("*");
  });

  it("renders Cargo.toml", () => {
    const pkgs = [makePkg("cargo", "serde", "1.0"), makePkg("cargo", "tokio")];
    const manifest = renderManifest("cargo", pkgs);
    expect(manifest).toContain("[dependencies]");
    expect(manifest).toContain("serde");
    expect(manifest).toContain("tokio");
  });

  it("renders go.mod", () => {
    const pkgs = [makePkg("go", "github.com/gin-gonic/gin", "v1.9.0")];
    const manifest = renderManifest("go", pkgs);
    expect(manifest).toContain("module example.com/project");
    expect(manifest).toContain("github.com/gin-gonic/gin v1.9.0");
  });

  it("renders Gemfile", () => {
    const pkgs = [makePkg("gem", "rails", "7.0.0")];
    const manifest = renderManifest("gem", pkgs);
    expect(manifest).toContain('gem "rails", "7.0.0"');
  });

  it("renders pom.xml (maven)", () => {
    const pkgs = [makePkg("maven", "com.google.guava:guava", "31.0")];
    const manifest = renderManifest("maven", pkgs);
    expect(manifest).toContain("<groupId>com.google.guava</groupId>");
    expect(manifest).toContain("<artifactId>guava</artifactId>");
    expect(manifest).toContain("<version>31.0</version>");
  });

  it("handles empty package list", () => {
    for (const eco of ["pip", "npm", "cargo", "go", "gem", "maven"] as PackageEcosystem[]) {
      const manifest = renderManifest(eco, []);
      expect(manifest.length).toBeGreaterThan(0);
    }
  });

  it("npm with only dev deps still valid JSON", () => {
    const pkgs = [makePkg("npm", "prettier", "3.0.0", true)];
    const manifest = renderManifest("npm", pkgs);
    const parsed = JSON.parse(manifest);
    expect(parsed.devDependencies.prettier).toBe("3.0.0");
  });
});
