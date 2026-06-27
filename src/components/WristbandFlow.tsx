import { QrCode, ScanLine, Ticket, Watch } from "lucide-react";

const steps = [
  { icon: Ticket, title: "Buy your ticket", copy: "Choose your tier on Eventbrite." },
  { icon: QrCode, title: "Get confirmation", copy: "Your QR code arrives by email." },
  { icon: ScanLine, title: "Check in", copy: "Show your code at the door." },
  { icon: Watch, title: "Grab a wristband", copy: "Your color matches your food tier." },
] as const;

export function WristbandFlow() {
  return (
    <div className="flow">
      {steps.map(({ icon: Icon, title, copy }, index) => (
        <article className="flow-step" key={title}>
          <span className="step-number">0{index + 1}</span>
          <div className="flow-icon"><Icon /></div>
          <h3>{title}</h3>
          <p>{copy}</p>
          {index < steps.length - 1 && <span className="flow-arrow">→</span>}
        </article>
      ))}
    </div>
  );
}
