export type EtatPlace = "libre" | "verrouillee" | "vendue";

export interface PlaceDeSeance {
  id: number;
  rangee: string;
  numero: number;
  accessiblePmr: boolean;
  positionX: number | null;
  positionY: number | null;
  etat: EtatPlace;
}

export interface DepotSeances {
  /** Places d'une séance publiée, ou null si la séance n'existe pas ou n'est pas publiée. */
  listerPlaces(seanceId: number): Promise<PlaceDeSeance[] | null>;
}
