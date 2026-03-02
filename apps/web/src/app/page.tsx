import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <main className="morf-root">
      <div className="morf-full">
        <header className="morf-topbar">
          <div className="morf-brand-block">
            <div className="morf-brand-dot">A</div>
            <span className="morf-nav-link">Products</span>
            <span className="morf-nav-link">Catalog</span>
            <span className="morf-nav-link">Resources</span>
          </div>
          <div className="morf-brand-block">
            <span className="morf-nav-link">Pro Access</span>
            <span className="morf-nav-link">Sign in</span>
            <Link href="/app" className="morf-pill morf-pill-light">
              Open App
            </Link>
          </div>
        </header>

        <section className="morf-stage">
          <div className="morf-gradient-overlay" />
          <h1 className="morf-wordmark">AUTARCH DISTRICT</h1>

          <article className="morf-copy">
            <h2>Autonomous Wallet Infrastructure</h2>
            <p>
              Autarch District is a creative protocol layer for orchestrating agent wallets, policy-safe execution
              flows, and
              interactive onchain operations.
            </p>
            <div className="morf-actions">
              <Link href="/app" className="morf-pill morf-pill-orange">
                Explore Ecosystem
              </Link>
              <a href="#features" className="morf-pill morf-pill-light">
                Open Studio
              </a>
            </div>
          </article>

          <div className="morf-hero-wrap">
            <Image
              src="/hero.png"
              alt="Autarch District hero visual"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 52vw"
              className="morf-hero-image"
            />
          </div>
        </section>

        <section id="features" className="morf-feature-row">
          <article className="morf-feature-card">
            <h3>Policy-Governed Agents</h3>
            <p>Enforce spend controls, allowlists, and deterministic transaction boundaries for every autonomous run.</p>
          </article>
          <article className="morf-feature-card">
            <h3>Execution Studio</h3>
            <p>Configure setup, rounds, and swap amounts, then run complete multi-agent simulations in one flow.</p>
          </article>
          <article className="morf-feature-card">
            <h3>Live Visibility</h3>
            <p>Inspect wallet state, signatures, and event logs in real time through a unified operational dashboard.</p>
          </article>
        </section>
      </div>
    </main>
  );
}
