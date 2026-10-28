import * as fs from "node:fs";
import * as path from "node:path";
import type { ASTInjection } from "@vibe-skill/manifest";
import * as prettier from "prettier";
import { Project, ts } from "ts-morph";
import {
  injectImport,
  injectJsxWrapper,
  injectMiddlewareStep,
  injectNamedExport,
  injectReExport,
} from "./transformers/index.js";

export interface ReExportInjection {
  type: "re_export";
  targetFile: string;
  module: string;
}

export type SkillInjection = ASTInjection | ReExportInjection;

export interface FileMutation {
  filePath: string;
  originalContent: string;
  modifiedContent: string;
  hasChanged: boolean;
}

export interface InjectionOptions {
  dryRun?: boolean;
  prettierConfig?: prettier.Options;
  prettierOptions?: prettier.Options;
}

export type ApplyInjectionsOptions = InjectionOptions;

export interface InjectionResult {
  success: boolean;
  modifiedFiles: string[];
  skippedFiles: string[];
  errors: string[];
  mutatedFiles: FileMutation[];
  dryRun: boolean;
}

interface FileBackup {
  existed: boolean;
  content: string | null;
}

/**
 * Validates that a source file does not have fatal TypeScript/JSX syntax errors.
 * Ignores semantic/type-checking errors (missing packages, missing types).
 */
export function validateSourceFileSyntax(
  sourceFile: import("ts-morph").SourceFile,
): string[] {
  const diagnostics = sourceFile.getPreEmitDiagnostics();
  const syntaxErrors: string[] = [];

  for (const diag of diagnostics) {
    const code = diag.getCode();
    // Codes 1000-1999: Core TypeScript syntax/parse errors
    // Codes 17000-17999: JSX syntax/parse errors (e.g. 17008: unclosed tag)
    if ((code >= 1000 && code < 2000) || (code >= 17000 && code < 18000)) {
      const msg = diag.getMessageText();
      const message = typeof msg === "string" ? msg : msg.getMessageText();
      syntaxErrors.push(
        `[TS${code}] Line ${diag.getLineNumber() || 0}: ${message}`,
      );
    }
  }

  return syntaxErrors;
}

/**
 * Orchestrator engine executing AST injections on TypeScript / TSX files.
 */
export class AstEngine {
  constructor(private readonly defaultOptions: InjectionOptions = {}) {}

  async apply(
    projectRoot: string,
    injections: SkillInjection[],
    options?: InjectionOptions,
  ): Promise<InjectionResult> {
    return applySkillInjections(projectRoot, injections, {
      ...this.defaultOptions,
      ...options,
    });
  }
}

export const ASTEngine = AstEngine;

/**
 * Applies a list of AST injections across target files in a project.
 *
 * Guarantees:
 * - Deterministic, syntax-safe code mutations using ts-morph.
 * - Automatic Prettier code formatting before saving.
 * - Idempotency (repeated runs produce no redundant changes).
 * - Rollback mechanism: if any injection or syntax check fails, all touched files are restored.
 * - Dry-run mode: returns the computed mutations without writing to disk.
 */
