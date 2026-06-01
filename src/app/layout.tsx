import type { Metadata } from "next";
import { Spline_Sans, DM_Mono } from "next/font/google";
import "./globals.css";

const splineSans = Spline_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-spline-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Almstead Product Costing",
  description:
    "Internal pricing and bidding tool for Almstead Tree, Shrub & Lawn Care. Build crews, calculate costs, and generate bids.",
  icons: {
    icon: "/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${splineSans.variable} ${dmMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
