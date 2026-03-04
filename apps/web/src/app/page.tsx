"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

export default function LandingPage() {
  const backImageRef = useRef<HTMLImageElement | null>(null);
  const frontImageRef = useRef<HTMLImageElement | null>(null);

  function warmBackendInBackground() {
    void fetch("/api/backend/health", { cache: "no-store" }).catch(() => undefined);
  }

  useEffect(() => {
    const backImage = backImageRef.current;
    const image = frontImageRef.current;
    if (!image || !backImage) return;
    if (window.matchMedia("(max-width: 1000px)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let currentFrontX = 0;
    let currentFrontY = 0;
    let targetFrontX = 0;
    let targetFrontY = 0;
    let currentBackX = 0;
    let currentBackY = 0;
    let targetBackX = 0;
    let targetBackY = 0;

    const animate = () => {
      currentFrontX += (targetFrontX - currentFrontX) * 0.12;
      currentFrontY += (targetFrontY - currentFrontY) * 0.12;
      currentBackX += (targetBackX - currentBackX) * 0.1;
      currentBackY += (targetBackY - currentBackY) * 0.1;

      image.style.setProperty("--hero-parallax-x", `${currentFrontX.toFixed(2)}px`);
      image.style.setProperty("--hero-parallax-y", `${currentFrontY.toFixed(2)}px`);
      backImage.style.setProperty("--hero-parallax-back-x", `${currentBackX.toFixed(2)}px`);
      backImage.style.setProperty("--hero-parallax-back-y", `${currentBackY.toFixed(2)}px`);
      raf = window.requestAnimationFrame(animate);
    };

    const onMove = (event: MouseEvent) => {
      const nx = (event.clientX / window.innerWidth - 0.5) * 2;
      const ny = (event.clientY / window.innerHeight - 0.5) * 2;
      targetFrontX = -nx * 7;
      targetFrontY = -ny * 7;
      targetBackX = nx * 3;
      targetBackY = 0;
    };

    const onLeave = () => {
      targetFrontX = 0;
      targetFrontY = 0;
      targetBackX = 0;
      targetBackY = 0;
    };

    raf = window.requestAnimationFrame(animate);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const features = [
    {
      title: "Provision",
      description: "Create isolated agent wallets with deterministic identities and policy defaults.",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2H3V7Zm0 4h18v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Zm13 3a1.5 1.5 0 1 0 0 3h2v-3h-2Z" />
        </svg>
      )
    },
    {
      title: "Fund",
      description: "Allocate SOL and SPL balances per agent so strategies operate with isolated risk.",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2 3 6v6c0 5.25 3.45 8.95 9 10 5.55-1.05 9-4.75 9-10V6l-9-4Zm1 5h4v2h-4V7Zm-6 0h4v2H7V7Zm0 4h10v2H7v-2Zm0 4h10v2H7v-2Z" />
        </svg>
      )
    },
    {
      title: "Execute",
      description: "Run automated transactions with guardrails, limits, and protocol-level checks.",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2a6 6 0 0 0-6 6v3H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1V8a6 6 0 0 0-6-6Zm-4 9V8a4 4 0 1 1 8 0v3H8Z" />
        </svg>
      )
    },
    {
      title: "Monitor",
      description: "Inspect live transaction logs, signatures, and execution outcomes in one timeline.",
      icon: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 3h18v2H3V3Zm2 4h14v14H5V7Zm2 2v10h10V9H7Zm2 2h2v6H9v-6Zm4 2h2v4h-2v-4Z" />
        </svg>
      )
    }
  ];

  const edgeItems = [
    {
      title: "Policy-Safe Execution",
      copy: "Each agent action is validated against spend limits and allowed-program controls before it is signed."
    },
    {
      title: "Autonomous Wallet Lifecycle",
      copy: "Provision, fund, run, stop, and restore agent wallets with encrypted key custody and deterministic flows."
    },
    {
      title: "Operator Visibility",
      copy: "Every run is observable via dashboard state, tx log traces, and optional Telegram notifications."
    }
  ];

  return (
    <main className="minimal-landing">
      <header className="minimal-nav container">
        <div className="minimal-brand">
          <Image
            src="/autarchlogo.png"
            alt="Autarch District"
            width={192}
            height={108}
            quality={100}
            priority
            className="minimal-brand-logo"
            style={{ imageRendering: "auto" }}
          />
          <span className="minimal-brand-text">Autarch District</span>
        </div>
        <nav className="minimal-nav-links" aria-label="Primary navigation">
          <Link
            href="https://github.com/Nnadijoshuac/AutarchDistrict#readme"
            className="minimal-nav-link"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </Link>
          <Link href="https://github.com/Nnadijoshuac/AutarchDistrict" className="minimal-nav-link" target="_blank" rel="noreferrer">
            GitHub
          </Link>
          <Link href="/app" className="minimal-btn minimal-btn-primary" onClick={warmBackendInBackground}>
            Launch App
          </Link>
        </nav>
      </header>

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
              <Link href="/app" className="minimal-btn minimal-btn-primary" onClick={warmBackendInBackground}>
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

      <div className="minimal-floating-media" aria-hidden="true">
        <div className="image-stack">
          <Image ref={backImageRef} src="/5.png" alt="" width={520} height={680} className="stack-back" priority />
          <Image ref={frontImageRef} src="/6.png" alt="" width={520} height={680} className="stack-front" priority />
        </div>
      </div>

      <section id="overview" className="overview-section container" aria-label="Platform capabilities">
        <div className="overview-header">
          <p className="edge-kicker">OVERVIEW</p>
          <h2>One control plane for the complete autonomous wallet lifecycle.</h2>
        </div>
        <div className="minimal-strip">
          {features.map((feature, index) => (
            <article key={feature.title} className={`minimal-pill minimal-pill-bento minimal-pill-${index + 1}`}>
              <div className="minimal-pill-icon">{feature.icon}</div>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="edge-section container" aria-label="Hackathon differentiation">
        <div className="edge-header">
          <p className="edge-kicker">WHY AUTARCH DISTRICT</p>
          <h2>Built for real autonomous wallet operations, not a static demo.</h2>
        </div>
        <div className="edge-grid">
          {edgeItems.map((item, index) => (
            <article key={item.title} className={`edge-card edge-card-bento edge-card-${index + 1}`}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-cta container" aria-label="Primary action">
        <div className="landing-cta-card">
          <div>
            <p className="edge-kicker">READY TO TEST</p>
            <h3>Run the full agent wallet flow on Solana devnet.</h3>
          </div>
          <div className="landing-cta-actions">
            <Link href="/app" className="minimal-btn minimal-btn-primary" onClick={warmBackendInBackground}>
              Launch Control Plane
            </Link>
            <Link
              href="https://github.com/Nnadijoshuac/AutarchDistrict#readme"
              className="minimal-btn minimal-btn-secondary"
              target="_blank"
              rel="noreferrer"
            >
              View Integration Guide
            </Link>
          </div>
        </div>
      </section>

      <section className="powered-by container" aria-label="Technology attribution">
        <div className="powered-block">
          <p className="edge-kicker">NETWORK</p>
          <h3>Powered by Solana Devnet</h3>
        </div>
      </section>

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
    </main>
  );
}
