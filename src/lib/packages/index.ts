export type PackageEcosystem = "npm" | "pip" | "cargo" | "maven" | "gem" | "go";

export interface PackageRecord {
  id: string;
  projectId: string;
  ecosystem: PackageEcosystem;
  name: string;
  version: string | null;
  dev: boolean;
  createdAt: string;
}

export interface EcosystemConfig {
  id: PackageEcosystem;
  label: string;
  manifestFile: string;
  installCmd: string;
  devFlag?: string;
  placeholder: string;
}

export const ECOSYSTEMS: Record<PackageEcosystem, EcosystemConfig> = {
  npm: {
    id: "npm",
    label: "npm",
    manifestFile: "package.json",
    installCmd: "npm install",
    devFlag: "--save-dev",
    placeholder: "lodash, react, @types/node",
  },
  pip: {
    id: "pip",
    label: "pip",
    manifestFile: "requirements.txt",
    installCmd: "pip install",
    placeholder: "requests, numpy, pandas",
  },
  cargo: {
    id: "cargo",
    label: "Cargo",
    manifestFile: "Cargo.toml",
    installCmd: "cargo add",
    devFlag: "--dev",
    placeholder: "serde, tokio, anyhow",
  },
  maven: {
    id: "maven",
    label: "Maven",
    manifestFile: "pom.xml",
    installCmd: "mvn install",
    placeholder: "com.google.guava:guava",
  },
  gem: {
    id: "gem",
    label: "RubyGems",
    manifestFile: "Gemfile",
    installCmd: "bundle add",
    placeholder: "rails, sinatra",
  },
  go: {
    id: "go",
    label: "Go modules",
    manifestFile: "go.mod",
    installCmd: "go get",
    placeholder: "github.com/gin-gonic/gin",
  },
};

export function renderManifest(ecosystem: PackageEcosystem, pkgs: PackageRecord[]): string {
  switch (ecosystem) {
    case "npm": {
      const deps: Record<string, string> = {};
      const devDeps: Record<string, string> = {};
      for (const p of pkgs) {
        (p.dev ? devDeps : deps)[p.name] = p.version ?? "*";
      }
      const json = {
        name: "project",
        version: "1.0.0",
        ...(Object.keys(deps).length > 0 ? { dependencies: deps } : {}),
        ...(Object.keys(devDeps).length > 0 ? { devDependencies: devDeps } : {}),
      };
      return JSON.stringify(json, null, 2);
    }
    case "pip": {
      return pkgs.map((p) => `${p.name}${p.version ? `==${p.version}` : ""}`).join("\n") + "\n";
    }
    case "cargo": {
      const lines = ["[package]", 'name = "project"', 'version = "0.1.0"', "edition = \"2021\"", ""];
      const deps: string[] = [];
      const devDeps: string[] = [];
      for (const p of pkgs) {
        const v = p.version ? `\"${p.version}\"` : "\"*\"";
        if (p.dev) devDeps.push(`${p.name} = { version = ${v} }`);
        else deps.push(`${p.name} = { version = ${v} }`);
      }
      if (deps.length > 0) lines.push("[dependencies]", ...deps, "");
      if (devDeps.length > 0) lines.push("[dev-dependencies]", ...devDeps, "");
      return lines.join("\n");
    }
    case "maven": {
      const deps = pkgs
        .map((p) => {
          if (p.version) {
            return `    <dependency><groupId>${p.name.split(":")[0] ?? p.name}</groupId><artifactId>${p.name.split(":")[1] ?? p.name}</artifactId><version>${p.version}</version></dependency>`;
          }
          return `    <dependency><groupId>${p.name}</groupId></dependency>`;
        })
        .join("\n");
      return `<?xml version="1.0"?>\n<project xmlns="http://maven.apache.org/POM/4.0.0">\n  <modelVersion>4.0.0</modelVersion>\n  <groupId>com.example</groupId>\n  <artifactId>project</artifactId>\n  <version>1.0.0</version>\n  <dependencies>\n${deps}\n  </dependencies>\n</project>\n`;
    }
    case "gem": {
      return pkgs.map((p) => `gem "${p.name}"${p.version ? `, \"${p.version}\"` : ""}`).join("\n") + "\n";
    }
    case "go": {
      return `module example.com/project\n\ngo 1.23\n\nrequire (\n${pkgs.map((p) => `	${p.name}${p.version ? ` ${p.version}` : ""}`).join("\n")}\n)\n`;
    }
  }
}
