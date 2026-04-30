import type { CSSProperties } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SaudeMentalCompanyPdfSnapshot } from '@/lib/pdf/buildSaudeMentalCompanyPdfSnapshot';
import type { CourseFunnelStage } from '@/features/saude-mental/typesCourse';

/** Largura/altura em px: `ResponsiveContainer` com % mede o pai off-screen e o Recharts acusa -1. */
const PDF_CHART_W = 620;
const PDF_CHART = { funnelH: 210, evolutionH: 180, radarH: 220 } as const;
const REPORT_PAPER_TINT = '#e5f3ec';

function FunnelChartInner({ funnel }: { funnel: CourseFunnelStage[] }) {
  const data = funnel.map((f) => ({
    name: f.label,
    valor: f.count,
  }));
  return (
    <ResponsiveContainer width={PDF_CHART_W} height={PDF_CHART.funnelH}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ left: 8, right: 16, top: 12, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#d7e2ea" />
        <XAxis type="number" stroke="#475569" style={{ fontSize: 10 }} />
        <YAxis type="category" dataKey="name" stroke="#475569" width={88} style={{ fontSize: 9 }} />
        <Tooltip
          cursor={false}
          contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8 }}
          labelStyle={{ color: '#0f172a' }}
        />
        <Bar dataKey="valor" fill="#34d399" radius={[0, 4, 4, 0]} name="Quantidade" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function EvolutionChartInner({ points }: { points: { tempo: string; score: number }[] }) {
  const data = points.map((p) => ({ momento: p.tempo, score: p.score }));
  return (
    <ResponsiveContainer width={PDF_CHART_W} height={PDF_CHART.evolutionH}>
      <BarChart data={data} margin={{ left: 8, right: 16, top: 12, bottom: 28 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#d7e2ea" />
        <XAxis dataKey="momento" stroke="#475569" style={{ fontSize: 11 }} />
        <YAxis stroke="#475569" domain={[0, 100]} style={{ fontSize: 10 }} />
        <Tooltip
          cursor={false}
          contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8 }}
          formatter={(v) => [`${v ?? '—'}`, 'Score médio (0–100)']}
        />
        <Bar dataKey="score" fill="#38bdf8" radius={[4, 4, 0, 0]} name="Score" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function RadarChartInner({
  dimensions,
  keyName = 'score',
  title,
}: {
  dimensions: Array<Record<string, number | string>>;
  keyName?: string;
  title?: string;
}) {
  const data = dimensions.map((d) => ({
    dimension: String(d.dimension).length > 22 ? `${String(d.dimension).slice(0, 20)}…` : String(d.dimension),
    score: Math.min(100, Math.max(0, Number(d[keyName] ?? 0))),
  }));
  return (
    <div>
      {title ? <p style={{ margin: '0 0 6px', fontSize: 11, color: '#475569' }}>{title}</p> : null}
      <ResponsiveContainer width={PDF_CHART_W} height={PDF_CHART.radarH}>
        <RadarChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
          <PolarGrid stroke="#d7e2ea" />
          <PolarAngleAxis dataKey="dimension" tick={{ fill: '#334155', fontSize: 9 }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 8 }} />
          <Radar name="Score" dataKey="score" stroke="#34d399" fill="#34d399" fillOpacity={0.28} strokeWidth={2} />
          <Tooltip
            cursor={false}
            contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8 }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RadarGeralInner({
  dimensions,
}: {
  dimensions: Array<{ dimension: string; T0: number; T1: number; T2: number }>;
}) {
  const data = dimensions.map((d) => ({
    dimension: d.dimension.length > 22 ? `${d.dimension.slice(0, 20)}…` : d.dimension,
    T0: Math.min(100, Math.max(0, d.T0)),
    T1: Math.min(100, Math.max(0, d.T1)),
    T2: Math.min(100, Math.max(0, d.T2)),
  }));
  return (
    <ResponsiveContainer width={PDF_CHART_W} height={PDF_CHART.radarH}>
      <RadarChart data={data} margin={{ top: 8, right: 20, bottom: 8, left: 20 }}>
        <PolarGrid stroke="#d7e2ea" />
        <PolarAngleAxis dataKey="dimension" tick={{ fill: '#334155', fontSize: 9 }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 8 }} />
        <Radar name="T0" dataKey="T0" stroke="#38bdf8" fill="#38bdf8" fillOpacity={0.08} strokeWidth={2} />
        <Radar name="T1" dataKey="T1" stroke="#34d399" fill="#34d399" fillOpacity={0.08} strokeWidth={2} />
        <Radar name="T2" dataKey="T2" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.08} strokeWidth={2} />
        <Tooltip
          cursor={false}
          contentStyle={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8 }}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export function SaudeMentalPdfChartDeck({ snapshot }: { snapshot: SaudeMentalCompanyPdfSnapshot }) {
  const box: CSSProperties = {
    background: REPORT_PAPER_TINT,
    borderRadius: 8,
    border: '1px solid #cfe4dc',
    padding: 8,
  };
  const emptyNote = (msg: string) => (
    <div style={{ ...box, width: 620, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>{msg}</p>
    </div>
  );
  const dimsForTempo = (tempo: 'T0' | 'T1' | 'T2') => {
    const row = snapshot.perTempo.find((p) => p.tempo === tempo);
    return row?.dimensionsVsT0 ?? [];
  };
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', color: '#0f172a', background: REPORT_PAPER_TINT }}>
      <p style={{ margin: '0 0 8px', fontSize: 11, color: '#475569' }}>Funil (elegíveis → conclusão)</p>
      <div id="sm-pdf-cap-funnel" style={{ ...box, width: 620, height: 210 }}>
        {snapshot.funnel.length > 0 ? (
          <FunnelChartInner funnel={snapshot.funnel} />
        ) : (
          emptyNote('Sem dados de funil')
        )}
      </div>
      <p style={{ margin: '14px 0 8px', fontSize: 11, color: '#475569' }}>Evolução do score médio (0–100) por momento</p>
      <div id="sm-pdf-cap-evolution" style={{ ...box, width: 620, height: 180 }}>
        {snapshot.timeEvolution.length > 0 ? (
          <EvolutionChartInner points={snapshot.timeEvolution} />
        ) : (
          emptyNote('Sem evolução por momento')
        )}
      </div>
      <p style={{ margin: '14px 0 8px', fontSize: 11, color: '#475569' }}>
        Radar geral das dimensões (T0, T1, T2)
      </p>
      <div id="sm-pdf-cap-radar-geral" style={{ ...box, width: 620, height: 220 }}>
        {snapshot.radarSeries.length > 0 ? (
          <RadarGeralInner dimensions={snapshot.radarSeries} />
        ) : (
          emptyNote('Sem dimensões para radar geral')
        )}
      </div>

      <p style={{ margin: '14px 0 8px', fontSize: 11, color: '#475569' }}>Radar T0</p>
      <div id="sm-pdf-cap-radar-t0" style={{ ...box, width: 620, height: 220 }}>
        {dimsForTempo('T0').length > 0 ? (
          <RadarChartInner dimensions={dimsForTempo('T0').map((d) => ({ dimension: d.dimension, score: d.score100 }))} />
        ) : (
          emptyNote('Sem dimensões para T0')
        )}
      </div>

      <p style={{ margin: '14px 0 8px', fontSize: 11, color: '#475569' }}>Radar T1</p>
      <div id="sm-pdf-cap-radar-t1" style={{ ...box, width: 620, height: 220 }}>
        {dimsForTempo('T1').length > 0 ? (
          <RadarChartInner dimensions={dimsForTempo('T1').map((d) => ({ dimension: d.dimension, score: d.score100 }))} />
        ) : (
          emptyNote('Sem dimensões para T1')
        )}
      </div>

      <p style={{ margin: '14px 0 8px', fontSize: 11, color: '#475569' }}>Radar T2</p>
      <div id="sm-pdf-cap-radar-t2" style={{ ...box, width: 620, height: 220 }}>
        {dimsForTempo('T2').length > 0 ? (
          <RadarChartInner dimensions={dimsForTempo('T2').map((d) => ({ dimension: d.dimension, score: d.score100 }))} />
        ) : (
          emptyNote('Sem dimensões para T2')
        )}
      </div>
    </div>
  );
}
