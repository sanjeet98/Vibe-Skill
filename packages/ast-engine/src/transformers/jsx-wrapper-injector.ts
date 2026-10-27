import {
  Node,
  SyntaxKind,
  type ArrowFunction,
  type FunctionDeclaration,
  type FunctionExpression,
  type JsxElement,
  type JsxFragment,
  type JsxSelfClosingElement,
  type SourceFile,
} from "ts-morph";

export interface JsxWrapperResult {
  changed: boolean;
  targetTagName?: string;
}

/**
 * Finds the primary React component in the source file, prioritizing default exports.
 */
export function findReactComponent(
  sourceFile: SourceFile,
): FunctionDeclaration | ArrowFunction | FunctionExpression | null {
  // 1. Direct default export function declaration: export default function RootLayout() {}
  const defaultFunc = sourceFile
    .getFunctions()
    .find((f) => f.isDefaultExport());
  if (defaultFunc) {
    return defaultFunc;
  }

  // 2. Export assignment: export default RootLayout; or export default () => <div />
  for (const exportAssignment of sourceFile.getExportAssignments()) {
    if (exportAssignment.isExportEquals()) continue;
    const expr = exportAssignment.getExpression();

    if (Node.isArrowFunction(expr)) return expr;
    if (Node.isFunctionExpression(expr)) return expr;

    if (Node.isIdentifier(expr)) {
      const componentName = expr.getText();
      const fn = sourceFile.getFunction(componentName);
      if (fn) return fn;

      const varDecl = sourceFile.getVariableDeclaration(componentName);
      if (varDecl) {
        const init = varDecl.getInitializer();
        if (
          init &&
          (Node.isArrowFunction(init) || Node.isFunctionExpression(init))
        ) {
          return init;
        }
      }
    }
  }

  // 3. Fallback: Search for any function named RootLayout, Layout, Page, or App
  const namedCandidates = sourceFile
    .getFunctions()
    .find((f) => /^(RootLayout|Layout|Page|App)$/i.test(f.getName() || ""));
  if (namedCandidates) {
    return namedCandidates;
  }

  return null;
}

/**
 * Extracts the top-level returned JSX node from a component.
 */
export function findReturnedJsxNode(
  component: FunctionDeclaration | ArrowFunction | FunctionExpression,
): JsxElement | JsxFragment | JsxSelfClosingElement | null {
  // For concise arrow functions: const App = () => <div>Hello</div>;
  if (Node.isArrowFunction(component)) {
    const body = component.getBody();
    let expr = body;
    if (Node.isParenthesizedExpression(expr)) {
      expr = expr.getExpression();
    }
    if (
      Node.isJsxElement(expr) ||
      Node.isJsxFragment(expr) ||
      Node.isJsxSelfClosingElement(expr)
    ) {
      return expr;
    }
  }

  // For block body functions: find return statements
  const returnStatements = component.getDescendantsOfKind(
    SyntaxKind.ReturnStatement,
  );
  if (returnStatements.length === 0) {
    return null;
  }

  const returnStmt = returnStatements[0];
  let expr = returnStmt.getExpression();
  if (!expr) {
    return null;
  }

  if (Node.isParenthesizedExpression(expr)) {
    expr = expr.getExpression();
  }

  if (
    Node.isJsxElement(expr) ||
    Node.isJsxFragment(expr) ||
    Node.isJsxSelfClosingElement(expr)
  ) {
    return expr;
  }

  return null;
}

/**
 * Idempotently wraps the inner children of the target React JSX element with <WrapperComponent>.
 * If a <body> tag is present in the returned JSX, wraps its inner children.
 * Otherwise, wraps the top-level returned JSX element.
 */
export function injectJsxWrapper(
  sourceFile: SourceFile,
  wrapperComponent: string,
): JsxWrapperResult {
  const component = findReactComponent(sourceFile);
  if (!component) {
    throw new Error(
      `Could not locate a React component (default export or Layout/Page) in ${sourceFile.getBaseName()}`,
    );
  }

  const rootJsx = findReturnedJsxNode(component);
  if (!rootJsx) {
    throw new Error(
      `Could not locate returned JSX element in component ${sourceFile.getBaseName()}`,
    );
  }

  // 1. Locate target element: Check for <body> tag inside the tree
  let targetElement: JsxElement | JsxFragment | JsxSelfClosingElement = rootJsx;

  if (Node.isJsxElement(rootJsx)) {
    const bodyElement = rootJsx
      .getDescendantsOfKind(SyntaxKind.JsxElement)
      .find(
        (el) => el.getOpeningElement().getTagNameNode().getText() === "body",
      );

    if (bodyElement) {
      targetElement = bodyElement;
    }
  }

  // 2. Check for idempotency: is <WrapperComponent> already wrapping the target?
  if (Node.isJsxElement(targetElement)) {
    const targetTag = targetElement
      .getOpeningElement()
      .getTagNameNode()
      .getText();
    if (targetTag === wrapperComponent) {
      return { changed: false, targetTagName: targetTag };
    }

    const isAlreadyWrapped = targetElement.getJsxChildren().some((child) => {
      if (Node.isJsxElement(child)) {
        return (
          child.getOpeningElement().getTagNameNode().getText() ===
          wrapperComponent
        );
      }
      if (Node.isJsxSelfClosingElement(child)) {
        return child.getTagNameNode().getText() === wrapperComponent;
      }
      return false;
    });

    if (isAlreadyWrapped) {
      return { changed: false, targetTagName: targetTag };
    }

    // Wrap the inner children
    const opening = targetElement.getOpeningElement().getText();
    const closing = targetElement.getClosingElement().getText();
    const innerChildren = targetElement
      .getJsxChildren()
      .map((c) => c.getText())
      .join("")
      .trim();

    targetElement.replaceWithText(
      `${opening}\n<${wrapperComponent}>\n${innerChildren}\n</${wrapperComponent}>\n${closing}`,
    );

    return { changed: true, targetTagName: targetTag };
  }

  if (Node.isJsxFragment(targetElement)) {
    const isAlreadyWrapped = targetElement.getJsxChildren().some((child) => {
      if (Node.isJsxElement(child)) {
        return (
          child.getOpeningElement().getTagNameNode().getText() ===
          wrapperComponent
        );
      }
      return false;
    });

    if (isAlreadyWrapped) {
      return { changed: false, targetTagName: "Fragment" };
    }

    const innerChildren = targetElement
      .getJsxChildren()
      .map((c) => c.getText())
      .join("")
      .trim();

    targetElement.replaceWithText(
      `<>\n<${wrapperComponent}>\n${innerChildren}\n</${wrapperComponent}>\n</>`,
    );

    return { changed: true, targetTagName: "Fragment" };
  }

  if (Node.isJsxSelfClosingElement(targetElement)) {
    const tagName = targetElement.getTagNameNode().getText();
    if (tagName === wrapperComponent) {
      return { changed: false, targetTagName: tagName };
    }

    const selfText = targetElement.getText();
    targetElement.replaceWithText(
      `<${wrapperComponent}>\n${selfText}\n</${wrapperComponent}>`,
    );

    return { changed: true, targetTagName: tagName };
  }

  return { changed: false };
}
