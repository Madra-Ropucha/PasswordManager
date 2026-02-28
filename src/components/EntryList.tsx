import type { Entry } from "../models/types";

type Props = {
  entries: Entry[];
  selectedEntryId: string | null;
  onSelectEntry: (id: string) => void;
};

export function EntryList({ entries, selectedEntryId, onSelectEntry }: Props) {
  return (
    <section className="panel">
      <div className="sectionTitle">Entradas</div>

      {entries.length === 0 ? (
        <div className="empty">No hay resultados.</div>
      ) : (
        <div className="list">
          {entries.map((e) => (
            <button
              key={e.id}
              className={"row " + (e.id === selectedEntryId ? "rowActive" : "")}
              onClick={() => onSelectEntry(e.id)}
            >
              <div className="rowTitle">{e.name}</div>
              <div className="rowSub">{e.username}</div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}