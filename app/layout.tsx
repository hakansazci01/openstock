import type { Metadata } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { Toaster } from "@/components/ui/sonner";
import OntoLaunchCard from "@/components/OntoLaunchCard";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
    variable: "--font-jakarta",
    subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
    variable: "--font-plex-mono",
    subsets: ["latin"],
    weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
    title: "OpenStock",
    description:
        "OpenStock is an open-source alternative to expensive market platforms. Track real-time prices, set personalized alerts, and explore detailed company insights — built openly, for everyone, forever free.",
};

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    // Set by middleware.ts so next-themes' blocking script passes our CSP.
    const nonce = (await headers()).get('x-nonce') ?? undefined;

    return (
        <html lang="tr" suppressHydrationWarning>
            <head>
                <link rel="manifest" href="/manifest.json" />
            </head>
            <body className={`${jakarta.variable} ${plexMono.variable} font-sans antialiased`}>
                <ThemeProvider nonce={nonce}>
                    {children}
                    <ThemeToggle />
                    <Toaster />
                    <OntoLaunchCard />
                    <Analytics />
                </ThemeProvider>
            </body>
        </html>
    );
}