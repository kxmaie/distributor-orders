import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { dateTime } from "../lib/format";
import type { CompanyProfile } from "../lib/types";

export default function PrintHeader({ title = "فاتورة طلب" }: { title?: string }) {
  const profile = useQuery({ queryKey: ["company-profile"], queryFn: () => api.get<CompanyProfile>("/company-profile"), staleTime: 60_000 });
  const company = profile.data;
  return (
    <div className="mb-4 hidden items-center justify-between gap-4 border-b border-line/30 pb-3 print:flex">
      {company?.logoUrl ? <img src={company.logoUrl} alt={company.name} className="h-16 max-w-36 object-contain" /> : <img src="/logo-light.png" alt={company?.name ?? "Turk-pen"} className="h-14 w-auto" />}
      <div className="text-end text-sm">
        <p className="font-display font-bold">{company?.name ?? "Turk-pen"}</p>
        {company?.address && <p>{company.address}</p>}
        <p>{[company?.phone && `هاتف: ${company.phone}`, company?.taxNumber && `الرقم الضريبي: ${company.taxNumber}`, company?.commercialRegister && `السجل التجاري: ${company.commercialRegister}`].filter(Boolean).join(" · ")}</p>
        <p>{title}</p>
        <p className="text-muted">{dateTime(new Date().toISOString())}</p>
      </div>
    </div>
  );
}
