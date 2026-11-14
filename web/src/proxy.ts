import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Rafraîchit la session Supabase avant chaque page : un jeton expiré est renouvelé ici, et les
 * nouveaux cookies sont renvoyés au navigateur. Le contrôle d'accès, lui, se fait dans les pages
 * et les actions serveur (le proxy n'est pas une barrière de sécurité suffisante).
 */
export async function proxy(requete: NextRequest) {
  let reponse = NextResponse.next({ request: requete });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !cle) return reponse;

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(aEcrire, entetes) {
        for (const { name, value } of aEcrire) requete.cookies.set(name, value);
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of aEcrire) reponse.cookies.set(name, value, options);
        for (const [nom, valeur] of Object.entries(entetes)) reponse.headers.set(nom, valeur);
      },
    },
  });
  await supabase.auth.getUser();
  return reponse;
}

export const config = {
  // Pages seulement : ni fichiers statiques, ni API, ni documentation Swagger.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/|openapi.json|docs-api.html).*)"],
};
