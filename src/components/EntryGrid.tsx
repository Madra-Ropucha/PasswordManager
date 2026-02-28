import type { Entry } from "../models/types";
import { PostItCard } from "./PostItCard";

type Props = {
  notebookTitle: string;
  entries: Entry[];
  onOpenEntry: (id: string) => void;
};

export function EntryGrid({ notebookTitle, entries, onOpenEntry }: Props) {
  return (
    <section className="notebookPreview">
      <div className="notebookCover">
        <div className="notebookCoverTitle">📓 {notebookTitle}</div>
        <div className="notebookCoverHint">Post-its (click para abrir)</div>
      </div>

      <div className="notebookCoverPage">
  <div className="notebookCoverPageTitle">
    <div>PASSWORDS</div>
    <div className="notebookCoverPageSub">your vault</div>
  </div>
</div>

      <div className="tabsEdge">
        {entries.map((e) => (
          <PostItCard key={e.id} entry={e} onOpen={onOpenEntry} variant="tab" />
        ))}
      </div>

      {entries.length === 0 && <div className="empty">No hay entradas.</div>}
    </section>
  );
}