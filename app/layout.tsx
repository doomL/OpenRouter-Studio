import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppToaster } from "@/components/ui/app-toaster";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OpenRouter Studio",
  description: "Visual node-based canvas for OpenRouter AI pipelines",
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ThemeProvider>
            {children}
            <AppToaster />
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
