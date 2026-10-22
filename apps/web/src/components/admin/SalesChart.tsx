import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { date: string; orders: number; total: string | number };

export default function SalesChart({ data }: { data: Point[] }) {
  const rows = data.map((d) => ({
    ...d,
    label: d.date.slice(5),
    totalNum: Number(d.total),
  }));
  return (
    <div className="h-64 w-full" dir="ltr">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgb(var(--line) / .08)" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "rgb(var(--muted))", fontSize: 12 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip
            contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line) / .15)", borderRadius: 12, color: "rgb(var(--ink))" }}
            formatter={(v, name) => [v, name === "totalNum" ? "الإجمالي" : "الطلبات"]}
            labelFormatter={(_, p) => p?.[0]?.payload?.date ?? ""}
          />
          <Bar dataKey="totalNum" fill="rgb(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
