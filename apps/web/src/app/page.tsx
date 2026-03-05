"use client";

import { EdgeSection } from "../components/landing/EdgeSection";
import { FloatingMedia } from "../components/landing/FloatingMedia";
import { HeroSection } from "../components/landing/HeroSection";
import { LandingFooter } from "../components/landing/LandingFooter";
import { LandingNav } from "../components/landing/LandingNav";
import { NetworkSection } from "../components/landing/NetworkSection";
import { OverviewSection } from "../components/landing/OverviewSection";
import { ReadySection } from "../components/landing/ReadySection";
import { CustomHeroVideo } from "../components/landing/CustomHeroVideo";
import { useHeroParallax } from "../components/landing/useHeroParallax";

export default function LandingPage() {
  const { backImageRef, frontImageRef } = useHeroParallax();

  function warmBackendInBackground() {
    void fetch("/api/backend/health", { cache: "no-store" }).catch(() => undefined);
  }

  return (
    <main className="minimal-landing">
      <LandingNav onWarmBackend={warmBackendInBackground} />
      <HeroSection onWarmBackend={warmBackendInBackground} />
      <FloatingMedia backImageRef={backImageRef} frontImageRef={frontImageRef} />
      <OverviewSection />
      <CustomHeroVideo />
      <EdgeSection />
      <ReadySection onWarmBackend={warmBackendInBackground} />
      <NetworkSection />
      <LandingFooter />
    </main>
  );
}
