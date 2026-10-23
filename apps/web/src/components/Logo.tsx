import { useUI } from "../store/ui";

/** Turk-pen logo. Navy lettering flips to a light ink on the dark theme; the teal roof/“pen” stays brand teal. */
export default function Logo({ className = "h-9", alt = "Turk-pen — UPVC Accessories" }: { className?: string; alt?: string }) {
  const theme = useUI((s) => s.theme);
  return (
    <span className="brand-logo group relative inline-flex items-center justify-center">
      <span aria-hidden className="brand-logo__aura absolute -inset-x-3 -inset-y-2 rounded-full bg-primary/15 blur-xl" />
      <img src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"} alt={alt} width={520} height={212} decoding="async" className={className + " brand-logo__image w-auto select-none relative"} draggable={false} />
    </span>
  );
}
