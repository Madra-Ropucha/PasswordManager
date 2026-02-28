import { useEffect, useMemo, useState } from "react";
import type { Entry } from "../models/types";
import { PostItCard } from "./PostItCard";

type Props = {
  entry: Entry | null;
  entriesInCategory: Entry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onClose: () => void;
};

export function NotebookModal({
  entry,
  entriesInCategory,
  selectedEntryId,
  onSelectEntry,
  onClose,
}: Props) {
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    if (!entry) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [entry, onClose]);

  useEffect(() => {
    setReveal(false);
  }, [entry?.id]);

  const updatedText = useMemo(() => {
    if (!entry) return "";
    return new Date(entry.updatedAt).toLocaleString();
  }, [entry]);

  if (!entry) return null;

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="notebook" onMouseDown={(e) => e.stopPropagation()}>
        <div className="notebookHeader">
          <div className="notebookTitle">📓 {entry.name}</div>
          <button className="iconBtn" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </div>

        {/* Post-its sobresaliendo dentro del modal */}
        <div className="modalTabsEdge">
          {entriesInCategory.map((e) => (
            <PostItCard
              key={e.id}
              entry={e}
              onOpen={onSelectEntry}
              variant="tab"
              active={e.id === selectedEntryId}
            />
          ))}
        </div>

        <div className="notebookPages">
          <div className="notebookPage">
            <KV k="Servicio" v={entry.name} />
            <KV k="Usuario" v={entry.username} />
            <KV k="URL" v={entry.url ?? "—"} />
            <KV k="Actualizado" v={updatedText} />
          </div>

          <div className="notebookPage">
            <div className="kv">
              <div className="k">Contraseña</div>
              <div className="v mono">{reveal ? entry.password : "••••••••••••"}</div>
            </div>

            <div className="btnRow">
              <button
                className="btn"
                onPointerDown={() => setReveal(true)}
                onPointerUp={() => setReveal(false)}
                onPointerLeave={() => setReveal(false)}
                onPointerCancel={() => setReveal(false)}
              >
                Mantener para ver
              </button>
            </div>

            <KV k="Notas" v={entry.notes ?? "—"} />
          </div>
        </div>
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="kv">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}