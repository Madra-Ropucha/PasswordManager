import type { Entry } from "../models/types";

type Props = {
  entry: Entry | null;
};

export function EntryDetail({ entry }: Props) {
  return (
    <section className="panel">
      <div className="sectionTitle">Detalle</div>

      {!entry ? (
        <div className="empty">Selecciona una entrada para verla.</div>
      ) : (
        <div className="card">
          <KV k="Servicio" v={entry.name} />
          <KV k="Usuario" v={entry.username} />
          <KV k="Contraseña" v={entry.password} />
          <KV k="Notas" v={entry.notes ?? "—"} />
        </div>
      )}
    </section>
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