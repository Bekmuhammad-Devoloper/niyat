import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Activity, Server, DollarSign, MessageCircle } from "lucide-react";
import { useAdminAiLogs } from "@/lib/hooks/use-admin-api";

export const Route = createFileRoute("/admin/ai-logs")({
  component: AiLogsPage,
});

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const PAGE_SIZE = 50;

function AiLogsPage() {
  const [provider, setProvider] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [page, setPage] = useState(0);

  const { data, isLoading, isError, error } = useAdminAiLogs({
    provider: provider || undefined,
    endpoint: endpoint || undefined,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  });
  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalCost = data?.totalCost ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] text-foreground">AI loglar</h1>
        <p className="text-[13px] text-tertiary mt-1">
          Barcha AI so'rovlari va xarajatlar
        </p>
      </div>

      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 flex items-start gap-3">
          <Server size={18} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-[13px] text-destructive">
            {error instanceof Error ? error.message : "Ulanmadi"}
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-tertiary">
              Filtrlangan chaqiriqlar
            </p>
            <Activity size={14} className="text-primary" />
          </div>
          <p className="text-[24px] font-serif tabular text-foreground">
            {total.toLocaleString()}
          </p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-tertiary">
              Filtrlangan xarajat
            </p>
            <DollarSign size={14} className="text-primary" />
          </div>
          <p className="text-[24px] font-serif tabular text-foreground">
            ${totalCost.toFixed(4)}
          </p>
        </div>
        <div className="rounded-2xl bg-card border border-border p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] uppercase tracking-wider text-tertiary">
              O'rtacha narx
            </p>
            <MessageCircle size={14} className="text-primary" />
          </div>
          <p className="text-[24px] font-serif tabular text-foreground">
            ${total > 0 ? (totalCost / total).toFixed(5) : "0.00000"}
          </p>
        </div>
      </div>

      {/* Filterlar */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-tertiary">
          Provayder:
        </span>
        {["", "gemini", "openai", "anthropic", "openai-tts"].map((p) => (
          <button
            key={p || "all"}
            type="button"
            onClick={() => {
              setProvider(p);
              setPage(0);
            }}
            className={`px-3 py-1 rounded-md text-[11px] transition ${
              provider === p
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-elevated text-tertiary hover:text-foreground"
            }`}
          >
            {p || "Hammasi"}
          </button>
        ))}
        <span className="ml-3 text-[11px] uppercase tracking-wider text-tertiary">
          Endpoint:
        </span>
        {["", "coach", "tts", "sunnat-simplify"].map((e) => (
          <button
            key={e || "all"}
            type="button"
            onClick={() => {
              setEndpoint(e);
              setPage(0);
            }}
            className={`px-3 py-1 rounded-md text-[11px] transition ${
              endpoint === e
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-elevated text-tertiary hover:text-foreground"
            }`}
          >
            {e || "Hammasi"}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        <table className="w-full">
          <thead className="bg-elevated/50">
            <tr className="text-left text-[10px] uppercase tracking-wider text-tertiary">
              <th className="px-4 py-2.5">Vaqt</th>
              <th className="px-4 py-2.5">User</th>
              <th className="px-4 py-2.5">Provayder</th>
              <th className="px-4 py-2.5 hidden md:table-cell">Endpoint</th>
              <th className="px-4 py-2.5 hidden lg:table-cell">Tokens</th>
              <th className="px-4 py-2.5">Cost</th>
              <th className="px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <p className="text-[13px] text-tertiary">Yuklanyapti...</p>
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <p className="text-[13px] text-tertiary">
                    Bu filtrlar bo'yicha log topilmadi
                  </p>
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="hover:bg-elevated/30 transition">
                  <td className="px-4 py-2.5 text-[12px] text-tertiary tabular">
                    {formatDateTime(l.createdAt)}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-tertiary tabular">
                    {l.userId ? l.userId.slice(0, 8) : "anon"}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-foreground">
                    {l.provider}
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-foreground hidden md:table-cell">
                    {l.endpoint}
                  </td>
                  <td className="px-4 py-2.5 text-[11px] text-tertiary tabular hidden lg:table-cell">
                    {l.inputTokens}↓ / {l.outputTokens}↑
                  </td>
                  <td className="px-4 py-2.5 text-[12px] text-primary tabular">
                    ${l.costUsd.toFixed(5)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`text-[11px] tabular ${
                        l.status >= 200 && l.status < 300
                          ? "text-primary"
                          : "text-destructive"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-tertiary tabular">
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, total)} / {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-md text-[12px] bg-card border border-border text-foreground disabled:opacity-40 transition"
            >
              ← Oldingi
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
              className="px-3 py-1.5 rounded-md text-[12px] bg-card border border-border text-foreground disabled:opacity-40 transition"
            >
              Keyingi →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
