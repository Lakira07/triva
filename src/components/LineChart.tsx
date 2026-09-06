interface LineChartProps {
  data: { label: string; values: Record<string, number> }[];
  series: { key: string; label: string; color: string }[];
  min?: number;
  max?: number;
}

export default function LineChart({ data, series, min = 1, max = 5 }: LineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Ingen data att visa ännu
      </div>
    );
  }

  const width = 100;
  const height = 100;
  const padding = 8;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;
  const yScale = (val: number) => padding + chartH - ((val - min) / (max - min)) * chartH;
  const xPos = (i: number) => padding + i * xStep;

  const gridLines = [1, 2, 3, 4, 5];

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ aspectRatio: '2 / 1' }}>
        {/* Grid lines */}
        {gridLines.map((g) => (
          <g key={g}>
            <line
              x1={padding}
              y1={yScale(g)}
              x2={width - padding}
              y2={yScale(g)}
              stroke="#e5e7eb"
              strokeWidth="0.3"
              strokeDasharray="1"
            />
            <text
              x={padding - 1}
              y={yScale(g) + 1}
              fontSize="2.5"
              fill="#9ca3af"
              textAnchor="end"
            >
              {g}
            </text>
          </g>
        ))}

        {/* Lines */}
        {series.map((s) => {
          const points = data
            .map((d, i) => `${xPos(i)},${yScale(d.values[s.key] ?? 0)}`)
            .join(' ');
          return (
            <g key={s.key}>
              <polyline
                points={points}
                fill="none"
                stroke={s.color}
                strokeWidth="0.8"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {data.map((d, i) => (
                <circle
                  key={i}
                  cx={xPos(i)}
                  cy={yScale(d.values[s.key] ?? 0)}
                  r="1.2"
                  fill={s.color}
                />
              ))}
            </g>
          );
        })}

        {/* X labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={xPos(i)}
            y={height - 2}
            fontSize="2.5"
            fill="#9ca3af"
            textAnchor="middle"
          >
            {d.label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs text-gray-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
