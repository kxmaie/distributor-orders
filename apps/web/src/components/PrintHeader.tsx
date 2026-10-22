import { dateTime } from "../lib/format";

/** Letterhead shown only when printing (always the light logo: paper is white). */
export default function PrintHeader({ title = "فاتورة طلب" }: { title?: string }) {
  return (
    <div className="mb-4 hidden items-center justify-between border-b border-line/30 pb-3 print:flex">
      <img src="/logo-light.png" alt="Turk-pen" className="h-14 w-auto" />
      <div className="text-end text-sm">
        <p className="font-display font-bold">Turk-pen — UPVC Accessories</p>
        <p>{title}</p>
        <p className="text-muted">{dateTime(new Date().toISOString())}</p>
      </div>
    </div>
  );
}