export async function applySkillInjections(
  projectRoot: string,
  injections: SkillInjection[],
  options?: InjectionOptions,
): Promise<InjectionResult> {
  const isDryRun = Boolean(options?.dryRun);
  const backups = new Map<string, FileBackup>();
  const resolvedRoot = path.resolve(projectRoot);

  try {
    // 1. Gather all unique target files and create backups
    for (const injection of injections) {
      const fullPath = path.isAbsolute(injection.targetFile)
        ? injection.targetFile
        : path.resolve(resolvedRoot, injection.targetFile);

      if (!backups.has(fullPath)) {
        const fileExists = fs.existsSync(fullPath);
        const originalContent = fileExists
          ? fs.readFileSync(fullPath, "utf8")
          : null;
        backups.set(fullPath, {
          existed: fileExists,
          content: originalContent,
        });
      }
    }

    // 2. Initialize ts-morph project
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        allowJs: true,
      },
    });

    // Populate project with target files
    for (const [fullPath, backup] of backups.entries()) {
      if (backup.existed && backup.content !== null) {
        project.createSourceFile(fullPath, backup.content, { overwrite: true });
      } else {
        project.createSourceFile(fullPath, "", { overwrite: true });
      }
    }

    // 3. Sequentially apply transformers for each injection
    for (const injection of injections) {
      const fullPath = path.isAbsolute(injection.targetFile)
        ? injection.targetFile
        : path.resolve(resolvedRoot, injection.targetFile);

      const sourceFile = project.getSourceFile(fullPath);
      if (!sourceFile) {
        throw new Error(
          `Failed to load source file in AST project: ${fullPath}`,
        );
      }

      switch (injection.type) {
        case "jsx_wrapper": {
          // 3a. Inject import
          injectImport(
            sourceFile,
            injection.import.module,
            injection.import.identifier,
          );
          // 3b. Wrap JSX
          injectJsxWrapper(sourceFile, injection.wrapperComponent);
          break;
        }

        case "named_export": {
          injectNamedExport(sourceFile, injection.module, injection.exportName);
          break;
        }

        case "middleware_chain": {
          injectImport(
            sourceFile,
            injection.import.module,
            injection.import.identifier,
          );
          injectMiddlewareStep(sourceFile, injection.pipelineStep);
          break;
        }

        case "re_export": {
          injectReExport(sourceFile, injection.module);
          break;
        }

        default: {
          const exhaustiveCheck: never = injection;
          throw new Error(
            `Unsupported injection type: ${(exhaustiveCheck as { type: string }).type}`,
          );
        }
      }
    }

    // 4. Validate syntax and format mutated files
    const mutations: FileMutation[] = [];

    for (const [fullPath, backup] of backups.entries()) {
      const sourceFile = project.getSourceFile(fullPath);
      if (!sourceFile) continue;

      // 4a. Syntax check
      const syntaxErrors = validateSourceFileSyntax(sourceFile);
      if (syntaxErrors.length > 0) {
        throw new Error(
          `Syntax validation error in ${path.relative(resolvedRoot, fullPath)}:\n${syntaxErrors.join("\n")}`,
        );
      }

      // 4b. Prettier format
      let formattedText = sourceFile.getFullText();
      try {
        const isTypeScript =
          fullPath.endsWith(".ts") || fullPath.endsWith(".tsx");
        formattedText = await prettier.format(formattedText, {
          filepath: fullPath,
          parser: isTypeScript ? "typescript" : undefined,
          singleQuote: true,
          ...options?.prettierConfig,
          ...options?.prettierOptions,
        });
      } catch (prettierError) {
        throw new Error(
          `Prettier formatting failed for ${path.relative(resolvedRoot, fullPath)}: ${(prettierError as Error).message}`,
        );
      }

      const original = backup.content || "";
      const hasChanged = formattedText.trim() !== original.trim();

      mutations.push({
        filePath: fullPath,
        originalContent: original,
        modifiedContent: formattedText,
        hasChanged,
      });
    }

    // 5. Commit to disk if not dry-run
    if (!isDryRun) {
      for (const mutation of mutations) {
        if (mutation.hasChanged) {
          fs.mkdirSync(path.dirname(mutation.filePath), { recursive: true });
          fs.writeFileSync(mutation.filePath, mutation.modifiedContent, "utf8");
        }
      }
    }

    const modifiedFiles = mutations
      .filter((m) => m.hasChanged)
      .map((m) => m.filePath);

    const skippedFiles = mutations
      .filter((m) => !m.hasChanged)
      .map((m) => m.filePath);

    return {
      success: true,
      modifiedFiles,
      skippedFiles,
      mutatedFiles: mutations,
      errors: [],
      dryRun: isDryRun,
    };
  } catch (error) {
    // 6. Rollback guardrails: Restore all files to their pristine original state
    for (const [fullPath, backup] of backups.entries()) {
      try {
        if (backup.existed && backup.content !== null) {
          fs.writeFileSync(fullPath, backup.content, "utf8");
        } else if (!backup.existed && fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch {
        // Suppress secondary rollback errors to preserve root cause
      }
    }

    return {
      success: false,
      modifiedFiles: [],
      skippedFiles: [],
      mutatedFiles: [],
      errors: [(error as Error).message],
      dryRun: isDryRun,
    };
  }
}

export const applyInjections = applySkillInjections;
