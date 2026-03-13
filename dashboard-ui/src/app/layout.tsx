import type { Metadata } from "next";
import { Space_Grotesk, Rajdhani, Noto_Sans } from "next/font/google";
import "./globals.css";
import LayoutContent from "@/components/layout/LayoutContent";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const rajdhani = Rajdhani({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const notoSans = Noto_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ModernTensor Hedera Dashboard",
  description: "Next-generation Hedera network dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
      </head>
      <body
        className={`${spaceGrotesk.variable} ${rajdhani.variable} ${notoSans.variable} antialiased`}
      >
        <div className="noise-bg"></div>
        <div className="scanline-overlay"></div>
        <LayoutContent>{children}</LayoutContent>
      </body>
    </html>
  );
}
