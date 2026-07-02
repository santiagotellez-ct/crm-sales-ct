import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root")!;

// Catch uncaught errors and show them instead of a blank page
window.onerror = (msg, src, line, col, err) => {
  root.innerHTML = `<div style="font-family:monospace;padding:2rem;color:#c00">
    <h2>Error al cargar la app</h2>
    <pre>${err?.message || msg}</pre>
    <p style="color:#666;font-size:0.85rem">Revisa las variables de entorno en Vercel (VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY)</p>
  </div>`;
};

createRoot(root).render(<App />);
