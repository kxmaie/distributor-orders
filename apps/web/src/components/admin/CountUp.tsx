import { useEffect, useState } from "react";

export default function CountUp({ value, decimals = 0 }: { value: number; decimals?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setN(value); return; }
    const start = performance.now();
    const from = 0;
    const dur = 700;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - (1 - p) ** 3;
      setN(from + (value - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</>;
}
