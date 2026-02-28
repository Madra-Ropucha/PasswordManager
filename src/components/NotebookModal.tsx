import { useEffect, useMemo, useState } from "react";
import type { Entry } from "../models/types";
import { PostItCard } from "./PostItCard";

type Props = {
  entry: Entry | null;
  entriesInCategory: Entry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onClose: () => void;
  onDeleteEntry: (id: string) => void;
  onCreateEntryInCategory: (categoryId: string) => void;
};

export function NotebookModal({
  entry,
  entriesInCategory,
  selectedEntryId,
  onSelectEntry,
  onClose,
  onDeleteEntry,
  onCreateEntryInCategory,
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
      {/*
        Importante: las pestañas van como HERMANOS de la libreta.
        Así podemos poner capas (z-index) como pedías:
          - post-it activo:  1
          - libreta:         0
          - post-its no act.: -1
      */}
      <div className="notebookStack" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modalTabsEdge" aria-label="Pestañas">
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

        <div className="notebook">
          <div className="notebookHeader">
            <div className="notebookTitle">📓 {entry.name}</div>
            <div className="notebookHeaderActions">
              <button
                className="iconBtn"
                type="button"
                onClick={() => onCreateEntryInCategory(entry.categoryId)}
                aria-label="Nuevo post-it"
                title="Nuevo post-it"
              >
                ＋
              </button>
              <button
                className="iconBtn"
                type="button"
                onClick={() => onDeleteEntry(entry.id)}
                aria-label="Borrar post-it"
                title="Borrar post-it"
              >
                🗑
              </button>
              <button className="iconBtn" type="button" onClick={onClose} aria-label="Cerrar" title="Cerrar">
                ✕
              </button>
            </div>
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
                <div className="v mono">
                  {reveal ? entry.password : "••••••••••••"}
                </div>
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