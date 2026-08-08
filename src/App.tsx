import { useMemo, useState } from "react";
import { usePrivy, useSendTransaction, useWallets } from "@privy-io/react-auth";
import { encodeFunctionData, parseUnits } from "viem";

const deliveryAssets = [
  ["BTC", "Bitcoin", "#f7931a", "bitcoin"],
  ["ETH", "Ethereum", "#8d9cff", "ethereum"],
  ["USDT", "Tether", "#26a17b", "ethereum"],
  ["USDC", "USD Coin", "#2775ca", "ethereum"],
  ["SOL", "Solana", "#b56cff", "solana"],
  ["BNB", "BNB Chain", "#f3ba2f", "bsc"],
  ["XRP", "XRP Ledger", "#d7e4e8", "xrp"],
  ["SUI", "Sui", "#6fbcf0", "sui"],
  ["DOGE", "Dogecoin", "#c2a633", "doge"],
  ["AVAX", "Avalanche", "#e84142", "avalanchec"],
] as const;

type FundingAsset = "USD" | "USDC";
type Quote = {
  quoteId: string;
  fundingAsset: FundingAsset;
  fundingAmount: number;
  fundingNetwork: string;
  deliveryAsset: string;
  deliveryNetwork: string;
  deliveryAmount: number;
  provider: string;
  providerFee: number;
  networkFee: number;
  totalRepayment: number;
  repaymentAsset: string;
  loanAmount: number;
  loanAsset: string;
  route: { collateral: string; loan: string; swap: string };
  expiresAt: string;
  mode: "live";
};

type Onramp = {
  sessionId: string;
  clientSecret: string;
  redirectUrl: string | null;
  status: string;
  walletAddress?: string;
  transactionDetails?: { destination_amount?: string | number | null } | null;
};

type Application = {
  applicationId?: string;
  loanId: string;
  fundingWalletAddress?: string;
  status: string | null;
  expectedLoanAmount: string;
  deliveryAddress?: string;
  repaymentAddress?: string;
  collateral: { asset: string; network: string; amount: string; depositAddress: string | null; depositExtraId: string | null };
  swap: { id?: string; payinAddress?: string } | null;
  nextStep: string;
};

const endpoint = import.meta.env.VITE_UNIVERSAL_LENDING_URL as string | undefined;
const usdcEthereum = "0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as `0x${string}`;
const erc20TransferAbi = [{
  name: "transfer",
  type: "function",
  stateMutability: "nonpayable",
  inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
  outputs: [{ name: "success", type: "bool" }],
}] as const;

