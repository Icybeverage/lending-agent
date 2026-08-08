# Lending Agent — Privy Hackathon Task List

## Project brief

Build a Privy-authenticated universal lending agent with USD or USDC funding selection. Stripe Checkout supports card and crypto funding; the user selects the cryptocurrency they want delivered. Supabase Edge Functions hold the orchestration and provider credentials, while server-side ChangeNOW and CoinRabbit adapters handle quoting and routing.

Project systems:

- Stripe Project: `lending agent`
- Existing Supabase project: `hive` (`zcahokqhmmsjpcfrxfly`)
- Existing Supabase source: `/home/nimbus/supabase`
- Providers: ChangeNOW and CoinRabbit
- Confirmed Privy hackathon code: `privy-home-irl-sf-2026`
- Product route: `/lend`
- Participant leaderboard: https://projects.dev/hackathon-participants
- Live demo: https://icybeverage.github.io/lending-agent/lend/
- Public repository: https://github.com/Icybeverage/lending-agent
- Delivery assets: BTC, ETH, USDT, USDC, SOL, BNB, XRP, ADA, DOGE, AVAX

## 0. Registration and scope lock

- [ ] Confirm the active Privy hackathon registration page, event name, deadline, eligibility, and required submission fields.
- [ ] Register the project/team on `https://projects.dev/hackathon-participants` using the confirmed event code `privy-home-irl-sf-2026`.
- [ ] Publish the final leaderboard entry only after the live demo, repository, description, screenshots, and Stripe Projects share URL are ready.
- [ ] Create a Privy app for `Lending Agent` and record the app ID, allowed origins, and supported chains.
- [ ] Decide the first demo corridor: input currency, network, collateral model, loan asset, repayment asset, and supported countries.
- [ ] Decide whether the demo is a real lender flow, a provider-backed loan flow, or a quote-and-simulate flow. Do not imply that a quote is a funded loan.
- [ ] Define the lender of record, collateral requirements, LTV, interest/fee model, expiry window, liquidation behavior, and repayment rules.

## 1. Wallet and payment experience

- [x] Add Privy login with email/social/wallet sign-in.
- [x] Create or connect the user wallet through Privy and show the active wallet and chain clearly.
- [ ] Build `/lend`: funding amount, USD or USDC selection, destination cryptocurrency, network, collateral, and repayment preference.
- [ ] Support exactly ten delivery assets in the first release: BTC, ETH, USDT, USDC, SOL, BNB, XRP, ADA, DOGE, and AVAX.
- [ ] Show an explicit quote summary: principal, exchange rate, provider fee, network fee, interest, total repayment, LTV, quote expiry, and estimated delivery time.
- [x] Require a final confirmation before payment, wallet signing, or loan creation.
- [ ] Provide visible states for quote pending, payment pending, loan pending, funded, repayment due, repaid, expired, failed, and refunded.

## 2. Stripe and Supabase foundation

- [x] Create the Stripe Project `lending agent`.
- [x] Link the Stripe Project to the existing Supabase provider account.
- [ ] Confirm all Edge Functions deploy to the existing `hive` project, not the accidentally provisioned `lending-agent` Supabase resource.
- [ ] After confirming no credentials depend on it, request approval before removing the accidentally provisioned `lending-agent` resource and `supabase-plan` from Stripe Projects.
- [x] Link `/home/nimbus/supabase` to `zcahokqhmmsjpcfrxfly` with the Supabase CLI; remote migration history reconciliation remains before deployment.
- [ ] Configure local and deployed secrets: Stripe, Privy, ChangeNOW, CoinRabbit, Supabase service role, webhook signing secrets, and encryption keys.
- [ ] Keep provider secrets server-side; never put them in Vite client variables, logs, screenshots, or the repository.

## 3. Supabase data model

- [ ] Create tables for `profiles`, `wallets`, `quote_requests`, `loan_applications`, `loans`, `repayments`, `provider_requests`, `webhook_events`, and `audit_events`.
- [ ] Add immutable IDs, provider references, quote expiry, status, timestamps, and idempotency keys to every money-moving record.
- [ ] Add RLS policies so users can read only their own wallet, quote, loan, and repayment records.
- [ ] Add server-only service-role operations for provider calls and state transitions.
- [ ] Add indexes for user, wallet, provider reference, loan status, and webhook event ID.
- [ ] Add a migration and seed data for a fully mocked demo corridor.

## 4. Edge Functions and provider routing

