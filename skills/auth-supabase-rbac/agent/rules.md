# Supabase Auth & RBAC Architecture Rules for AI Agents

You are an expert AI software engineer implementing features in a codebase equipped with **Supabase Auth & Role-Based Access Control (RBAC)**. Always follow these architectural guidelines:

---

## 1. Client Components vs. Server Components

### A. Client Components (`'use client'`)

- Import `useAuth` from `@/components/auth-provider`.
- Access `user`, `session`, `role`, and `isLoading`.
- Never perform privileged admin database operations directly from the client.
- Example:
  ```tsx
  "use client";
  import { useAuth } from "@/components/auth-provider";

  export function UserGreeting() {
    const { user, role, isLoading } = useAuth();
    if (isLoading) return <div>Loading session...</div>;
    if (!user) return <a href="/login">Sign In</a>;

    return (
      <div>
        Hello, {user.email}! (Role: <span className="badge">{role}</span>)
      </div>
    );
  }
  ```

### B. Server Components (RSC)

- Import `createClient` from `@/lib/supabase/server`.
- Always `await createClient()`.
- Use `supabase.auth.getUser()` (never trust `getSession()` on the server for security decisions).
- Example:
  ```tsx
  import { createClient } from "@/lib/supabase/server";
  import { redirect } from "next/navigation";

  export default async function AdminDashboardPage() {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login?redirectTo=/admin");
    }

    // Verify role in profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      redirect("/unauthorized");
    }

    return <h1>Admin Controls</h1>;
  }
  ```

---

## 2. Server Actions & Mutations

- When creating Server Actions (`'use server'`), always instantiate the server client:
  ```ts
  "use server";
  import { createClient } from "@/lib/supabase/server";
  import { revalidatePath } from "next/cache";

  export async function updateProfile(formData: FormData) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      throw new Error("Unauthorized");
    }

    const fullName = formData.get("fullName") as string;
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", user.id);

    if (error) throw new Error(error.message);
    revalidatePath("/dashboard/profile");
  }
  ```

---

## 3. Role-Based Access Control (RBAC) & RLS Policies

- The database enforces roles via `public.app_role` (`'admin'`, `'moderator'`, `'user'`).
- Always write queries relying on Row-Level Security (RLS) rather than client-side filtering.
- For service-role tasks (e.g. background webhooks, provisioning roles), instantiate an admin client using `process.env.SUPABASE_SERVICE_ROLE_KEY`. Never expose this key in public client bundles.

---

## 4. Route Protection in Middleware

- Global session refresh is handled in `src/middleware.ts` via `updateSession(request)`.
- Protected routes under `/dashboard/*` redirect unauthenticated visitors to `/login`.
