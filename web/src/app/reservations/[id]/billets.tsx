import { toDataURL } from "qrcode";
import { formaterJourHeure } from "@/lib/dates";
import type { BilletPaye } from "@/modules/paiements/depot-supabase";
import { libellePlace } from "@/modules/seances/plan";

/**
 * E5 — billets dématérialisés : un QR code par place. Il contient le jeton du billet, une valeur
 * aléatoire vérifiée en base à l'entrée ; le code est aussi écrit en clair pour une saisie manuelle.
 * Le QR code est calculé sur le serveur et envoyé comme image : aucun script de plus côté client.
 */
function etatBillet(billet: BilletPaye): string {
  if (billet.utiliseLe) return `Utilisé le ${formaterJourHeure(billet.utiliseLe)}`;
  return "Valide — à présenter à l’entrée";
}

export async function Billets({ billets }: { billets: BilletPaye[] }) {
  const images = await Promise.all(
    billets.map((billet) =>
      toDataURL(billet.jeton, { errorCorrectionLevel: "M", margin: 2, width: 220 }),
    ),
  );
  return (
    <ul className="billets">
      {billets.map((billet, rang) => (
        <li key={billet.jeton} className={billet.utiliseLe ? "billet utilise" : "billet"}>
          <p className="billet-place">Place {libellePlace(billet)}</p>
          {/* eslint-disable-next-line @next/next/no-img-element -- image calculée, pas un fichier */}
          <img
            src={images[rang]}
            width={220}
            height={220}
            alt={`QR code du billet ${libellePlace(billet)}`}
          />
          <p className="billet-code">{billet.jeton}</p>
          <p>{etatBillet(billet)}</p>
        </li>
      ))}
    </ul>
  );
}
