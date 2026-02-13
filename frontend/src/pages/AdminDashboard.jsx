import React, { useEffect, useState } from "react";
import { getAnalyticsSummary } from "../lib/api";
import { useAdmin } from "../context/AdminContext";

export default function AdminDashboard() {
  const { isAdmin } = useAdmin();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      setBusy(true);
      try { setData(await getAnalyticsSummary(days)); } finally { setBusy(false); }
    })();
  }, [days]);

  if (!isAdmin) return <div className="p-6">403 — Admin only</div>;
  if (busy && !data) return <div className="p-6">Loading…</div>;
  if (!data) return <div className="p-6">No data yet.</div>;

  const { summary, top_paths, top_artworks, timeseries } = data;

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-6 lg:px-8 py-10 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Analytics</h1>
        <select className="border rounded px-2 py-1" value={days} onChange={e => setDays(Number(e.target.value))}>
          {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>{d} days</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Events" value={summary?.total_events ?? 0} />
        <StatCard label="Pageviews" value={summary?.pageviews ?? 0} />
        <StatCard label="Unique sessions" value={summary?.unique_sessions ?? 0} />
      </div>

      <Section title="Top pages">
        <Table rows={top_paths} cols={[["Path","path"],["Views","c"]]} />
      </Section>

      <Section title="Top artworks (views)">
        <Table rows={top_artworks} cols={[["Artwork","title"],["ID","artwork_id"],["Views","c"]]} />
      </Section>

      <Section title="Pageviews by day">
        <Table rows={timeseries} cols={[["Day","day"],["Pageviews","pageviews"]]} />
      </Section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="p-4 border rounded">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
function Section({ title, children }) {
  return <div><h2 className="text-xl font-semibold mb-2">{title}</h2>{children}</div>;
}
function Table({ rows = [], cols = [] }) {
  return (
    <div className="overflow-auto border rounded">
      <table className="w-full text-sm">
        <thead><tr>{cols.map(([h]) => <th key={h} className="text-left p-2 border-b">{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r,i) => (
            <tr key={i} className="odd:bg-muted/30">
              {cols.map(([_, k]) => <td key={k} className="p-2 border-b">{r?.[k] ?? ""}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
