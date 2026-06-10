"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface FormatDatum {
  name: string;
  value: number;
}

const COLORS = [
  "hsl(var(--primary))",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

export function FormatDistribution({ data }: { data: FormatDatum[] }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={
                ((value: number | string) => [
                  `${value} (${((Number(value) / total) * 100).toFixed(1)}%)`,
                  "Count",
                ]) as never
              }
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} iconType="circle" verticalAlign="bottom" />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="text-muted-foreground mt-2 text-center text-xs">
        {total.toLocaleString()} total conversions
      </div>
    </div>
  );
}
