# Clerk Authentication Architectural Rules

When writing code that interacts with Clerk:

1. Always wrap the root layout inside `<ClerkProvider>` (done automatically).
2. Protect server components and actions using `auth()` from `@clerk/nextjs/server`.
3. Use `<SignedIn>` and `<SignedOut>` components for conditional client UI rendering.
4. Route protection is enforced in `src/middleware.ts` via `clerkMiddleware()`.
