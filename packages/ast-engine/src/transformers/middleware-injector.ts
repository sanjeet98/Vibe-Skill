import { Node, type SourceFile } from "ts-morph";

export interface MiddlewareInjectionResult {
  changed: boolean;
}

/**
 * Injects a middleware step or pipeline invocation into target middleware file (e.g. middleware.ts).
 */
export function injectMiddlewareStep(
  sourceFile: SourceFile,
  pipelineStep: string,
): MiddlewareInjectionResult {
  const cleanStep = pipelineStep.trim();

  // Check if pipelineStep is already present in the file
  const fullText = sourceFile.getFullText();
  if (fullText.includes(cleanStep)) {
    return { changed: false };
  }

  // Check for existing export default
  const exportAssignment = sourceFile
    .getExportAssignments()
    .find((exp) => !exp.isExportEquals());

  if (exportAssignment) {
    const expr = exportAssignment.getExpression();
    if (expr.getText().includes(cleanStep)) {
      return { changed: false };
    }
    // If an existing export default exists (e.g. export default clerkMiddleware()), leave it or wrap
    return { changed: false };
  }

  // If no export default exists, check functions
  const defaultFunc = sourceFile
    .getFunctions()
    .find((fn) => fn.isDefaultExport());
  if (defaultFunc) {
    if (defaultFunc.getText().includes(cleanStep)) {
      return { changed: false };
    }
    return { changed: false };
  }

  // Append export default pipelineStep
  sourceFile.addStatements(`\nexport default ${cleanStep};\n`);
  return { changed: true };
}
