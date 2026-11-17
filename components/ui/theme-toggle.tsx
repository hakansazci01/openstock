"use client";

import { useTheme } from "next-themes";
import { useState, useEffect } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return (
    <div className="fixed top-4 right-4 z-50 pointer-events-none">
      <Button
        variant="outline"
        size="sm"
        className="pointer-events-auto px-3 py-1.5 text-sm font-medium shadow-lg"
        onClick={() => {
          const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
          setTheme(next);
        }}
        title={`Tema: ${theme === "dark" ? "Karanlık" : theme === "light" ? "Açık" : "Sistem"}`}
        aria-label="Tema seçimi"
      >
        {theme === "dark" ? (
          <>
            <Moon className="w-4 h-4 mr-2" />
            <span>Dark</span>
          </>
        ) : theme === "light" ? (
          <>
            <Sun className="w-4 h-4 mr-2" />
            <span>Light</span>
          </>
        ) : (
          <>
            <Monitor className="w-4 h-4 mr-2" />
            <span>System</span>
          </>
        )}
      </Button>
    </div>
  );
}