import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Role } from "@/lib/types";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", user.id)
    .single();
  return (data as Profile | null) ?? null;
}

export async function requireRole(role: Role) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== role) redirect(profile.role === "teacher" ? "/teacher" : "/student");
  const supabase = await createClient();
  return { profile, supabase };
}
