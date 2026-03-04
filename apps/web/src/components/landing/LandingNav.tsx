import Image from "next/image";
import Link from "next/link";

type LandingNavProps = {
  onWarmBackend: () => void;
};

export function LandingNav({ onWarmBackend }: LandingNavProps) {
  return (
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
        <Link href="/app" className="minimal-btn minimal-btn-primary" onClick={onWarmBackend}>
          Launch App
        </Link>
      </nav>
    </header>
  );
}
