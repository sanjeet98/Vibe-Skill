import { Node, type SourceFile } from "ts-morph";

export interface ImportInjectionResult {
  changed: boolean;
  isNewImport: boolean;
}

/**
 * Determines the ideal statement index to insert a new import declaration.
 * Preserves top-of-file directives (e.g. 'use client', 'use server') and comments.
 */
export function findImportInsertIndex(sourceFile: SourceFile): number {
  const statements = sourceFile.getStatements();
  if (statements.length === 0) {
    return 0;
  }

  // 1. If import declarations already exist, insert after the last import
  const imports = sourceFile.getImportDeclarations();
  if (imports.length > 0) {
    const lastImport = imports[imports.length - 1];
    return lastImport.getChildIndex() + 1;
  }

  // 2. If no imports exist, check for leading directives like 'use client' or 'use server'
  let insertIndex = 0;
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (Node.isExpressionStatement(stmt)) {
      const expr = stmt.getExpression();
      if (
        Node.isStringLiteral(expr) &&
        (expr.getLiteralText() === "use client" ||
          expr.getLiteralText() === "use server")
      ) {
        insertIndex = i + 1;
        continue;
      }
    }
    // Stop at the first non-directive statement
    break;
  }

  return insertIndex;
}

/**
 * Injects a named import from a module into a source file cleanly and idempotently.
 *
 * - If the module import exists and already imports the identifier: does nothing ({ changed: false }).
 * - If the module import exists but lacks the identifier: appends the named import ({ changed: true }).
 * - If the module import does not exist: creates a new import statement at the top ({ changed: true }).
 */
export function injectImport(
  sourceFile: SourceFile,
  moduleSpecifier: string,
  identifier: string,
): ImportInjectionResult {
  // Normalize module specifier
  const cleanSpecifier = moduleSpecifier.trim();

  // 1. Check if an import from this module already exists
  const existingDecl = sourceFile
    .getImportDeclarations()
    .find((decl) => decl.getModuleSpecifierValue() === cleanSpecifier);

  if (existingDecl) {
    // Check if named import already present
    const namedImports = existingDecl.getNamedImports();
    const alreadyImported = namedImports.some(
      (imp) => imp.getName() === identifier,
    );

    if (alreadyImported) {
      return { changed: false, isNewImport: false };
    }

    // Add named import to existing declaration
    existingDecl.addNamedImport({
      name: identifier,
    });

    return { changed: true, isNewImport: false };
  }

  // 2. Module is not imported yet. Insert at the optimal index
  const insertIndex = findImportInsertIndex(sourceFile);
  sourceFile.insertImportDeclaration(insertIndex, {
    moduleSpecifier: cleanSpecifier,
    namedImports: [{ name: identifier }],
  });

  return { changed: true, isNewImport: true };
}
