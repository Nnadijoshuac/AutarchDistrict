"use client";

import { useEffect, useRef, type RefObject } from "react";

type HeroParallaxRefs = {
  backImageRef: RefObject<HTMLImageElement | null>;
  frontImageRef: RefObject<HTMLImageElement | null>;
};

export function useHeroParallax(): HeroParallaxRefs {
  const backImageRef = useRef<HTMLImageElement | null>(null);
  const frontImageRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const backImage = backImageRef.current;
    const frontImage = frontImageRef.current;
    if (!frontImage || !backImage) return;
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

      frontImage.style.setProperty("--hero-parallax-x", `${currentFrontX.toFixed(2)}px`);
      frontImage.style.setProperty("--hero-parallax-y", `${currentFrontY.toFixed(2)}px`);
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

  return { backImageRef, frontImageRef };
}
