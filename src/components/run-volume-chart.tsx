"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ChartPoint = {
  name: string;
  runs: number;
  passed: number;
};

export function RunVolumeChart({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-56 items-center justify-center rounded-md border border-dashed border-border bg-muted text-sm font-semibold text-muted-foreground">
        空状态：暂无运行数据
      </div>
    );
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#eadfd4" vertical={false} />
          <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "#6d6258" }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: "#6d6258" }} width={32} />
          <Tooltip
            cursor={{ fill: "#f4ebe0" }}
            contentStyle={{ borderRadius: 8, borderColor: "#ded4c8" }}
          />
          <Bar dataKey="runs" name="运行数" fill="#8c4f22" radius={[5, 5, 0, 0]} />
          <Bar dataKey="passed" name="通过数" fill="#2f6f65" radius={[5, 5, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
