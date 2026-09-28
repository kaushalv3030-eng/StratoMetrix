import { useMemo } from 'react';
import type { GridPoint, BustPrediction } from '@/lib/supabase';
import type { GridBustSummary } from '@/lib/mlEngine';

interface WorldMapProps {
  gridSummaries: GridBustSummary[];
  selectedGridId: string | null;
  onSelectGrid: (gridId: string) => void;
  horizonDay: number;
}

// Equirectangular projection: lat/lon → SVG x/y
// Map bounds: lon [-180, 180], lat [85, -60]
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 500;
const LON_MIN = -180;
const LON_MAX = 180;
const LAT_MIN = -60;
const LAT_MAX = 85;

function project(lon: number, lat: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * MAP_WIDTH;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * MAP_HEIGHT;
  return { x, y };
}

// Simplified continent silhouettes as SVG paths (stylized, not geodetic)
const CONTINENT_PATHS = [
  // North America
  'M 80 80 Q 60 120 70 160 Q 80 200 100 220 Q 130 240 160 230 Q 200 240 230 210 Q 250 180 240 140 Q 220 100 180 85 Q 140 75 110 78 Z',
  // South America
  'M 240 240 Q 220 280 230 330 Q 240 380 270 400 Q 300 380 310 340 Q 300 290 280 250 Q 260 235 240 240 Z',
  // Europe
  'M 460 100 Q 440 130 450 160 Q 470 175 500 170 Q 530 165 540 140 Q 535 110 510 95 Q 480 90 460 100 Z',
  // Africa
  'M 470 175 Q 450 210 460 260 Q 470 310 500 340 Q 530 350 550 320 Q 560 270 545 220 Q 520 180 490 175 Q 480 175 470 175 Z',
  // Asia
  'M 540 90 Q 520 130 540 170 Q 570 195 620 200 Q 680 195 730 175 Q 770 155 780 120 Q 760 85 700 80 Q 620 75 580 82 Q 555 85 540 90 Z',
  // Australia
  'M 760 310 Q 740 340 750 370 Q 780 385 820 375 Q 850 360 840 330 Q 815 305 780 305 Q 770 305 760 310 Z',
  // India peninsula
  'M 620 180 Q 605 210 615 240 Q 635 250 645 225 Q 640 195 625 180 Z',
  // Japan
  'M 760 140 Q 770 155 780 150 Q 775 135 765 132 Z',
  // UK / Ireland
  'M 440 105 Q 430 118 435 128 Q 448 130 452 118 Q 450 108 440 105 Z',
];

function riskColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'critical': return '#ef4444';
    case 'high': return '#f97316';
    case 'moderate': return '#f59e0b';
    case 'low': return '#22c55e';
    default: return '#48709a';
  }
}

function probColor(prob: number): string {
  if (prob < 0.15) return '#22c55e';
  if (prob < 0.30) return '#84cc16';
  if (prob < 0.45) return '#eab308';
  if (prob < 0.60) return '#f59e0b';
  if (prob < 0.75) return '#f97316';
  return '#ef4444';
}

function probGlow(prob: number): string {
  if (prob < 0.15) return 'rgba(34,197,94,0.3)';
  if (prob < 0.30) return 'rgba(132,204,22,0.3)';
  if (prob < 0.45) return 'rgba(234,179,8,0.35)';
  if (prob < 0.60) return 'rgba(245,158,11,0.4)';
  if (prob < 0.75) return 'rgba(249,115,22,0.5)';
  return 'rgba(239,68,68,0.6)';
}

