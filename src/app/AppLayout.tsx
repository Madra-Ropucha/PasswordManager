import { useEffect, useMemo, useState } from "react";
import { seedCategories, seedEntries } from "../data/seed";
import type { Entry } from "../models/types";
import { Sidebar } from "../components/Sidebar";
import { SearchBar } from "../components/SearchBar";
import { EntryGrid } from "../components/EntryGrid";
import { NotebookModal } from "../components/NotebookModal";
import { CreateItemModal, type CreateItemState } from "../components/CreateItemModal";

const LS_CATEGORIES = "notebook_categories_v1";
const LS_ENTRIES = "notebook_entries_v1";

function safeLoad<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeSave(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin-op (si el storage está lleno o bloqueado, la app sigue funcionando)
  }
}

function newId(prefix: string) {
  // @ts-expect-error - crypto puede no existir en algunos entornos
  const uuid = typeof crypto !== "undefined" && crypto?.randomUUID ? crypto.randomUUID() : null;
  return uuid ?? `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function collectDescendants(categories: { id: string; parentId?: string }[], rootId: string): string[] {
  const childrenByParent = new Map<string, string[]>();
  for (const c of categories) {
    if (!c.parentId) continue;
    const arr = childrenByParent.get(c.parentId) ?? [];
    arr.push(c.id);
    childrenByParent.set(c.parentId, arr);
  }

  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    const kids = childrenByParent.get(cur) ?? [];
    for (const k of kids) stack.push(k);
  }
  return out;
}

export function AppLayout() {
  const [categories, setCategories] = useState(() => safeLoad<typeof seedCategories>(LS_CATEGORIES) ?? seedCategories);
  const [entries, setEntries] = useState(() => safeLoad<typeof seedEntries>(LS_ENTRIES) ?? seedEntries);

  // Elige como categoría inicial la primera que tenga entradas (o la primera disponible)
  const [activeCategoryId, setActiveCategoryId] = useState(() => {
    const idsWithEntries = new Set((safeLoad<typeof seedEntries>(LS_ENTRIES) ?? seedEntries).map((e) => e.categoryId));
    const cats = safeLoad<typeof seedCategories>(LS_CATEGORIES) ?? seedCategories;
    return cats.find((c) => idsWithEntries.has(c.id))?.id ?? cats[0].id;
  });
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [createState, setCreateState] = useState<CreateItemState | null>(null);

  // Persistencia local (para que no se pierda al recargar)
  useEffect(() => {
    safeSave(LS_CATEGORIES, categories);
  }, [categories]);

  useEffect(() => {
    safeSave(LS_ENTRIES, entries);
  }, [entries]);

  // Todas las entradas de la categoría activa (para las pestañas del modal)
  const entriesInCategory = useMemo(() => {
    return entries.filter((e) => e.categoryId === activeCategoryId);
  }, [entries, activeCategoryId]);

  // Entradas filtradas por búsqueda (para el panel principal)
  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entriesInCategory.filter((e) => {
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        (e.notes ?? "").toLowerCase().includes(q)
      );
    });
  }, [entriesInCategory, search]);

  const selectedEntry: Entry | null = useMemo(() => {
    return entries.find((e) => e.id === selectedEntryId) ?? null;
  }, [entries, selectedEntryId]);

  // PASO 3: sacar el nombre de la categoría activa (para el título de la libreta)
  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === activeCategoryId);
  }, [categories, activeCategoryId]);

  const createCategory = (name: string, parentId: string | null): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = newId("cat");
    setCategories((prev) => {
      const next = [...prev, { id, name: trimmed, ...(parentId ? { parentId } : {}) }];
      return next;
    });
    return id;
  };

  const deleteCategory = (categoryId: string) => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;
    const allIds = collectDescendants(categories, categoryId);

    const remaining = categories.filter((c) => !allIds.includes(c.id));
    if (remaining.length === 0) {
      window.alert("No puedes borrar la última carpeta.");
      return;
    }

    // Si la categoría activa o la seleccionada desaparecen, elegimos un fallback
    const fallbackCategoryId = cat.parentId ?? remaining[0].id;

    setCategories((prev) => prev.filter((c) => !allIds.includes(c.id)));
    setEntries((prev) => prev.filter((e) => !allIds.includes(e.categoryId)));

    if (allIds.includes(activeCategoryId)) {
      if (fallbackCategoryId) setActiveCategoryId(fallbackCategoryId);
    }

    if (selectedEntryId) {
      const sel = entries.find((e) => e.id === selectedEntryId);
      if (sel && allIds.includes(sel.categoryId)) setSelectedEntryId(null);
    }
  };

  const createEntry = (payload: {
    categoryId: string;
    name: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
  }) => {
    const name = payload.name.trim();
    const username = payload.username.trim();
    if (!name || !username) return;

    const id = newId("e");
    const entry: Entry = {
      id,
      categoryId: payload.categoryId,
      name,
      username,
      password: payload.password ?? "",
      url: payload.url?.trim() ? payload.url.trim() : undefined,
      notes: payload.notes?.trim() ? payload.notes.trim() : undefined,
      updatedAt: Date.now(),
    };
    setEntries((prev) => [...prev, entry]);

    // UX: al crear un post-it, lo seleccionamos y abrimos la libreta
    setActiveCategoryId(payload.categoryId);
    setSelectedEntryId(id);
  };

  const deleteEntry = (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedEntryId === entryId) setSelectedEntryId(null);
  };

  return (
    <div className="app">
      <Sidebar
        categories={categories}
        entries={entries}
        activeCategoryId={activeCategoryId}
        selectedEntryId={selectedEntryId}
        onSelectCategory={(id) => {
          setActiveCategoryId(id);
          setSelectedEntryId(null);
        }}
        onSelectEntry={(entryId, categoryId) => {
          setActiveCategoryId(categoryId);
          setSelectedEntryId(entryId);
        }}
        onCreateCategory={() => setCreateState({ kind: "folder", parentId: activeCategoryId })}
        onCreateEntry={() => setCreateState({ kind: "entry", categoryId: activeCategoryId })}
        onDeleteCategory={() => {
          const ok = window.confirm("¿Borrar esta carpeta y todo lo que hay dentro? (Subcarpetas y post-its)");
          if (ok) deleteCategory(activeCategoryId);
        }}
        onDeleteEntry={() => {
          if (!selectedEntryId) return;
          const ok = window.confirm("¿Borrar este post-it?");
          if (ok) deleteEntry(selectedEntryId);
        }}
      />

      <main className="page">
        <div className="header">
          <SearchBar value={search} onChange={setSearch} />
        </div>

        <div className="content">
          <EntryGrid
            notebookTitle={activeCategory?.name ?? "Libreta"}
            entries={filteredEntries}
            onOpenEntry={(id) => setSelectedEntryId(id)}
          />
        </div>

        <NotebookModal
          entry={selectedEntry}
          entriesInCategory={entriesInCategory}
          selectedEntryId={selectedEntryId}
          onSelectEntry={(id: string) => setSelectedEntryId(id)}
          onClose={() => setSelectedEntryId(null)}
          onDeleteEntry={(id) => {
            const ok = window.confirm("¿Borrar este post-it?");
            if (ok) deleteEntry(id);
          }}
          onCreateEntryInCategory={(categoryId) => {
            setCreateState({ kind: "entry", categoryId });
          }}
        />

        <CreateItemModal
          state={createState}
          onClose={() => setCreateState(null)}
          onCreateFolder={(name, parentId) => {
            const newCatId = createCategory(name, parentId);
            if (newCatId) {
              setActiveCategoryId(newCatId);
              setSelectedEntryId(null);
            }
            setCreateState(null);
          }}
          onCreateEntry={(payload) => {
            createEntry(payload);
            setCreateState(null);
          }}
        />
      </main>
    </div>
  );
}