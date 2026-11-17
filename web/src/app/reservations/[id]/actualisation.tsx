"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const ESSAIS = 15;

/**
 * Stripe renvoie le client sur le site avant que sa confirmation (webhook) n'arrive :
 * la page est relue toutes les deux secondes, trente secondes au plus.
 */
export function Actualisation() {
  const router = useRouter();
  const [essais, setEssais] = useState(0);
  useEffect(() => {
    if (essais >= ESSAIS) return;
    const minuterie = setTimeout(() => {
      router.refresh();
      setEssais((n) => n + 1);
    }, 2000);
    return () => clearTimeout(minuterie);
  }, [essais, router]);
  return essais >= ESSAIS ? (
    <p className="discret">
      La confirmation tarde : rechargez la page dans un instant. Sans confirmation, votre carte
      n’est pas débitée.
    </p>
  ) : (
    <p className="discret" aria-live="polite">
      Confirmation en cours…
    </p>
  );
}
