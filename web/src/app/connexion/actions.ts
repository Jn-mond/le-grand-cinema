"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { clientAuthServeur, configurationAuth } from "@/lib/supabase-auth";
import { clientSupabaseServeur } from "@/lib/supabase-serveur";
import { lireProfil } from "@/modules/utilisateurs/depot-supabase";
import { pageApresConnexion } from "@/modules/utilisateurs/roles";

export interface EtatConnexion {
  erreur: string | null;
}

const schemaConnexion = z.object({
  email: z.string().trim().min(1).max(254),
  motDePasse: z.string().min(1).max(200),
});

export async function seConnecter(_etat: EtatConnexion, donnees: FormData): Promise<EtatConnexion> {
  const saisie = schemaConnexion.safeParse({
    email: donnees.get("email"),
    motDePasse: donnees.get("motDePasse"),
  });
  if (!saisie.success) {
    return { erreur: "Saisissez votre adresse e-mail et votre mot de passe." };
  }
  if (!configurationAuth()) {
    return { erreur: "La connexion est momentanément indisponible." };
  }
  const supabase = await clientAuthServeur();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: saisie.data.email,
    password: saisie.data.motDePasse,
  });
  if (error || !data.user) {
    // Message volontairement identique dans tous les cas : ne pas révéler si le compte existe.
    return { erreur: "Adresse e-mail ou mot de passe incorrect." };
  }
  const profil = await lireProfil(clientSupabaseServeur(), data.user.id);
  redirect(profil ? pageApresConnexion(profil.role) : "/espace");
}

export async function seDeconnecter(): Promise<void> {
  const supabase = await clientAuthServeur();
  await supabase.auth.signOut();
  redirect("/");
}
