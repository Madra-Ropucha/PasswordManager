import { useEffect, useMemo, useState } from "react";
import type { Category, Entry } from "../models/types";
import { Sidebar } from "../components/Sidebar";
import { SearchBar } from "../components/SearchBar";
import { EntryGrid } from "../components/EntryGrid";
import { NotebookModal } from "../components/NotebookModal";
import { CreateItemModal, type CreateItemState } from "../components/CreateItemModal";
import { tauriInvoke } from "../tauri/api";

const LS_CATEGORIES_LEGACY = "notebook_categories_v1";
const LS_ENTRIES_LEGACY = "notebook_entries_v1";

const KV_CATEGORIES = "notebook_categories_v1";
const KV_ENTRIES = "notebook_entries_v1";

const defaultCategories: Category[] = [{ id: "general", name: "General" }];
const defaultEntries: Entry[] = [];

function safeLoadLocal<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function safeRemoveLocal(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // noop
  }
}

function newId(prefix: string) {
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

async function kvGetJson<T>(key: string): Promise<T | null> {
  const raw = await tauriInvoke<string | null>("cmd_kv_get", { key });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function kvSetJson(key: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  await tauriInvoke<void>("cmd_kv_set", { key, value: raw });
}

type Props = {
  vaultName: string;
  onLogout: () => void;
  logoutDisabled?: boolean;
};

export function AppLayout({ vaultName, onLogout, logoutDisabled }: Props) {
  const [loading, setLoading] = useState(true);

  const [categories, setCategories] = useState<Category[]>(defaultCategories);
  const [entries, setEntries] = useState<Entry[]>(defaultEntries);

  const [activeCategoryId, setActiveCategoryId] = useState(defaultCategories[0].id);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [createState, setCreateState] = useState<CreateItemState | null>(null);

  // Carga inicial desde el vault (tabla kv). Si está vacío, migramos desde localStorage (si existe).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let cats = await kvGetJson<Category[]>(KV_CATEGORIES);
        let ents = await kvGetJson<Entry[]>(KV_ENTRIES);

        // Migración suave desde localStorage (si el vault está vacío)
        if (!cats) {
          const legacyCats = safeLoadLocal<Category[]>(LS_CATEGORIES_LEGACY);
          if (legacyCats && legacyCats.length > 0) {
            cats = legacyCats;
            await kvSetJson(KV_CATEGORIES, cats);
            safeRemoveLocal(LS_CATEGORIES_LEGACY);
          }
        }
        if (!ents) {
          const legacyEntries = safeLoadLocal<Entry[]>(LS_ENTRIES_LEGACY);
          if (legacyEntries && legacyEntries.length >= 0) {
            ents = legacyEntries;
            await kvSetJson(KV_ENTRIES, legacyEntries);
            safeRemoveLocal(LS_ENTRIES_LEGACY);
          }
        }

        if (!cats || cats.length === 0) cats = defaultCategories;
        if (!ents) ents = defaultEntries;

        if (cancelled) return;
        setCategories(cats);
        setEntries(ents);

        const idsWithEntries = new Set(ents.map((e) => e.categoryId));
        const initialActive = cats.find((c) => idsWithEntries.has(c.id))?.id ?? cats[0].id;
        setActiveCategoryId(initialActive);
        setSelectedEntryId(null);
        setSearch("");
      } catch (e) {
        if (!cancelled) window.alert((e as Error).message ?? String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vaultName]);

  // Persistencia dentro del vault
  useEffect(() => {
    if (loading) return;
    void kvSetJson(KV_CATEGORIES, categories);
  }, [categories, loading]);

  useEffect(() => {
    if (loading) return;
    void kvSetJson(KV_ENTRIES, entries);
  }, [entries, loading]);

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

  const activeCategory = useMemo(() => {
    return categories.find((c) => c.id === activeCategoryId);
  }, [categories, activeCategoryId]);

  const createCategory = (name: string, parentId: string | null): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const id = newId("cat");
    setCategories((prev) => [...prev, { id, name: trimmed, ...(parentId ? { parentId } : {}) }]);
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

    setActiveCategoryId(payload.categoryId);
    setSelectedEntryId(id);
  };

  const deleteEntry = (entryId: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (selectedEntryId === entryId) setSelectedEntryId(null);
  };

  if (loading) {
    return (
      <div className="authPage">
        <div className="authCard">
          <div className="authBrand">🔓 Abriendo vault…</div>
          <div className="authFootnote">Cargando datos cifrados…</div>
        </div>
      </div>
    );
  }

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
          <div className="headerRow">
            <SearchBar value={search} onChange={setSearch} />
            <div className="headerUser">
              <span className="headerUserName" title={vaultName}>
                👤 {vaultName}
              </span>
              <button className="btn" type="button" onClick={onLogout} disabled={logoutDisabled}>
                Salir
              </button>
            </div>
          </div>
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
