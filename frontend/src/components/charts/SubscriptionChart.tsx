import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

export interface SubscriptionStatusPoint {
  name: string;
  value: number;
  color: string;
}

export interface SubscriptionChartProps {
  data: SubscriptionStatusPoint[];
  height?: number;
}

export const SubscriptionChart: React.FC<SubscriptionChartProps> = ({ data, height = 300 }) => {
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="w-full flex flex-col items-center">
      <div style={{ width: '100%', height }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={65}
              outerRadius={95}
              paddingAngle={3}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0].payload as SubscriptionStatusPoint;
                  const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
                  return (
                    <div className="bg-white/95 backdrop-blur-xl border border-slate-200 p-2.5 rounded-lg shadow-xl  text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="font-semibold text-slate-800 ">{item.name}:</span>
                        <span className="font-semibold text-slate-900 ">
                          {item.value} ({percentage}%)
                        </span>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
            Total
          </span>
          <span className="text-2xl font-semibold text-slate-900 tracking-tight">{total}</span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 w-full mt-2 text-xs">
        {data.map((item) => (
          <div
            key={item.name}
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-50 "
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-slate-600 truncate">{item.name}</span>
            <span className="ml-auto font-semibold text-slate-900 ">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
