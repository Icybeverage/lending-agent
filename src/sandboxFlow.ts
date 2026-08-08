export const SANDBOX_WALLET_ADDRESS = "0x1111111111111111111111111111111111111111";
export const SANDBOX_COLLATERAL_ADDRESS = "0x2222222222222222222222222222222222222222";
export const SANDBOX_TX_HASH = `0x${"3".repeat(64)}`;

type SandboxRequest = Record<string, unknown>;

type SandboxOnramp = {
  sessionId: string;
  clientSecret: string;
  redirectUrl: string | null;
  status: "requires_action" | "fulfillment_complete";
  walletAddress: string;
  transactionDetails: { destination_amount: string } | null;
};

type SandboxApplication = {
  applicationId: string;
  loanId: string;
  fundingWalletAddress: string;
  status: string;
  expectedLoanAmount: string;
  deliveryAddress: string;
  repaymentAddress: string;
  collateral: {
    asset: "USDC";
    network: "ETH";
    amount: string;
    depositAddress: string;
    depositExtraId: null;
  };
  swap: { id: string; payinAddress: string; status: string };
  collateralTxHash?: string;
  provider: "CoinRabbit → ChangeNOW";
  nextStep: string;
};

function asNumber(value: unknown) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 25) throw new Error("Sandbox funding amount must be at least 25.");
  return amount;
}

function deliveryRate(asset: string) {
  const rates: Record<string, number> = { BTC: 0.00001, ETH: 0.00025, USDT: 0.49, USDC: 0.49, SOL: 0.003, BNB: 0.0008, XRP: 0.8, SUI: 0.7, DOGE: 3.5, AVAX: 0.006 };
  return rates[asset] || 0.001;
}

export function createSandboxApi() {
  let onramp: SandboxOnramp | null = null;
  let quote: Record<string, unknown> | null = null;
  let application: SandboxApplication | null = null;

  return {
    async call(input: SandboxRequest) {
      const action = String(input.action || "quote");
      if (action === "onramp") {
        onramp = {
          sessionId: "cos_sandbox_onramp",
          clientSecret: "cs_sandbox_no_payment",
          redirectUrl: null,
          status: "requires_action",
          walletAddress: SANDBOX_WALLET_ADDRESS,
          transactionDetails: null,
        };
        return { ok: true, onramp };
      }
      if (action === "status" && input.stripeOnrampSessionId) {
        if (!onramp || onramp.sessionId !== input.stripeOnrampSessionId) throw new Error("Sandbox Stripe session not found.");
        onramp = { ...onramp, status: "fulfillment_complete", transactionDetails: { destination_amount: String(input.fundingAmount || 500) } };
        return { ok: true, onramp };
      }
      if (action === "quote") {
        const fundingAmount = asNumber(input.fundingAmount);
        const deliveryAsset = String(input.deliveryAsset || "ETH");
        const loanAmount = fundingAmount * 0.5;
        quote = {
          quoteId: "sandbox_quote_001",
          fundingAsset: "USDC",
          fundingAmount,
          fundingNetwork: "ETH",
          deliveryAsset,
          deliveryNetwork: String(input.deliveryNetwork || "ETH").toUpperCase(),
          deliveryAmount: loanAmount * deliveryRate(deliveryAsset),
          provider: "CoinRabbit → ChangeNOW",
          providerFee: loanAmount * 0.05,
          networkFee: 0,
          totalRepayment: loanAmount * 1.05,
          repaymentAsset: "USDT",
          loanAmount,
          loanAsset: "USDT",
          route: { collateral: "USDC on ETH", loan: "USDT on ETH", swap: `USDT → ${deliveryAsset}` },
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          mode: "live",
        };
        return { ok: true, quote };
      }
      if (action === "create") {
        if (!quote || quote.quoteId !== input.quoteId) throw new Error("Request a sandbox quote first.");
        const deliveryAddress = String(input.deliveryAddress || SANDBOX_WALLET_ADDRESS);
        application = {
          applicationId: "sandbox_application_001",
          loanId: "sandbox_loan_001",
          fundingWalletAddress: SANDBOX_WALLET_ADDRESS,
          status: "pending_collateral",
          expectedLoanAmount: String(quote.loanAmount),
          deliveryAddress,
          repaymentAddress: String(input.repaymentAddress || SANDBOX_WALLET_ADDRESS),
          collateral: { asset: "USDC", network: "ETH", amount: String(quote.fundingAmount), depositAddress: SANDBOX_COLLATERAL_ADDRESS, depositExtraId: null },
          swap: { id: "sandbox_swap_001", payinAddress: "0x3333333333333333333333333333333333333333", status: "waiting" },
          provider: "CoinRabbit → ChangeNOW",
          nextStep: "Sandbox only: record the synthetic collateral; no funds move.",
        };
        return { ok: true, application };
      }
      if (action === "record_collateral") {
        if (!application || application.applicationId !== input.applicationId) throw new Error("Sandbox application not found.");
        application = { ...application, status: "collateral_submitted", collateralTxHash: String(input.collateralTxHash || SANDBOX_TX_HASH), swap: { ...application.swap, status: "waiting_for_coinrabbit" } };
        return { ok: true, collateral: { applicationId: application.applicationId, collateralTxHash: application.collateralTxHash } };
      }
      if (action === "status" && input.loanId) {
        if (!application || application.loanId !== input.loanId) throw new Error("Sandbox loan not found.");
        return { ok: true, loan: { status: application.status }, swap: application.swap };
      }
      throw new Error(`Sandbox action not implemented: ${action}`);
    },
  };
}
