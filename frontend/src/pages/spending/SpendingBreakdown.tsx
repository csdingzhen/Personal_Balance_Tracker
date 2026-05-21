import { useRef, useEffect, useState } from 'react';
import { sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyNode as D3Node, SankeyLink as D3Link } from 'd3-sankey';
import { Plus } from 'lucide-react';
import { api } from '../../api/client';

// ── Category colour helpers ────────────────────────────────────────────────────
const CAT_ICONS: Record<string, string> = {
  'Groceries': '🛒', 'Dining': '🍽️', 'Entertainment': '🎬',
  'Shopping': '🛍️', 'Transportation': '🚗', 'Housing': '🏠',
  'Health & Fitness': '💪', 'Utilities': '⚡', 'Income': '💰',
  'Travel': '✈️', 'Healthcare': '💊', 'Insurance': '🛡️',
  'Transfer': '↔️', 'Spending': '💳', 'Other': '📦',
};

const CAT_HUES: Record<string, number> = {
  'Income': 155, 'Housing': 240, 'Groceries': 140, 'Dining': 35,
  'Entertainment': 290, 'Shopping': 200, 'Transportation': 50,
  'Health & Fitness': 175, 'Travel': 210, 'Utilities': 220,
  'Healthcare': 10, 'Insurance': 270, 'Spending': 200,
};

