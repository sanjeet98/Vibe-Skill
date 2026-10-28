import type { SourceFile } from "ts-morph";
import { injectReExport } from "./export-reexport-injector.js";

/**
 * Safely and idempotently appends `export * from '<exportPath>';` to an index barrel file.
 * Returns true if the statement was appended, false if it already exists.
 *
 * @param sourceFile - The target SourceFile (e.g. index.ts).
 * @param exportPath - Relative path or module to re-export from (e.g. './module').
 */
export function injectStarExport(
  sourceFile: SourceFile,
  exportPath: string,
): boolean {
  return injectReExport(sourceFile, exportPath).changed;
}
