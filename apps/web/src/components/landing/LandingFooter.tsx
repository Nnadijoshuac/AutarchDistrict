import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="landing-footer container">
      <p>Autarch District · Agentic Wallet Infrastructure</p>
      <div className="landing-footer-links">
        <Link href="https://github.com/Nnadijoshuac/AutarchDistrict" target="_blank" rel="noreferrer">
          GitHub
        </Link>
        <Link href="https://solana.com/docs" target="_blank" rel="noreferrer">
          Solana Docs
        </Link>
      </div>
    </footer>
  );
}
