import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ThemeProvider } from "next-themes"

import "./index.css"
import App from "./App.tsx"
import { Toaster } from "@/components/ui/sonner"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="theme"
      // React never runs this inline anti-flash script in a client-only app;
      // a data-block type keeps React 19 from warning about it.
      scriptProps={{ type: "application/json" }}
    >
      <App />
      <Toaster richColors position="bottom-right" />
    </ThemeProvider>
  </StrictMode>
)
