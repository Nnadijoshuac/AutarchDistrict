import Link from "next/link";

type HeroSectionProps = {
  onWarmBackend: () => void;
};

export function HeroSection({ onWarmBackend }: HeroSectionProps) {
  return (
    <section className="minimal-hero-shell">
      <div className="minimal-hero container">
        <div className="minimal-copy">
          <p className="minimal-kicker">AGENT WALLET INFRASTRUCTURE</p>
          <h1>
            <span className="hero-line">Financial Infrastructure</span>
            <span className="hero-line">for Autonomous Agents</span>
          </h1>
          <p className="minimal-subtext">
            Create and fund agent wallets, watch them execute trades from one dashboard.
          </p>
          <div className="minimal-actions">
            <Link href="/app" className="minimal-btn minimal-btn-primary" onClick={onWarmBackend}>
              Launch App
            </Link>
            <Link
              href="https://github.com/Nnadijoshuac/AutarchDistrict#readme"
              className="minimal-btn minimal-btn-secondary"
              target="_blank"
              rel="noreferrer"
            >
              Read Docs
            </Link>
          </div>
          <a href="#overview" className="minimal-text-link">
            Explore capabilities
          </a>
        </div>
      </div>
    </section>
  );
}
