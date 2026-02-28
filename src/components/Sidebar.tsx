import type { Category } from "../models/types";

type Props = {
  categories: Category[];
  activeCategoryId: string;
  onSelectCategory: (id: string) => void;
};

export function Sidebar({ categories, activeCategoryId, onSelectCategory }: Props) {
  return (
    <aside className="sidebar">
      <div className="brand">📓 Libreta</div>

      <div className="sectionTitle">Categorías</div>
      <div className="tabs">
        {categories.map((c) => (
          <button
            key={c.id}
            className={"tab " + (c.id === activeCategoryId ? "tabActive" : "")}
            onClick={() => onSelectCategory(c.id)}
          >
            {c.name}
          </button>
        ))}
      </div>
    </aside>
  );
}