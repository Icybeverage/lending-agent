import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PrivyProvider } from "@privy-io/react-auth";
import App from "./App";
import "./index.css";

const privyAppId = window.__LENDING_AGENT_CONFIG__?.privyAppId || import.meta.env.VITE_PRIVY_APP_ID || "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: { ethereum: { createOnLogin: "all-users" } },
      }}
    >
      <App />
    </PrivyProvider>
  </StrictMode>,
);
