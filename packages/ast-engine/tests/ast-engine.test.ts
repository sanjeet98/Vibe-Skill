import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Project } from "ts-morph";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  applyInjections,
  ASTEngine,
  injectImport,
  injectJsxWrapper,
  injectNamedExport,
  injectReExport,
  type SkillInjection,
} from "../src/index.js";

describe("AST Engine Transformers & Orchestrator", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ast-engine-test-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  describe("Import Injector", () => {
    it("should inject import into an empty source file", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile("test.ts", "");

      const result = injectImport(sf, "@clerk/nextjs", "ClerkProvider");
      expect(result.changed).toBe(true);
      expect(result.isNewImport).toBe(true);

      const text = sf.getFullText();
      expect(text).toContain('import { ClerkProvider } from "@clerk/nextjs";');
    });

    it("should add a named import to an existing import declaration without duplicating", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        "test.ts",
        `import { useUser } from '@clerk/nextjs';\n`,
      );

      // First call adds ClerkProvider
      const res1 = injectImport(sf, "@clerk/nextjs", "ClerkProvider");
      expect(res1.changed).toBe(true);
      expect(res1.isNewImport).toBe(false);

      const text1 = sf.getFullText();
      expect(text1).toContain("useUser");
      expect(text1).toContain("ClerkProvider");

      // Second call is idempotent
      const res2 = injectImport(sf, "@clerk/nextjs", "ClerkProvider");
      expect(res2.changed).toBe(false);

      // Verify only 1 import statement exists
      expect(sf.getImportDeclarations()).toHaveLength(1);
    });

    it('should preserve top-of-file directives like "use client" and header comments', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const code = `/**
 * Main Layout component
 */
'use client';

export default function Layout() {
  return <div>Content</div>;
}
`;
      const sf = project.createSourceFile("layout.tsx", code);

      const res = injectImport(sf, "@clerk/nextjs", "ClerkProvider");
      expect(res.changed).toBe(true);

      const text = sf.getFullText();
      const useClientIndex = text.indexOf("'use client'");
      const importIndex = text.indexOf("import { ClerkProvider }");

      // "use client" must precede import
      expect(useClientIndex).toBeGreaterThan(-1);
      expect(importIndex).toBeGreaterThan(useClientIndex);
      expect(text).toContain("/**\n * Main Layout component\n */");
    });
  });

  describe("JSX Wrapper Injector", () => {
    it("should wrap inner children of <body> tag in Next.js 14 App Router layout.tsx", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const layoutCode = `
import type { Metadata } from 'next';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
`;
      const sf = project.createSourceFile("layout.tsx", layoutCode);

      const result = injectJsxWrapper(sf, "ClerkProvider");
      expect(result.changed).toBe(true);
      expect(result.targetTagName).toBe("body");

      const fullText = sf.getFullText();
      expect(fullText).toContain(
        '<body className="bg-background text-foreground">',
      );
      expect(fullText).toContain("<ClerkProvider>");
      expect(fullText).toContain("{children}");
      expect(fullText).toContain("</ClerkProvider>");
      expect(fullText).toContain("</body>");
    });

    it("should wrap top-level element if no <body> tag is present", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const pageCode = `
export default function Page() {
  return (
    <main className="container">
      <h1>Hello World</h1>
    </main>
  );
}
`;
      const sf = project.createSourceFile("page.tsx", pageCode);

      const result = injectJsxWrapper(sf, "ThemeProvider");
      expect(result.changed).toBe(true);
      expect(result.targetTagName).toBe("main");

      const fullText = sf.getFullText();
      expect(fullText).toContain("<ThemeProvider>");
      expect(fullText).toContain("<h1>Hello World</h1>");
      expect(fullText).toContain("</ThemeProvider>");
    });

    it("should be completely idempotent when wrapping JSX repeatedly", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const layoutCode = `
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>{children}</body>
    </html>
  );
}
`;
      const sf = project.createSourceFile("layout.tsx", layoutCode);

      // First run: wraps children
      const res1 = injectJsxWrapper(sf, "ClerkProvider");
      expect(res1.changed).toBe(true);

      const textAfterFirst = sf.getFullText();
      expect((textAfterFirst.match(/<ClerkProvider>/g) || []).length).toBe(1);

      // Second run: idempotent, no changes
      const res2 = injectJsxWrapper(sf, "ClerkProvider");
      expect(res2.changed).toBe(false);

      const textAfterSecond = sf.getFullText();
      expect((textAfterSecond.match(/<ClerkProvider>/g) || []).length).toBe(1);
    });
  });

  describe("Export & Re-Export Injector", () => {
    it('should safely append export * from "./module" to an index barrel', () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile(
        "index.ts",
        `export * from './users';\n`,
      );

      const res1 = injectReExport(sf, "./auth");
      expect(res1.changed).toBe(true);

      const text1 = sf.getFullText();
      expect(text1).toContain('export * from "./auth";');

      // Idempotent
      const res2 = injectReExport(sf, "./auth");
      expect(res2.changed).toBe(false);
      expect(sf.getExportDeclarations()).toHaveLength(2);
    });

    it("should safely inject named export re-exports", () => {
      const project = new Project({ useInMemoryFileSystem: true });
      const sf = project.createSourceFile("auth.ts", "");

      const res1 = injectNamedExport(sf, "@clerk/nextjs/server", "auth");
      expect(res1.changed).toBe(true);

      const res2 = injectNamedExport(sf, "@clerk/nextjs/server", "currentUser");
      expect(res2.changed).toBe(true);

      // Duplicate check
      const res3 = injectNamedExport(sf, "@clerk/nextjs/server", "auth");
      expect(res3.changed).toBe(false);

      const text = sf.getFullText();
      expect(text).toContain("auth");
      expect(text).toContain("currentUser");
    });
  });

  describe("Engine Orchestrator (applyInjections)", () => {
    it("should apply JSX wrapper and import injection end-to-end to layout.tsx", async () => {
      const layoutPath = path.join(tempDir, "src/app/layout.tsx");
      fs.mkdirSync(path.dirname(layoutPath), { recursive: true });
      fs.writeFileSync(
        layoutPath,
        `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
        "utf8",
      );

      const injections: SkillInjection[] = [
        {
          type: "jsx_wrapper",
          targetFile: "src/app/layout.tsx",
          import: {
            identifier: "ClerkProvider",
            module: "@clerk/nextjs",
          },
          wrapperComponent: "ClerkProvider",
        },
      ];

      const result = await applyInjections(tempDir, injections);
      expect(result.success).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.mutatedFiles).toHaveLength(1);
      expect(result.mutatedFiles[0].hasChanged).toBe(true);

      const diskContent = fs.readFileSync(layoutPath, "utf8");
      expect(diskContent).toContain(
        "import { ClerkProvider } from '@clerk/nextjs';",
      );
      expect(diskContent).toContain(
        "<body>\n        <ClerkProvider>{children}</ClerkProvider>\n      </body>",
      );

      // Verify idempotency on disk
      const repeatResult = await applyInjections(tempDir, injections);
      expect(repeatResult.success).toBe(true);
      expect(repeatResult.mutatedFiles[0].hasChanged).toBe(false);
    });

    it("should respect dry-run mode and not write changes to disk", async () => {
      const filePath = path.join(tempDir, "src/index.ts");
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      const initialCode = `export const version = '1.0.0';\n`;
      fs.writeFileSync(filePath, initialCode, "utf8");

      const injections: SkillInjection[] = [
        {
          type: "named_export",
          targetFile: "src/index.ts",
          exportName: "auth",
          module: "./auth",
        },
      ];

      const result = await applyInjections(tempDir, injections, {
        dryRun: true,
      });
      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.mutatedFiles).toHaveLength(1);
      expect(result.mutatedFiles[0].hasChanged).toBe(true);
      expect(result.mutatedFiles[0].modifiedContent).toContain(
        "export { auth } from './auth';",
      );

      // File on disk must remain untouched
      const onDisk = fs.readFileSync(filePath, "utf8");
      expect(onDisk).toBe(initialCode);
    });

    it("should roll back changes if syntax validation or transformation fails", async () => {
      const file1 = path.join(tempDir, "file1.ts");
      const file2 = path.join(tempDir, "file2.tsx");

      const original1 = `export const a = 1;\n`;
      // file2 has invalid unclosed syntax
      const original2 = `export default function App() { return <div>Unclosed; }\n`;

      fs.writeFileSync(file1, original1, "utf8");
      fs.writeFileSync(file2, original2, "utf8");

      const injections: SkillInjection[] = [
        {
          type: "named_export",
          targetFile: "file1.ts",
          exportName: "helper",
          module: "./helper",
        },
        {
          type: "jsx_wrapper",
          targetFile: "file2.tsx",
          import: {
            identifier: "Provider",
            module: "./provider",
          },
          wrapperComponent: "Provider",
        },
      ];

      const result = await applyInjections(tempDir, injections);
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);

      // Guardrail verification: file1 must be rolled back to original content
      const diskContent1 = fs.readFileSync(file1, "utf8");
      expect(diskContent1).toBe(original1);
    });

    it("should work via ASTEngine class instance", async () => {
      const engine = new ASTEngine({ dryRun: true });
      const layoutPath = path.join(tempDir, "layout.tsx");
      fs.writeFileSync(
        layoutPath,
        `export default function Layout({ children }: any) { return <div>{children}</div>; }`,
        "utf8",
      );

      const result = await engine.apply(tempDir, [
        {
          type: "jsx_wrapper",
          targetFile: "layout.tsx",
          import: { identifier: "Provider", module: "my-lib" },
          wrapperComponent: "Provider",
        },
      ]);

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.mutatedFiles[0].modifiedContent).toContain(
        "<Provider>{children}</Provider>",
      );
    });
  });
});