function hue(name: string) { return CAT_HUES[name] ?? 200; }
function nodeColor(name: string, a = 1) {
  return `oklch(0.72 0.13 ${hue(name)} / ${a})`;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ── d3-sankey chart component ─────────────────────────────────────────────────
type MyNode = { name: string };
type MyLink = { source: number; target: number; value: number };
type ComputedNode = D3Node<MyNode, MyLink> & { x0: number; x1: number; y0: number; y1: number };
type ComputedLink = D3Link<MyNode, MyLink>;

function SankeyChart({ nodes, links }: { nodes: MyNode[]; links: MyLink[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(700);
  const H = 300;
  const M = { top: 10, right: 160, bottom: 10, left: 130 };
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string; value: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(e => setW(e[0].contentRect.width));
    obs.observe(el);
    setW(el.offsetWidth);
    return () => obs.disconnect();
  }, []);

  if (nodes.length === 0 || links.length === 0) {
    return <div ref={ref} className="h-[300px] flex items-center justify-center text-text-dim text-sm">No data for this month yet</div>;
  }

  const layout = sankey<MyNode, MyLink>()
    .nodeWidth(12)
    .nodePadding(18)
    .extent([[M.left, M.top], [w - M.right, H - M.bottom]]);

  let graph: { nodes: ComputedNode[]; links: ComputedLink[] };
  try {
    graph = layout({
      nodes: nodes.map(d => ({ ...d })),
      links: links.map(d => ({ ...d })),
    }) as { nodes: ComputedNode[]; links: ComputedLink[] };
  } catch {
    return <div ref={ref} className="h-[300px] flex items-center justify-center text-text-dim text-sm">Unable to render diagram</div>;
  }

  const pathFn = sankeyLinkHorizontal();

  return (
    <div ref={ref} className="relative">
      <svg width={w} height={H} style={{ overflow: 'visible' }}>

        {/* Links */}
        {graph.links.map((link, i) => {
          const srcName = (link.source as ComputedNode).name;
          const tgtName = (link.target as ComputedNode).name;
          return (
            <path key={i}
              d={pathFn(link as Parameters<typeof pathFn>[0]) ?? ''}
              fill="none"
              stroke={nodeColor(srcName === 'Spending' ? tgtName : srcName, 0.45)}
              strokeWidth={Math.max(1, link.width ?? 1)}
              onMouseEnter={e => setTooltip({
                x: e.clientX, y: e.clientY,
                label: `${srcName} → ${tgtName}`,
                value: typeof link.value === 'number' ? link.value : 0,
              })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'default' }}
            />
          );
        })}

        {/* Nodes */}
        {graph.nodes.map((node, i) => {
          const { x0, x1, y0, y1, name, depth } = node;
          const nw = x1 - x0, nh = y1 - y0;
          const isLeft   = (depth ?? 0) === 0;
          const isCenter = name === 'Spending';
          const isRight  = !isLeft && !isCenter;
          const fill = nodeColor(name, 0.95);

          return (
            <g key={i}
              onMouseEnter={e => setTooltip({ x: e.clientX, y: e.clientY, label: name, value: node.value ?? 0 })}
              onMouseLeave={() => setTooltip(null)}
              style={{ cursor: 'default' }}>

              <rect x={x0} y={y0} width={nw} height={nh} fill={fill} rx={3} />

              {/* Node label */}
              {isLeft && (
                <text x={x0 - 8} y={y0 + nh / 2}
                  textAnchor="end" dominantBaseline="middle"
                  fill="oklch(0.82 0.005 70)" fontSize={11} fontFamily="Geist Mono">
                  {name}
                </text>
              )}
              {isCenter && nh > 16 && (
                <text x={x0 + nw / 2} y={y0 + nh / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="oklch(0.155 0.006 60)" fontSize={11} fontFamily="Geist Mono" fontWeight="700">
                  {name}
                </text>
              )}
              {isRight && (
                <text x={x1 + 8} y={y0 + nh / 2}
                  textAnchor="start" dominantBaseline="middle"
                  fill="oklch(0.82 0.005 70)" fontSize={11} fontFamily="Geist Mono">
                  {name}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div className="fixed z-50 pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}>
          <div className="bg-surface border border-border-soft rounded-lg px-3 py-2 shadow-xl">
            <p className="text-text-2 text-xs">{tooltip.label}</p>
            <p className="num text-sm font-semibold text-text mt-0.5">{fmt(tooltip.value)}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
interface BreakdownData {
  sankey: { nodes: MyNode[]; links: MyLink[] };
  totalIncome: number;
  totalExpense: number;
  budgets: { id: string; category: string; monthlyLimit: number; currentSpend: number; daysRemaining: number }[];
  daysInMonth: number;
  dayOfMonth: number;
}

export default function SpendingBreakdown() {
  const [data, setData] = useState<BreakdownData | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newLimit, setNewLimit] = useState('');

  useEffect(() => {
    api.get<BreakdownData>('/spending/breakdown').then(setData);
  }, []);

  if (!data) return (
    <div className="p-7 flex items-center gap-3 text-text-dim text-sm">
      <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      Loading...
    </div>
  );

  async function addBudget() {
    if (!newCat || !newLimit) return;
    await api.post('/budgets', { category: newCat, monthlyLimit: parseFloat(newLimit) });
    const fresh = await api.get<BreakdownData>('/spending/breakdown');
    setData(fresh);
    setShowAdd(false); setNewCat(''); setNewLimit('');
  }

  const { budgets, daysInMonth, dayOfMonth } = data;
  const pacePct = (dayOfMonth / daysInMonth) * 100;

  return (
    <div className="p-7 space-y-6 max-w-[1200px]">

      {/* Sankey flow */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <p className="text-text font-medium">Money Flow · This Month</p>
            <p className="text-text-dim text-xs mt-0.5">
              Income {fmt(data.totalIncome)} → Spending {fmt(data.totalExpense)}
            </p>
          </div>
        </div>
        <SankeyChart nodes={data.sankey.nodes} links={data.sankey.links} />
      </section>

      {/* Budget cards */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-text font-medium">Budgets</p>
          <button onClick={() => setShowAdd(true)} className="btn text-xs h-[30px] px-3 gap-1.5">
            <Plus size={13} /> Add Budget
          </button>
        </div>

        {showAdd && (
          <div className="card p-4 mb-4 flex items-end gap-3">
            <div className="flex-1">
              <p className="eyebrow mb-1.5">Category</p>
              <input value={newCat} onChange={e => setNewCat(e.target.value)}
                className="w-full bg-bg-deep border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="e.g. Groceries" />
            </div>
            <div className="w-36">
              <p className="eyebrow mb-1.5">Monthly Limit</p>
              <input type="number" value={newLimit} onChange={e => setNewLimit(e.target.value)}
                className="w-full bg-bg-deep border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
                placeholder="500" />
            </div>
            <button onClick={addBudget} className="btn btn-primary h-[38px] px-4">Save</button>
            <button onClick={() => setShowAdd(false)} className="btn h-[38px] px-3">Cancel</button>
          </div>
        )}

        {budgets.length === 0 ? (
          <div className="card p-8 text-center text-text-dim text-sm">
            No budgets set. Click "Add Budget" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {budgets.map(b => {
              const pct = b.monthlyLimit > 0 ? Math.min((b.currentSpend / b.monthlyLimit) * 100, 100) : 0;
              const isOver = b.currentSpend > b.monthlyLimit;
              const isWarn = pct >= 80 && !isOver;
              const h = CAT_HUES[b.category] ?? 200;
              const barColor = isOver ? 'oklch(0.72 0.16 28)' : isWarn ? 'oklch(0.83 0.13 80)' : `oklch(0.75 0.13 ${h})`;

              return (
                <div key={b.id} className="card px-5 py-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{CAT_ICONS[b.category] ?? '📦'}</span>
                    <span className="text-text font-medium text-sm flex-1">{b.category}</span>
                    <span className={`num text-sm font-medium ${isOver ? 'text-negative' : isWarn ? 'text-warn' : 'text-text-muted'}`}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="relative w-full h-1.5 bg-surface-hi rounded-full mb-3">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-text-dim rounded-full"
                      style={{ left: `${pacePct}%` }} title="Today's pace" />
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="num text-text-muted">{fmt(b.currentSpend)} spent</span>
                    <span className="num text-text-dim">of {fmt(b.monthlyLimit)} · {b.daysRemaining}d left</span>
                  </div>
                  {isOver && (
                    <p className="num text-negative text-xs mt-1.5">Over by {fmt(b.currentSpend - b.monthlyLimit)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

