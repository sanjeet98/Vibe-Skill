import type { SourceFile } from "ts-morph";

export interface ExportInjectionResult {
  changed: boolean;
}

/**
 * Safely and idempotently appends `export * from './module'` to an index barrel file.
 *
 * @param sourceFile - The ts-morph SourceFile representing the barrel (e.g. index.ts).
 * @param moduleSpecifier - The relative or package module specifier (e.g. './auth').
 */
export function injectReExport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
): ExportInjectionResult {
  const cleanSpecifier = moduleSpecifier.trim();

  // Check if export * from 'moduleSpecifier' already exists
  const existingExport = sourceFile.getExportDeclarations().find((decl) => {
    return (
      decl.getModuleSpecifierValue() === cleanSpecifier &&
      !decl.hasNamedExports() &&
      !decl.isTypeOnly()
    );
  });

  if (existingExport) {
    return { changed: false };
  }

  // Append new export declaration
  sourceFile.addExportDeclaration({
    moduleSpecifier: cleanSpecifier,
  });

  return { changed: true };
}

/**
 * Safely and idempotently injects a named export re-export: `export { name } from 'module'`
 *
 * @param sourceFile - The target SourceFile.
 * @param moduleSpecifier - The module to export from.
 * @param exportName - The identifier name to export.
 */
export function injectNamedExport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  exportName: string,
): ExportInjectionResult {
  const cleanSpecifier = moduleSpecifier.trim();

  const existingDecl = sourceFile
    .getExportDeclarations()
    .find((decl) => decl.getModuleSpecifierValue() === cleanSpecifier);

  if (existingDecl) {
    const namedExports = existingDecl.getNamedExports();
    const alreadyExported = namedExports.some(
      (exp) => exp.getName() === exportName,
    );

    if (alreadyExported) {
      return { changed: false };
    }

    existingDecl.addNamedExport({
      name: exportName,
    });

    return { changed: true };
  }

  sourceFile.addExportDeclaration({
    moduleSpecifier: cleanSpecifier,
    namedExports: [{ name: exportName }],
  });

  return { changed: true };
}