export function WorldMap({ gridSummaries, selectedGridId, onSelectGrid, horizonDay }: WorldMapProps) {
  const dots = useMemo(() => {
    return gridSummaries.map((gs) => {
      const pred = gs.predictions.find((p) => p.horizon_day === horizonDay);
      const prob = pred?.bust_probability ?? gs.maxProbability;
      const { x, y } = project(gs.gridPoint.longitude, gs.gridPoint.latitude);
      const isSelected = gs.gridPoint.id === selectedGridId;
      const dotRadius = 5 + prob * 8;
      return { gs, x, y, prob, isSelected, dotRadius, pred };
    });
  }, [gridSummaries, horizonDay, selectedGridId]);

  return (
    <div className="relative w-full h-full">
      <svg
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(14,165,233,0.06)" />
            <stop offset="100%" stopColor="rgba(14,165,233,0)" />
          </radialGradient>
          <filter id="dotBlur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        {/* Background grid */}
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="url(#mapGlow)" />

        {/* Latitude/longitude grid lines */}
        {Array.from({ length: 13 }, (_, i) => {
          const x = (i / 12) * MAP_WIDTH;
          return <line key={`v${i}`} x1={x} y1={0} x2={x} y2={MAP_HEIGHT} stroke="rgba(72,112,154,0.06)" strokeWidth={0.5} />;
        })}
        {Array.from({ length: 7 }, (_, i) => {
          const y = (i / 6) * MAP_HEIGHT;
          return <line key={`h${i}`} x1={0} y1={y} x2={MAP_WIDTH} y2={y} stroke="rgba(72,112,154,0.06)" strokeWidth={0.5} />;
        })}

        {/* Equator */}
        {(() => {
          const eq = project(0, 0);
          return <line x1={0} y1={eq.y} x2={MAP_WIDTH} y2={eq.y} stroke="rgba(14,165,233,0.12)" strokeWidth={0.8} strokeDasharray="4 4" />;
        })()}

        {/* Continents */}
        <g>
          {CONTINENT_PATHS.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="rgba(45,72,104,0.35)"
              stroke="rgba(72,112,154,0.25)"
              strokeWidth={0.5}
            />
          ))}
        </g>

        {/* Heatmap halos for high-risk points */}
        <g filter="url(#dotBlur)">
          {dots
            .filter((d) => d.prob > 0.3)
            .map((d) => (
              <circle
                key={`halo-${d.gs.gridPoint.id}`}
                cx={d.x}
                cy={d.y}
                r={d.dotRadius * 2.5}
                fill={probGlow(d.prob)}
                opacity={0.6}
              />
            ))}
        </g>

        {/* Grid point dots */}
        <g>
          {dots.map((d) => (
            <g
              key={d.gs.gridPoint.id}
              className="grid-dot"
              onClick={() => onSelectGrid(d.gs.gridPoint.id)}
            >
              {d.isSelected && (
                <circle
                  cx={d.x}
                  cy={d.y}
                  r={d.dotRadius + 6}
                  fill="none"
                  stroke={probColor(d.prob)}
                  strokeWidth={1.5}
                  opacity={0.6}
                  className="animate-ping-slow"
                />
              )}
              <circle
                cx={d.x}
                cy={d.y}
                r={d.dotRadius}
                fill={probColor(d.prob)}
                stroke={d.isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)'}
                strokeWidth={d.isSelected ? 2 : 1}
                opacity={0.9}
              />
              {d.isSelected && (
                <g>
                  <rect
                    x={d.x + 12}
                    y={d.y - 28}
                    width={130}
                    height={36}
                    rx={6}
                    fill="rgba(10,25,41,0.95)"
                    stroke={probColor(d.prob)}
                    strokeWidth={1}
                  />
                  <text x={d.x + 20} y={d.y - 14} fill="#e8eef5" fontSize={11} fontWeight={600} className="font-sans">
                    {d.gs.gridPoint.region.split(',')[0]}
                  </text>
                  <text x={d.x + 20} y={d.y - 1} fill={probColor(d.prob)} fontSize={14} fontWeight={700} className="font-mono">
                    {(d.prob * 100).toFixed(1)}% bust
                  </text>
                </g>
              )}
            </g>
          ))}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 glass-panel-light rounded-xl p-3 flex items-center gap-3">
        <span className="text-xs text-storm-400 font-medium uppercase tracking-wider">Bust Probability</span>
        <div className="flex items-center gap-1.5">
          {[
            { label: '0%', color: '#22c55e' },
            { label: '30%', color: '#eab308' },
            { label: '50%', color: '#f59e0b' },
            { label: '70%', color: '#f97316' },
            { label: '90%+', color: '#ef4444' },
          ].map((s) => (
            <div key={s.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full" style={{ background: s.color }} />
              <span className="text-xs text-storm-400">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export { riskColor, probColor, probGlow };
