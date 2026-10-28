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

export {
  type InstalledSkillRecord,
  type InstalledLockfile,
  type VibeSkillLockfile,
  type AntigravityLockfile,
  getInstalledLockfilePath,
  getLockfilePath,
  loadInstalledSkills,
  loadLockfile,
  recordInstalledSkill,
  recordSkill,
} from "./lockfile.js";

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