export default function App() {
  const { ready, authenticated, login, user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { sendTransaction } = useSendTransaction();
  const [fundingAsset, setFundingAsset] = useState<FundingAsset>("USDC");
  const [amount, setAmount] = useState("500");
  const [deliveryAsset, setDeliveryAsset] = useState("ETH");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [repaymentAddress, setRepaymentAddress] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [onramp, setOnramp] = useState<Onramp | null>(null);
  const [completedOnrampSessionId, setCompletedOnrampSessionId] = useState("");
  const [application, setApplication] = useState<Application | null>(null);
  const [agreedToTos, setAgreedToTos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const selectedAsset = useMemo(() => deliveryAssets.find(([symbol]) => symbol === deliveryAsset), [deliveryAsset]);
  const walletAddress = wallets.find((candidate) => /^0x[a-fA-F0-9]{40}$/.test(candidate.address))?.address || user?.wallet?.address || "";
  const evmDelivery = ["ETH", "USDT", "USDC", "BNB", "AVAX"].includes(deliveryAsset);
  const effectiveDeliveryAddress = deliveryAddress.trim() || (evmDelivery ? walletAddress : "");
  const effectiveRepaymentAddress = repaymentAddress.trim() || walletAddress;

  async function callApi(body: Record<string, unknown>) {
    if (!endpoint) throw new Error("Set VITE_UNIVERSAL_LENDING_URL before using live lending.");
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    if (user?.id) headers["x-privy-user-id"] = user.id;
    const response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(body) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const provider = typeof payload?.provider === "string" ? `${payload.provider}: ` : "";
      const providerCode = typeof payload?.providerCode === "string" ? ` (${payload.providerCode})` : "";
      throw new Error(`${provider}${payload?.error || "The lending service rejected the request."}${providerCode}`);
    }
    return payload;
  }

  async function startOnramp() {
    if (!authenticated) {
      await login();
      return;
    }
    if (!walletAddress) {
      setMessage("Connect your Privy Ethereum wallet before opening Stripe Onramp.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      setCompletedOnrampSessionId("");
      const payload = await callApi({ action: "onramp", fundingAmount: amount, walletAddress, repaymentAddress: effectiveRepaymentAddress });
      setOnramp(payload.onramp as Onramp);
      setMessage("Stripe created the USDC purchase session. Complete it, then refresh the session status.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create the Stripe Onramp session.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshOnramp() {
    if (!onramp) return;
    setLoading(true);
    try {
      const payload = await callApi({ action: "status", stripeOnrampSessionId: onramp.sessionId });
      const next = { ...onramp, ...payload.onramp } as Onramp;
      setOnramp(next);
      if (next.status === "fulfillment_complete") {
        const received = Number(next.transactionDetails?.destination_amount || 0);
        if (received > 0) {
          setFundingAsset("USDC");
          setAmount(String(received));
          setCompletedOnrampSessionId(next.sessionId);
          setOnramp(null);
          setMessage(`Stripe delivered ${received} USDC to your Privy wallet. Request a live loan quote next.`);
        } else {
          setMessage("Stripe marked the session complete but did not report a delivered USDC amount. Verify the transaction before requesting a loan.");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh Stripe Onramp status.");
    } finally {
      setLoading(false);
    }
  }

  async function getQuote() {
    if (!authenticated) {
      await login();
      return;
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 25) {
      setMessage("Enter at least 25 to request a quote.");
      return;
    }
    if (fundingAsset === "USD") {
      await startOnramp();
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const deliveryNetwork = selectedAsset?.[3] || "ethereum";
      const payload = await callApi({ action: "quote", fundingAsset, fundingAmount: amount, fundingNetwork: "ETH", deliveryAsset, deliveryNetwork, walletAddress, stripeOnrampSessionId: completedOnrampSessionId || undefined });
      setQuote(payload.quote as Quote);
      setApplication(null);
      setAgreedToTos(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to request a live quote.");
    } finally {
      setLoading(false);
    }
  }

  async function startLoan() {
    if (!quote || !effectiveDeliveryAddress) {
      setMessage("Connect Privy or enter a delivery wallet before starting the loan.");
      return;
    }
    if (!agreedToTos) {
      setMessage("Confirm the provider terms before creating the live loan.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const payload = await callApi({
        action: "create",
        quoteId: quote.quoteId,
        fundingAsset: "USDC",
        fundingAmount: quote.fundingAmount,
        fundingNetwork: quote.fundingNetwork,
        walletAddress,
        deliveryAsset: quote.deliveryAsset,
        deliveryNetwork: quote.deliveryNetwork,
        deliveryAddress: effectiveDeliveryAddress,
        repaymentAddress: effectiveRepaymentAddress,
        stripeOnrampSessionId: completedOnrampSessionId || undefined,
        agreedToTos: true,
      });
      setApplication(payload.application as Application);
      setMessage("The live CoinRabbit loan and ChangeNOW route are ready. Send the requested USDC collateral.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start the live loan.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshLoanStatus() {
    if (!application) return;
    setLoading(true);
    try {
      const payload = await callApi({ action: "status", loanId: application.loanId, changeNowId: application.swap?.id || undefined });
      const loan = payload.loan as { status?: string } | null;
      setApplication((current) => current ? { ...current, status: loan?.status || current.status } : current);
      setMessage("Provider status refreshed.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh provider status.");
    } finally {
      setLoading(false);
    }
  }

  async function sendCollateral() {
    if (!application?.collateral.depositAddress || application.collateral.network !== "ETH") {
      setMessage("Use the returned provider deposit instructions for this network.");
      return;
    }
    const wallet = wallets.find((candidate) => candidate.address.toLowerCase() === (application.fundingWalletAddress || walletAddress).toLowerCase());
    if (!wallet) {
      setMessage("The wallet that received the USDC collateral is not connected. Reconnect that wallet before sending collateral.");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(application.collateral.depositAddress)) {
      setMessage("CoinRabbit returned an invalid Ethereum deposit address. Do not send collateral.");
      return;
    }
    setLoading(true);
    try {
      await wallet.switchChain(1);
      const data = encodeFunctionData({
        abi: erc20TransferAbi,
        functionName: "transfer",
        args: [application.collateral.depositAddress as `0x${string}`, parseUnits(application.collateral.amount, 6)],
      });
      const transaction = await sendTransaction({ to: usdcEthereum, data, value: 0n, chainId: 1 }, { address: wallet.address });
      try {
        await callApi({ action: "record_collateral", applicationId: application.applicationId, collateralTxHash: transaction.hash });
        setMessage(`USDC collateral transaction submitted (${transaction.hash.slice(0, 10)}…). Use refresh status after confirmations.`);
      } catch {
        setMessage(`USDC was submitted (${transaction.hash.slice(0, 10)}…), but the lending record could not be updated. Keep this transaction hash and refresh status.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "USDC transfer was not submitted.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand"><span className="brand-mark">L</span><span>Lending Agent</span></div>
        <div className="nav-actions"><span className="status-dot" /> Live routing {authenticated ? <span>{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span> : <button className="ghost-button" onClick={() => void login()} disabled={!ready}>Connect Privy</button>}</div>
      </nav>

      <section className="hero">
        <div className="eyebrow">UNIVERSAL LENDING · PRIVY HACKATHON</div>
        <h1>Fund in dollars.<br /><em>Receive any asset.</em></h1>
        <p className="hero-copy">Stripe moves dollars into your Privy wallet as USDC. CoinRabbit creates the loan, and ChangeNOW routes the proceeds to the asset you choose.</p>
      </section>

      <section className="workspace">
        <div className="panel request-panel">
          <div className="panel-heading"><div><span className="step">01</span><h2>Set your funding</h2></div><span className="live-pill">LIVE PROVIDERS</span></div>
          <div className="field-label">I want to fund with</div>
          <div className="segmented">
            {(["USD", "USDC"] as FundingAsset[]).map((asset) => <button key={asset} className={fundingAsset === asset ? "selected" : ""} onClick={() => { setFundingAsset(asset); setOnramp(null); setCompletedOnrampSessionId(""); setQuote(null); setApplication(null); setAgreedToTos(false); }}>{asset}<small>{asset === "USD" ? "Stripe Onramp" : "Privy wallet"}</small></button>)}
          </div>
          <label className="field-label" htmlFor="amount">Funding amount</label>
          <div className="amount-input"><span>{fundingAsset}</span><input id="amount" inputMode="decimal" value={amount} onChange={(event) => { setAmount(event.target.value); setCompletedOnrampSessionId(""); setQuote(null); setApplication(null); setAgreedToTos(false); }} /><span className="amount-suffix">≈ ${Number(amount || 0).toLocaleString()}</span></div>
          <div className="route-details">
            <div className="route-details-heading"><span>SETTLEMENT DETAILS</span><small>USDC collateral on Ethereum</small></div>
            <label className="field-label" htmlFor="delivery-address">Delivery wallet</label>
            <input className="address-input" id="delivery-address" value={deliveryAddress} onChange={(event) => { setDeliveryAddress(event.target.value); setQuote(null); setApplication(null); }} placeholder={walletAddress || "Connect Privy first"} spellCheck={false} />
            <label className="field-label" htmlFor="repayment-address">Repayment / return wallet <span>OPTIONAL</span></label>
            <input className="address-input" id="repayment-address" value={repaymentAddress} onChange={(event) => { setRepaymentAddress(event.target.value); setQuote(null); setApplication(null); setAgreedToTos(false); }} placeholder="Same as Privy Ethereum wallet" spellCheck={false} />
            <p className="route-note">Stripe delivers USDC to the same Privy Ethereum wallet it is bound to. Keep USDC for collateral and ETH for network fees before creating the loan.</p>
          </div>
          <div className="field-label asset-label"><span>Deliver to me as</span><span className="asset-count">10 ASSETS</span></div>
          <div className="asset-grid">
            {deliveryAssets.map(([symbol, name, color]) => <button key={symbol} className={`asset-card ${deliveryAsset === symbol ? "selected" : ""}`} onClick={() => { setDeliveryAsset(symbol); setQuote(null); setApplication(null); setAgreedToTos(false); }}><span className="asset-icon" style={{ background: `${color}20`, color }}>{symbol.slice(0, 1)}</span><span><strong>{symbol}</strong><small>{name}</small></span></button>)}
          </div>
          <button className="primary-button" onClick={() => void getQuote()} disabled={loading}>{loading ? "Calling live providers…" : fundingAsset === "USD" ? "Open Stripe USDC Onramp" : `Get ${selectedAsset?.[0] ?? deliveryAsset} quote`}<span>→</span></button>
          {message && <p className="message">{message}</p>}
        </div>

        <div className="panel quote-panel">
          <div className="panel-heading"><div><span className="step">02</span><h2>Your live route</h2></div><span className="quote-lock">⌁</span></div>
          {onramp && fundingAsset === "USD" && <div className="quote-content">
            <div className="quote-result"><span className="result-label">STRIPE ONRAMP</span><strong>{onramp.status.replaceAll("_", " ")}</strong><span className="result-sub">USDC → your Privy Ethereum wallet</span></div>
            {onramp.redirectUrl ? <a className="secondary-button" href={onramp.redirectUrl}>Continue in Stripe Onramp <span>↗</span></a> : <p className="message">Stripe did not return a hosted checkout URL for this session. Contact Stripe Onramp support or switch to USDC funding.</p>}
            <button className="secondary-button" onClick={() => void refreshOnramp()} disabled={loading}>Refresh Stripe status <span>↻</span></button>
          </div>}
          {!onramp && !quote && <div className="empty-quote"><div className="empty-orbit">◎</div><h3>Live quote, then live loan.</h3><p>USDC quotes call CoinRabbit and ChangeNOW. USD opens Stripe’s USDC Onramp first.</p><div className="provider-row"><span>Stripe</span><span>→</span><span>CoinRabbit</span><span>→</span><span>ChangeNOW</span></div></div>}
          {quote && <div className="quote-content">
            <div className="quote-result"><span className="result-label">ESTIMATED DELIVERY</span><strong>{quote.deliveryAmount.toFixed(8)} {quote.deliveryAsset}</strong><span className="result-sub">to your Privy wallet · live provider quote</span></div>
            <div className="breakdown"><div><span>Collateral</span><strong>{quote.fundingAmount.toFixed(2)} {quote.fundingAsset}</strong></div><div><span>Provider route</span><strong>{quote.provider}</strong></div><div><span>Loan proceeds</span><strong>{quote.loanAmount.toFixed(6)} {quote.loanAsset}</strong></div><div><span>Estimated repayment</span><strong>{quote.totalRepayment.toFixed(6)} {quote.repaymentAsset}</strong></div></div>
            <div className="expiry">Quote expires {new Date(quote.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}<span>LIVE</span></div>
            {!application ? <div className="loan-confirmation"><label className="consent-row"><input type="checkbox" checked={agreedToTos} onChange={(event) => setAgreedToTos(event.target.checked)} /><span>I agree to the live provider terms and understand this creates a real loan application.</span></label><button className="secondary-button" onClick={() => void startLoan()} disabled={loading || !agreedToTos}>Create CoinRabbit loan + ChangeNOW swap <span>→</span></button></div> : <div className="application-box"><strong>Collateral deposit ready · {application.status || "pending"}</strong><small>{application.collateral.depositAddress || "Waiting for provider address"}</small><button className="secondary-button" onClick={() => void sendCollateral()} disabled={loading}>Send USDC collateral <span>↗</span></button><button className="secondary-button" onClick={() => void refreshLoanStatus()} disabled={loading}>Refresh provider status <span>↻</span></button></div>}
          </div>}
          <div className="trust-note"><span>◆</span> Privy signs user transfers; provider credentials stay in Supabase.</div>
        </div>
      </section>

      <footer><span>Built for `privy-home-irl-sf-2026`</span><span>USD / USDC → BTC · ETH · USDT · USDC · SOL · BNB · XRP · SUI · DOGE · AVAX</span></footer>
    </main>
  );
}
