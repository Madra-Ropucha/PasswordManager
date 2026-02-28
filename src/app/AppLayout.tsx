import { useMemo, useState } from "react";
import { seedCategories, seedEntries } from "../data/seed";
import type { Entry } from "../models/types";
import { Sidebar } from "../components/Sidebar";
import { SearchBar } from "../components/SearchBar";
import { EntryGrid } from "../components/EntryGrid";
import { NotebookModal } from "../components/NotebookModal";

export function AppLayout() {
  const [categories] = useState(seedCategories);
  const [entries] = useState(seedEntries);

  const [activeCategoryId, setActiveCategoryId] = useState(categories[0].id);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

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

  return (
    <div className="app">
      <Sidebar
        categories={categories}
        activeCategoryId={activeCategoryId}
        onSelectCategory={(id) => {
          setActiveCategoryId(id);
          setSelectedEntryId(null);
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
        />
      </main>
    </div>
  );
}