- [x] Define the `universal-lending` Supabase Edge Function contract with authenticated operations for quote, create, status, and repay.
- [x] Implement live `universal-lending` quotes through CoinRabbit and ChangeNOW with server-side credentials.
- [x] Verify Privy bearer tokens server-side for all mutating operations.
- [x] Add Stripe USDC Onramp session creation/status for USD funding.
- [x] Add user-approved Privy Ethereum USDC transfer to the CoinRabbit collateral address.
- [ ] Implement `loan-create`: enforce quote expiry and idempotency, create the payment/loan record, and start the provider workflow.
- [ ] Implement `loan-status`: return the canonical state assembled from persisted records and provider status checks.
- [ ] Implement `loan-repay`: validate the repayment asset and amount, create the repayment request, and update state only from verified provider/payment events.
- [ ] Implement provider webhooks for Stripe, ChangeNOW, and CoinRabbit with signature verification and replay protection.
- [ ] Add adapter interfaces so ChangeNOW and CoinRabbit can be mocked independently in tests.
- [ ] Keep ChangeNOW and CoinRabbit credentials exclusively in Supabase secrets; no provider key may reach the browser.
- [ ] Add timeouts, bounded retries, backoff, circuit breaking, and a manual-review state for ambiguous provider responses.
- [ ] Persist raw provider response metadata only when safe; redact addresses, tokens, and secrets from logs.
- [ ] Return normalized errors that are useful to the UI without leaking provider or secret details.

## 5. Stripe payment flow

- [ ] Confirm the account’s supported Stripe payment methods for USD and USDC; document stablecoin availability, network, settlement behavior, and regional limits.
- [ ] Implement Stripe Checkout with both card funding and crypto funding where the account is eligible.
- [ ] Implement the USD card path and the USDC path with verified server-side payment events.
- [ ] Bind Stripe payment IDs to the loan application using idempotency keys and metadata.
- [ ] Handle success, failure, cancellation, expiration, refund, dispute, and duplicate webhook events.
- [ ] Do not mark a loan funded from a client redirect; require a verified server-side payment event.

## 6. Frontend and demo surface

- [x] Add the `/lend` universal lending UI with Privy auth, USD/USDC selection, ten-asset picker, live quotes, and provider explanation.
- [x] Apply the MIT-licensed Vite/React shadcn dashboard template as the visual reference and publish the responsive site.
- [ ] Show the routing decision and quote breakdown in plain language so judges can understand the backend orchestration.
- [ ] Add a demo mode that uses deterministic provider fixtures and clearly labels simulated transactions.
- [ ] Add accessibility, responsive mobile layout, loading states, retry actions, and transaction links where available.
- [ ] Add a short “how it works” panel covering Privy, Stripe, Supabase, ChangeNOW, and CoinRabbit.

## 7. Security, compliance, and reliability

- [ ] Threat-model wallet authentication, payment authorization, quote tampering, replay, webhook forgery, provider outages, and oracle/price drift.
- [ ] Enforce server-side authorization, input validation, rate limits, amount limits, supported-asset allowlists, and chain allowlists.
- [ ] Add KYC/AML, sanctions, jurisdiction, and age-gating requirements appropriate to the chosen lender and demo geography.
- [ ] Verify that the product copy distinguishes estimates, applications, approvals, funded loans, and repayments.
- [ ] Test quote expiry, duplicate submissions, partial provider failure, payment reversal, and mismatched payment amounts.
- [ ] Run dependency audit, secret scan, typecheck, lint, unit tests, Edge Function tests, and end-to-end happy/error-path tests.
- [ ] Use testnet or mocked money movement until the real-money path has explicit approval and operational monitoring.

## 8. Deployment and submission package

- [x] Deploy the live `universal-lending` Edge Function against the existing `hive` project after credential setup.
- [x] Deploy the frontend after adding the public `VITE_PRIVY_APP_ID` and approved Privy origins.
- [ ] Verify production environment variables, CORS, Privy allowed origins, webhook URLs, and Supabase function auth.
- [ ] Record the live demo URL, repository URL, Stripe Project ID, Supabase project ref, and Privy app ID in a private handoff note.
- [ ] Write the README: problem, user flow, architecture, provider roles, security model, setup, demo mode, and known limitations.
- [ ] Create an architecture diagram and a 2–3 minute demo script.
- [ ] Record the demo showing Privy authentication, USD/USDC funding selection, Stripe Checkout card+crypto, delivery-asset choice, quote/routing explanation, loan status, and repayment.
- [ ] Generate the Stripe Projects share artifact after the stack is finalized.
- [x] Publish the live demo and repository handoff: `https://icybeverage.github.io/lending-agent/lend/` and `https://github.com/Icybeverage/lending-agent`.
- [ ] Submit the project to the Privy hackathon leaderboard at `https://projects.dev/hackathon-participants` with code `privy-home-irl-sf-2026`, live URL, repository, demo video, screenshots, Stripe Projects share URL, and concise Privy integration explanation.
- [ ] Save the submission confirmation and final submission snapshot.

## Definition of done

- [ ] A new user can authenticate with Privy, request a supported loan, understand the quote, complete the supported payment flow, and track the resulting state.
- [ ] All ChangeNOW, CoinRabbit, Stripe, and Supabase secrets remain server-side.
- [ ] The demo can run end-to-end with deterministic mocks even if a provider is unavailable.
- [ ] Production behavior never reports a loan as funded until a verified backend event confirms it.
- [ ] The submission clearly identifies what is live, what is simulated, and how Privy enables the wallet experience.
