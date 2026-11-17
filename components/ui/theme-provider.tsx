"use client";

import { ThemeProvider as NextThemeProvider } from "next-themes";

type ThemeProviderProps = {
    children: React.ReactNode;
    nonce?: string;
};

export function ThemeProvider({ children, nonce }: ThemeProviderProps) {
    return (
        <NextThemeProvider
            attribute="data-theme"
            defaultTheme="dark"
            storageKey="openstock-theme"
            // next-themes injects a blocking inline script; without the CSP
            // nonce the browser blocks it and the page flashes the wrong theme.
            nonce={nonce}
        >
            {children}
        </NextThemeProvider>
    );
}