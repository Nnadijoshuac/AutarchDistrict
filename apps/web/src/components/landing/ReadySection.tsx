import Link from "next/link";

type ReadySectionProps = {
  onWarmBackend: () => void;
};

export function ReadySection({ onWarmBackend }: ReadySectionProps) {
  return (
    <section className="landing-cta container" aria-label="Primary action">
      <div className="landing-cta-card">
        <div>
          <p className="edge-kicker">READY TO TEST</p>
          <h3>Run the full agent wallet flow on Solana devnet.</h3>
        </div>
        <div className="landing-cta-actions">
          <Link href="/app" className="minimal-btn minimal-btn-primary" onClick={onWarmBackend}>
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
  );
}
