import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profil, Role } from "./roles";

interface LigneUtilisateur {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: Role;
  actif: boolean;
}

/** Profil d'un compte actif, ou null (compte inconnu ou désactivé). */
export async function lireProfil(client: SupabaseClient, id: string): Promise<Profil | null> {
  const { data, error } = await client
    .from("utilisateur")
    .select("id, email, prenom, nom, role, actif")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Lecture du profil impossible : ${error.message}`);
  const ligne = data as LigneUtilisateur | null;
  if (!ligne || !ligne.actif) return null;
  return { id: ligne.id, email: ligne.email, prenom: ligne.prenom, nom: ligne.nom, role: ligne.role };
}
