import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import Navbar from "@/components/layout/Navbar";
import BackgroundEffects from "@/components/layout/BackgroundEffects";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "ModernTensor | AI Compute Network",
  description: "Advanced Hedera-powered AI orchestration and incentive layer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="antialiased min-h-screen">
        <Providers>
          <BackgroundEffects />
          <Navbar />

          <main className="pt-24 pb-12 transition-all duration-300">
            <div className="max-w-[1400px] mx-auto px-6">
              {children}
            </div>
          </main>

          <Toaster theme="dark" position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
