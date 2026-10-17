import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BackendStatusBar } from "@/components/BackendStatusBar";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ToastHost } from "@/components/ToastHost";

export const metadata: Metadata = {
  title: "Queue Mitra — Skip the line, keep your time",
  description:
    "Scan a QR code, join the virtual queue, and wait anywhere. Live wait estimates, turn reminders, and a staff dashboard for campus venues.",
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <Header />
        <BackendStatusBar />
        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
        <Footer />
        <ToastHost />
      </body>
    </html>
  );
}
