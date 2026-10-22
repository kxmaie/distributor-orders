import { useUI } from "../store/ui";

/** Turk-pen logo. Navy lettering flips to a light ink on the dark theme; the teal roof/“pen” stays brand teal. */
export default function Logo({ className = "h-9", alt = "Turk-pen — UPVC Accessories" }: { className?: string; alt?: string }) {
  const theme = useUI((s) => s.theme);
  return <img src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"} alt={alt} width={520} height={212} decoding="async" className={`${className} w-auto select-none`} draggable={false} />;
}
