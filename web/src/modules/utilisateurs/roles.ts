/** Rôles définis en base (type role_utilisateur) ; ils recouvrent les profils U1 à U6 du backlog. */
export type Role = "spectateur" | "professionnel" | "accueil" | "programmateur" | "administrateur";

export interface Profil {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  role: Role;
}

/** Programmer des séances (E7) : réservé au programmateur et à l'administrateur. */
export function peutProgrammer(role: Role): boolean {
  return role === "programmateur" || role === "administrateur";
}

/** Page où envoyer une personne juste après sa connexion. */
export function pageApresConnexion(role: Role): "/admin" | "/espace" {
  return peutProgrammer(role) ? "/admin" : "/espace";
}

const LIBELLES: Record<Role, string> = {
  spectateur: "Spectateur",
  professionnel: "Professionnel",
  accueil: "Accueil",
  programmateur: "Programmation",
  administrateur: "Administration",
};

export function libelleRole(role: Role): string {
  return LIBELLES[role];
}
