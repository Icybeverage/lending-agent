import assert from "node:assert/strict";
import { createSandboxApi, SANDBOX_TX_HASH, SANDBOX_WALLET_ADDRESS } from "../src/sandboxFlow.ts";

const api = createSandboxApi();

const onramp = await api.call({ action: "onramp", fundingAmount: "500", walletAddress: SANDBOX_WALLET_ADDRESS });
assert.equal(onramp.onramp.status, "requires_action");
assert.equal(onramp.onramp.walletAddress, SANDBOX_WALLET_ADDRESS);

const funded = await api.call({ action: "status", stripeOnrampSessionId: onramp.onramp.sessionId, walletAddress: SANDBOX_WALLET_ADDRESS, fundingAmount: "500" });
assert.equal(funded.onramp.status, "fulfillment_complete");
assert.equal(funded.onramp.transactionDetails.destination_amount, "500");

const quote = await api.call({ action: "quote", fundingAsset: "USDC", fundingAmount: "500", fundingNetwork: "ETH", deliveryAsset: "SUI", deliveryNetwork: "SUI", walletAddress: SANDBOX_WALLET_ADDRESS });
assert.equal(quote.quote.provider, "CoinRabbit → ChangeNOW");
assert.equal(quote.quote.deliveryAsset, "SUI");

const application = await api.call({ action: "create", quoteId: quote.quote.quoteId, fundingAsset: "USDC", fundingAmount: quote.quote.fundingAmount, fundingNetwork: "ETH", deliveryAsset: "SUI", deliveryNetwork: "SUI", deliveryAddress: `0x${"4".repeat(64)}`, repaymentAddress: SANDBOX_WALLET_ADDRESS, walletAddress: SANDBOX_WALLET_ADDRESS, agreedToTos: true });
assert.equal(application.application.provider, "CoinRabbit → ChangeNOW");
assert.equal(application.application.collateral.network, "ETH");
assert.equal(application.application.swap.status, "waiting");

const recorded = await api.call({ action: "record_collateral", applicationId: application.application.applicationId, collateralTxHash: SANDBOX_TX_HASH });
assert.equal(recorded.collateral.collateralTxHash, SANDBOX_TX_HASH);

const status = await api.call({ action: "status", loanId: application.application.loanId, changeNowId: application.application.swap.id });
assert.equal(status.loan.status, "collateral_submitted");
assert.equal(status.swap.status, "waiting_for_coinrabbit");

const replay = await api.call({ action: "record_collateral", applicationId: application.application.applicationId, collateralTxHash: SANDBOX_TX_HASH });
assert.equal(replay.collateral.collateralTxHash, SANDBOX_TX_HASH);

console.log("Sandbox flow passed: Stripe fixture → Privy wallet → CoinRabbit fixture → ChangeNOW fixture → collateral record.");
console.log("No provider request, wallet signature, blockchain transaction, or payment was made.");
