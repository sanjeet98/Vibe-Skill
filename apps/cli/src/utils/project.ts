import * as fs from "node:fs";
import * as path from "node:path";

export interface ProjectInfo {
  root: string;
  hasPackageJson: boolean;
  packageName?: string;
  packageVersion?: string;
  framework: "nextjs" | "vite" | "remix" | "fastapi" | "unknown";
  language: "typescript" | "python" | "javascript";
  router: "app-router" | "pages" | null;
  hasGit: boolean;
  packageManager: "pnpm" | "npm" | "yarn" | "bun";
}

export interface InstalledSkillRecord {
  id: string;
  name: string;
  version: string;
  installedAt: string;
  source: string;
  injectionsCount: number;
}

export interface InstalledLockfile {
  schemaVersion: string;
  installedSkills: Record<string, InstalledSkillRecord>;
}

/**
 * Detects project configuration, framework, language, and router in target directory.
 */
export function detectProject(targetDir: string = process.cwd()): ProjectInfo {
  const root = path.resolve(targetDir);
  const pkgJsonPath = path.join(root, "package.json");
  const hasPackageJson = fs.existsSync(pkgJsonPath);

  let packageName: string | undefined;
  let packageVersion: string | undefined;
  let allDependencies: Record<string, string> = {};

  if (hasPackageJson) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      packageName = pkg.name;
      packageVersion = pkg.version;
      allDependencies = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
    } catch {
      // Ignore malformed package.json
    }
  }

  // Detect Framework
  let framework: ProjectInfo["framework"] = "unknown";
  if (allDependencies["next"]) {
    framework = "nextjs";
  } else if (allDependencies["vite"]) {
    framework = "vite";
  } else if (
    allDependencies["@remix-run/react"] ||
    allDependencies["@remix-run/node"]
  ) {
    framework = "remix";
  } else if (
    fs.existsSync(path.join(root, "requirements.txt")) ||
    fs.existsSync(path.join(root, "pyproject.toml"))
  ) {
    framework = "fastapi";
  }

  // Detect Language
  let language: ProjectInfo["language"] = "javascript";
  if (
    fs.existsSync(path.join(root, "tsconfig.json")) ||
    allDependencies["typescript"]
  ) {
    language = "typescript";
  } else if (framework === "fastapi") {
    language = "python";
  }

  // Detect Router (for Next.js)
  let router: ProjectInfo["router"] = null;
  if (framework === "nextjs") {
    const hasAppRouter =
      fs.existsSync(path.join(root, "app")) ||
      fs.existsSync(path.join(root, "src/app"));
    const hasPagesRouter =
      fs.existsSync(path.join(root, "pages")) ||
      fs.existsSync(path.join(root, "src/pages"));

    if (hasAppRouter) {
      router = "app-router";
    } else if (hasPagesRouter) {
      router = "pages";
    }
  }

  // Detect Git
  const hasGit = fs.existsSync(path.join(root, ".git"));

  // Detect Package Manager
  let packageManager: ProjectInfo["packageManager"] = "npm";
  if (fs.existsSync(path.join(root, "pnpm-lock.yaml"))) {
    packageManager = "pnpm";
  } else if (fs.existsSync(path.join(root, "yarn.lock"))) {
    packageManager = "yarn";
  } else if (
    fs.existsSync(path.join(root, "bun.lockb")) ||
    fs.existsSync(path.join(root, "bun.lock"))
  ) {
    packageManager = "bun";
  }

  return {
    root,
    hasPackageJson,
    packageName,
    packageVersion,
    framework,
    language,
    router,
    hasGit,
    packageManager,
  };
}

/**
 * Returns path to `.vibe-skill/installed.json`.
 */
export function getInstalledLockfilePath(projectRoot: string): string {
  return path.join(projectRoot, ".vibe-skill", "installed.json");
}

/**
 * Loads the installed skills lockfile, or returns empty state.
 */
export function loadInstalledSkills(projectRoot: string): InstalledLockfile {
  const filePath = getInstalledLockfilePath(projectRoot);
  if (!fs.existsSync(filePath)) {
    return {
      schemaVersion: "1.0.0",
      installedSkills: {},
    };
  }

  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return {
      schemaVersion: data.schemaVersion || "1.0.0",
      installedSkills: data.installedSkills || {},
    };
  } catch {
    return {
      schemaVersion: "1.0.0",
      installedSkills: {},
    };
  }
}

/**
 * Saves a skill record to the installed skills lockfile.
 */
export function recordInstalledSkill(
  projectRoot: string,
  record: InstalledSkillRecord,
): void {
  const lockfile = loadInstalledSkills(projectRoot);
  lockfile.installedSkills[record.id] = record;

  const targetPath = getInstalledLockfilePath(projectRoot);
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(lockfile, null, 2), "utf8");
}
