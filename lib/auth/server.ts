import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAuthConfigured } from "@/lib/supabase/config";
import { isPortalRole, type PortalRole, type Viewer } from "./types";

export async function readViewer(client: SupabaseClient, user: User): Promise<Viewer | null> {
  const { data, error } = await client
    .from("portal_profiles")
    .select("full_name, student_id, role, active, avatar_path, version")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error("Unable to load portal permissions");
  if (!data?.active || !isPortalRole(data.role)) {
    return null;
  }

  const viewer: Viewer = {
    id: user.id,
    email: user.email ?? "",
    fullName: data.full_name,
    studentId: data.student_id,
    role: data.role,
    avatarVersion: data.avatar_path ? data.version : undefined,
  };

  return viewer;
}

// React cache deduplicates this only within one server request, never across users.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  if (!isAuthConfigured()) return null;
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  // Permissions come from a protected table, not editable user_metadata or URL state.
  return readViewer(client, user);
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireRole(roles: readonly PortalRole[]): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!roles.includes(viewer.role)) redirect("/access-denied");
  return viewer;
}
