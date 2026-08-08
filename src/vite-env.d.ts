/// <reference types="vite/client" />

interface Window {
  __LENDING_AGENT_CONFIG__?: {
    privyAppId?: string;
  };
  StripeOnramp?: {
    Standalone: (options: {
      source_currency: "usd" | "eur";
      amount: { source_amount: string } | { destination_amount: string };
      destination_currency: string;
      destination_network: string;
      destination_currencies: string[];
      destination_networks: string[];
    }) => { getUrl: () => string };
  };
}
