export const money = (v: string | number) =>
  `${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ج.م`;

const dtf = new Intl.DateTimeFormat("ar-EG-u-nu-latn", { dateStyle: "medium", timeStyle: "short" });
export const dateTime = (iso: string) => dtf.format(new Date(iso));

export const formatCurrency = money;
export const formatDate = dateTime;

export const UNIT_LABEL = { piece: "قطعة", meter: "متر", sqm: "م²" } as const;
