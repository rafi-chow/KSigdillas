"use client";
import { useEffect, useState } from "react";
export function OrderStatus({
  token,
  pending,
}: {
  token: string;
  pending: boolean;
}) {
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!pending) return;
    let stopped = false;
    let running = false;
    const check = async () => {
      if (running) return;
      running = true;
      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reconcile", token }),
        });
        const data = await response.json();
        if (!stopped && response.ok && data.status !== "pending")
          window.location.reload();
        if (!stopped && !response.ok)
          setNotice(
            "Payment verification is delayed. Your order is saved; retry or contact the organizer.",
          );
      } catch {
        if (!stopped) setNotice("Connection interrupted. Your order is saved.");
      } finally {
        running = false;
      }
    };
    void check();
    const timer = setInterval(() => void check(), 15000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [token, pending]);
  return notice ? <p role="status">{notice}</p> : null;
}
