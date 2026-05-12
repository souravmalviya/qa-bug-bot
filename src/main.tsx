import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import App from "./App";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY === "your_publishable_key_here") {
  document.body.innerHTML = `
    <div style="font-family:Inter,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f0fdf4;">
      <div style="background:white;border-radius:1.5rem;padding:2.5rem;max-width:480px;width:100%;box-shadow:0 20px 60px -10px rgba(0,0,0,0.1);border:1px solid #d1fae5;">
        <div style="width:48px;height:48px;background:#fef2f2;border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:1.25rem;">
          <span style="font-size:24px;">⚠️</span>
        </div>
        <h1 style="color:#0f172a;font-size:1.25rem;font-weight:700;margin:0 0 0.5rem;">Missing Clerk Key</h1>
        <p style="color:#64748b;font-size:0.9rem;line-height:1.6;margin:0 0 1.25rem;">
          <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.85rem;">VITE_CLERK_PUBLISHABLE_KEY</code>
          is not set in your <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.85rem;">.env.local</code> file.
        </p>
        <ol style="color:#475569;font-size:0.875rem;line-height:2;padding-left:1.25rem;margin:0 0 1.25rem;">
          <li>Go to <strong>dashboard.clerk.com</strong> → your app → <strong>API Keys</strong></li>
          <li>Copy the <strong>Publishable Key</strong> (starts with <code style="background:#f1f5f9;padding:2px 4px;border-radius:3px;">pk_test_</code>)</li>
          <li>Paste it into <code style="background:#f1f5f9;padding:2px 4px;border-radius:3px;">.env.local</code> as shown below</li>
          <li>Stop the dev server and run <code style="background:#f1f5f9;padding:2px 4px;border-radius:3px;">npm run dev</code> again</li>
        </ol>
        <pre style="background:#0f172a;color:#86efac;padding:1rem;border-radius:0.75rem;font-size:0.8rem;overflow:auto;margin:0;">VITE_CLERK_PUBLISHABLE_KEY=pk_test_...</pre>
      </div>
    </div>
  `;
  throw new Error("VITE_CLERK_PUBLISHABLE_KEY is not configured.");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </StrictMode>
);
