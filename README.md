# Lending Agent

CLI-first lending flow for the Privy hackathon project. The `/lend` surface uses live CoinRabbit and ChangeNOW provider calls. USD funding opens a Stripe USDC Onramp session; USDC funding starts directly from the user’s Privy wallet.

## Local app

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:4173/lend/`.

### No-payment sandbox

The repository includes a deterministic provider simulator for testing the full UI sequence without sending money, calling Stripe, calling CoinRabbit, calling ChangeNOW, signing with a wallet, or submitting a blockchain transaction.

Run the automated flow check:

```bash
npm run test:sandbox
```

To exercise the UI manually, set `VITE_LENDING_SANDBOX=true` in `.env` and run the app with the public `VITE_PRIVY_APP_ID`. The sandbox supplies synthetic balances, a test Stripe completion, CoinRabbit and ChangeNOW fixtures, and a fake collateral hash. The flag is build-time only and must remain `false` for the live deployment.

The UI supports USD or USDC funding selection and all ten delivery assets: BTC, ETH, USDT, USDC, SOL, BNB, XRP, SUI, DOGE, and AVAX. USD uses Stripe Onramp to deliver USDC to the user’s Privy Ethereum wallet before collateral is sent to CoinRabbit.

Set these public frontend variables in a local `.env` or deployment environment:

```text
VITE_UNIVERSAL_LENDING_URL=https://zcahokqhmmsjpcfrxfly.supabase.co/functions/v1/universal-lending
VITE_PRIVY_APP_ID=<the public app ID from the Privy dashboard>
VITE_LENDING_SANDBOX=false
```

The Privy app ID is safe for the browser; `privy_app_secret` remains server-only in Supabase. The current live path is USD → Stripe USDC Onramp → Privy Ethereum wallet → CoinRabbit collateral → ChangeNOW delivery. Quotes and provider requests are persisted in Supabase with live loan-create idempotency.

## Supabase backend

The existing project is `hive` (`zcahokqhmmsjpcfrxfly`) in `/home/nimbus/supabase`.

```bash
cd /home/nimbus/supabase
supabase link --project-ref zcahokqhmmsjpcfrxfly --yes
deno check supabase/functions/universal-lending/index.ts
supabase db push --dry-run --linked
```

The dry run must be reconciled with the remote migration history before applying the new migration. Deploy only after the migration review and provider secrets are complete:

```bash
supabase functions deploy universal-lending --use-api
```

Provider secrets belong in Supabase, not in this repository:

- `CHANGENOW_API_KEY`
- `privy_app_id`, `privy_app_secret`
- `STRIPE_SECRET_KEY`
- `coinrabbit_api_key`
- `APP_ORIGIN`

## Stripe Projects

The Stripe Project is `lending agent`. Its current share artifact is:

```text
https://projects.dev/s#v1:Supabase~project
```

Final leaderboard registration is a browser-only step at `https://projects.dev/hackathon-participants` using `privy-home-irl-sf-2026`.

## Live frontend

The public demo is published from the `gh-pages` branch on GitHub Pages. The build uses the public Privy app ID and the live Supabase Edge Function URL; provider secrets remain only in Supabase.

For live USD funding, `VITE_STRIPE_STANDALONE_ONRAMP=true` opens Stripe's hosted `crypto.link.com` flow with USD → USDC on Ethereum. Because this standalone flow is not bound to our backend session, the user must select the exact Privy Ethereum wallet and refresh the wallet balance before requesting a quote. Set it to `false` only after Stripe API Onramp access is approved and the session-based path is ready.
