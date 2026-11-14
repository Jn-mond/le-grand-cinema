import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { EtatConnexion } from "./etat-connexion";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Le Grand Cinéma",
  description: "Programme, réservation de places et billets du cinéma Le Grand Cinéma.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <header className="en-tete">
          <Link href="/" className="marque">
            Le Grand Cinéma
          </Link>
          <nav className="navigation">
            <Suspense fallback={null}>
              <EtatConnexion />
            </Suspense>
          </nav>
        </header>
        <main className="contenu">{children}</main>
      </body>
    </html>
  );
}
