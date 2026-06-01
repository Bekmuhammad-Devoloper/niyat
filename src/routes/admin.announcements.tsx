import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Trash2, AlertCircle } from "lucide-react";
import {
  useAnnouncements,
  useCreateAnnouncement,
  useDeleteAnnouncement,
} from "@/lib/hooks/use-admin-api";

export const Route = createFileRoute("/admin/announcements")({
  component: AnnouncementsPage,
});

function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AnnouncementsPage() {
  const { data, isLoading, isError, error } = useAnnouncements();
  const create = useCreateAnnouncement();
  const del = useDeleteAnnouncement();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "critical">(
    "normal",
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;
    create.mutate(
      { title: title.trim(), body: body.trim(), priority },
      {
        onSuccess: () => {
          toast.success("E'lon yuborildi");
          setTitle("");
          setBody("");
          setPriority("normal");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const announcements = data?.announcements ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-[28px] text-foreground">E'lonlar</h1>
        <p className="text-[13px] text-tertiary mt-1">
          Barcha foydalanuvchilarga yuborilgan xabarlar
        </p>
      </div>

      {/* Yangi e'lon formasi */}
      <form
        onSubmit={submit}
        className="rounded-2xl bg-card border border-border p-5 space-y-3"
      >
        <div className="flex items-center gap-2 mb-2">
          <Megaphone size={16} className="text-primary" />
          <h2 className="text-[15px] font-semibold text-foreground">
            Yangi e'lon
          </h2>
        </div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sarlavha"
          maxLength={100}
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-[14px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Xabar matni..."
          rows={4}
          maxLength={500}
          className="w-full bg-elevated border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-tertiary outline-none focus:border-primary/60 resize-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-tertiary">Muhimlik:</span>
            {(["normal", "important", "critical"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPriority(p)}
                className={`px-3 py-1 rounded-md text-[11px] transition ${
                  priority === p
                    ? p === "critical"
                      ? "bg-destructive text-white font-semibold"
                      : p === "important"
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "bg-foreground/10 text-foreground font-semibold"
                    : "bg-elevated text-tertiary"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="submit"
            disabled={!title.trim() || !body.trim() || create.isPending}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-[13px] font-semibold disabled:opacity-50 transition"
          >
            {create.isPending ? "Yuborilmoqda..." : "Yuborish"}
          </button>
        </div>
      </form>

      {isError && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-[13px] text-destructive">
          {error instanceof Error ? error.message : "Backend ulanmadi"}
        </div>
      )}

      {/* Ro'yxat */}
      <div>
        <h2 className="text-[15px] font-semibold text-foreground mb-3">
          Mavjud e'lonlar ({announcements.length})
        </h2>
        {isLoading ? (
          <p className="text-[13px] text-tertiary">Yuklanyapti...</p>
        ) : announcements.length === 0 ? (
          <div className="rounded-2xl bg-card border border-border p-8 text-center">
            <p className="text-[13px] text-tertiary font-serif italic">
              Hozircha e'lon yo'q
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {announcements.map((a) => (
              <li
                key={a.id}
                className={`rounded-xl border p-4 ${
                  a.priority === "critical"
                    ? "bg-destructive/5 border-destructive/30"
                    : a.priority === "important"
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {a.priority === "critical" && (
                        <AlertCircle size={14} className="text-destructive" />
                      )}
                      <p className="text-[14px] font-semibold text-foreground">
                        {a.title}
                      </p>
                      <span className="text-[10px] uppercase tracking-wider text-tertiary">
                        {a.priority}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-muted-foreground leading-relaxed">
                      {a.body}
                    </p>
                    <p className="text-[10px] text-tertiary tabular mt-2">
                      {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`"${a.title}" e'lonini o'chiramizmi?`)) {
                        del.mutate(a.id, {
                          onSuccess: () => toast.info("E'lon o'chirildi"),
                          onError: (err) => toast.error(err.message),
                        });
                      }
                    }}
                    aria-label="O'chirish"
                    className="text-tertiary hover:text-destructive transition shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
