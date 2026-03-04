import Image from "next/image";

type FloatingMediaProps = {
  backImageRef: React.RefObject<HTMLImageElement | null>;
  frontImageRef: React.RefObject<HTMLImageElement | null>;
};

export function FloatingMedia({ backImageRef, frontImageRef }: FloatingMediaProps) {
  return (
    <div className="minimal-floating-media" aria-hidden="true">
      <div className="image-stack">
        <Image ref={backImageRef} src="/5.png" alt="" width={520} height={680} className="stack-back" priority />
        <Image ref={frontImageRef} src="/6.png" alt="" width={520} height={680} className="stack-front" priority />
      </div>
    </div>
  );
}
