import Image from "next/image";

export function KappaSigmaMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`ks-brand-mark ${className}`.trim()}
      role="img"
      aria-label="KSigdillas · Kappa Sigma Theta-Omega"
    >
      <Image
        src="/ksigdillas-fundraiser-logo.png"
        alt=""
        width={2560}
        height={1440}
        priority
      />
    </span>
  );
}
