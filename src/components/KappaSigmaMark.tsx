import Image from "next/image";

export function KappaSigmaMark({
  className = "",
}: {
  className?: string;
}) {
  return (
    <span
      className={`ks-brand-mark ${className}`.trim()}
      aria-label="Kappa Sigma Theta-Omega"
    >
      <Image
        src="/kappa-sigma-round-logo.png"
        alt=""
        width={994}
        height={994}
        priority
      />
      <span>Θ-Ω</span>
    </span>
  );
}
