import { useEffect, useMemo, useState } from "react";
import type { Category, Entry } from "../models/types";

type Props = {
  categories: Category[];
  entries: Entry[];
  activeCategoryId: string;
  selectedEntryId: string | null;
  onSelectCategory: (id: string) => void;
  onSelectEntry: (entryId: string, categoryId: string) => void;
  onCreateCategory: () => void;
  onCreateEntry: () => void;
  onDeleteCategory: () => void;
  onDeleteEntry: () => void;
};

type TreeNode = Category & { children: TreeNode[] };

function buildTree(categories: Category[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  for (const c of categories) byId.set(c.id, { ...c, children: [] });

  const roots: TreeNode[] = [];
  for (const c of categories) {
    const node = byId.get(c.id)!;
    const parentId = c.parentId;
    if (parentId && byId.has(parentId)) byId.get(parentId)!.children.push(node);
    else roots.push(node);
  }

  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    for (const n of nodes) sortRec(n.children);
  };
  sortRec(roots);

  return roots;
}

function ancestorPath(categories: Category[], id: string): string[] {
  const byId = new Map(categories.map((c) => [c.id, c] as const));
  const out: string[] = [];
  let cur = byId.get(id);
  while (cur?.parentId) {
    out.push(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return out;
}

function entriesByCategory(entries: Entry[]) {
  const map = new Map<string, Entry[]>();
  for (const e of entries) {
    const arr = map.get(e.categoryId) ?? [];
    arr.push(e);
    map.set(e.categoryId, arr);
  }
  for (const arr of map.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
  return map;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={"treeChevron " + (open ? "treeChevronOpen" : "")}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M9 6l6 6-6 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  // Icono tipo "folder" con trazo grueso (similar al estilo de la captura)
  if (open) {
    return (
      <svg className="treeFolder" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M3.5 9.5h17.5c.9 0 1.6.8 1.4 1.7l-1.6 8.4c-.1.7-.8 1.2-1.5 1.2H6.2c-.7 0-1.3-.5-1.5-1.2L2.2 10.9c-.2-1 .6-1.9 1.3-1.4z"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M3.8 9.5V7.8c0-1.2 1-2.2 2.2-2.2h3.4l1.7 1.7h7.1c1.2 0 2.2 1 2.2 2.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg className="treeFolder" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3.8 8.2c0-1.2 1-2.2 2.2-2.2h3.4l1.7 1.7h7.1c1.2 0 2.2 1 2.2 2.2v8.3c0 1.2-1 2.2-2.2 2.2H6c-1.2 0-2.2-1-2.2-2.2V8.2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg className="treeNote" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7 3.8h8.2L20.2 8v12.2c0 1.1-.9 2-2 2H7c-1.1 0-2-.9-2-2V5.8c0-1.1.9-2 2-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M15.2 3.8V8H20.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sidebar({
  categories,
  entries,
  activeCategoryId,
  selectedEntryId,
  onSelectCategory,
  onSelectEntry,
  onCreateCategory,
  onCreateEntry,
  onDeleteCategory,
  onDeleteEntry,
}: Props) {
  const tree = useMemo(() => buildTree(categories), [categories]);
  const byCat = useMemo(() => entriesByCategory(entries), [entries]);

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    return new Set(ancestorPath(categories, activeCategoryId));
  });

  useEffect(() => {
    const path = ancestorPath(categories, activeCategoryId);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of path) next.add(id);
      return next;
    });
  }, [activeCategoryId, categories]);

  // Si hay un post-it seleccionado, asegúrate de que su carpeta esté abierta para que se vea en el árbol.
  useEffect(() => {
    if (!selectedEntryId) return;
    const e = entries.find((x) => x.id === selectedEntryId);
    if (!e) return;
    const path = ancestorPath(categories, e.categoryId);
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const id of path) next.add(id);
      next.add(e.categoryId);
      return next;
    });
  }, [selectedEntryId, entries, categories]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (node: TreeNode, depth: number) => {
    const entriesHere = byCat.get(node.id) ?? [];
    const hasChildren = node.children.length > 0 || entriesHere.length > 0;
    const isOpen = expanded.has(node.id);
    const isActive = node.id === activeCategoryId;

    return (
      <div key={node.id} role="treeitem" aria-expanded={hasChildren ? isOpen : undefined}>
        <div
          className={"treeRow " + (isActive ? "treeRowActive" : "")}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          {hasChildren ? (
            <button
              className="treeCaretBtn"
              aria-label={isOpen ? "Contraer" : "Expandir"}
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              type="button"
            >
              <Chevron open={isOpen} />
            </button>
          ) : (
            <div className="treeCaretSpacer" />
          )}

          <div className="treeIcon" aria-hidden="true">
            <FolderIcon open={hasChildren && isOpen} />
          </div>

          <button
            className="treeLabelBtn"
            onClick={() => onSelectCategory(node.id)}
            type="button"
          >
            {node.name}
          </button>
        </div>

        {hasChildren && isOpen && (
          <div className="treeChildren" role="group">
            {node.children.map((ch) => renderNode(ch, depth + 1))}

            {entriesHere.length > 0 && (
              <div className="treeEntryGroup">
                {entriesHere.map((e) => {
                  const isEntryActive = e.id === selectedEntryId;
                  return (
                    <div
                      key={e.id}
                      role="treeitem"
                      aria-selected={isEntryActive || undefined}
                      className={"treeRow treeRowEntry " + (isEntryActive ? "treeRowEntryActive" : "")}
                      style={{ paddingLeft: 8 + (depth + 1) * 16 + 26 }}
                    >
                      <div className="treeEntryIcon" aria-hidden="true">
                        <NoteIcon />
                      </div>
                      <button
                        className="treeEntryBtn"
                        type="button"
                        onClick={() => onSelectEntry(e.id, e.categoryId)}
                        title={e.username}
                      >
                        <span className="treeEntryName">{e.name}</span>
                        <span className="treeEntryUser">{e.username}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="sidebar">
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: '#fafafa', padding: '8px 0' }}>              <div className="brand">📓 Libreta</div>

        <div className="sidebarTools" aria-label="Acciones">


          <button className="toolBtn" type="button" onClick={onCreateCategory} title="Nueva carpeta">
            ＋ Carpeta
          </button>
          <button className="toolBtn" type="button" onClick={onCreateEntry} title="Nuevo post-it">
            ＋ Post-it
          </button>
          <button className="toolBtn" type="button" onClick={onDeleteCategory} title="Borrar carpeta">
            🗑 Carpeta
          </button>
          <button
            className={"toolBtn " + (!selectedEntryId ? "toolBtnDisabled" : "")}
            type="button"
            onClick={onDeleteEntry}
            disabled={!selectedEntryId}
            title={selectedEntryId ? "Borrar post-it" : "Selecciona un post-it para borrarlo"}
          >
            🗑 Post-it
          </button>
        </div>

        <div className="sectionTitle">Categorías</div>
        <div className="tree" role="tree" aria-label="Categorías"></div>
      </div>
      {tree.map((n) => renderNode(n, 0))}
    </aside>
  );
}
