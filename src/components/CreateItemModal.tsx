import { useEffect, useMemo, useState } from "react";

export type CreateItemState =
  | { kind: "folder"; parentId: string | null }
  | { kind: "entry"; categoryId: string };

type Props = {
  state: CreateItemState | null;
  onClose: () => void;
  onCreateFolder: (name: string, parentId: string | null) => void;
  onCreateEntry: (payload: {
    categoryId: string;
    name: string;
    username: string;
    password: string;
    url?: string;
    notes?: string;
  }) => void;
};

export function CreateItemModal({ state, onClose, onCreateFolder, onCreateEntry }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");

  const title = useMemo(() => {
    if (!state) return "";
    return state.kind === "folder" ? "Nueva carpeta" : "Nuevo post-it";
  }, [state]);

  // reset al abrir/cambiar tipo
  useEffect(() => {
    if (!state) return;
    setName("");
    setUsername("");
    setPassword("");
    setUrl("");
    setNotes("");
  }, [state?.kind]);

  // Escape + bloqueo scroll
  useEffect(() => {
    if (!state) return;

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
  }, [state, onClose]);

  if (!state) return null;

  const submit = () => {
    if (state.kind === "folder") {
      onCreateFolder(name, state.parentId);
      return;
    }
    onCreateEntry({
      categoryId: state.categoryId,
      name,
      username,
      password,
      url: url || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="modalOverlay" onMouseDown={onClose}>
      <div className="miniModal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="miniModalHeader">
          <div className="miniModalTitle">{title}</div>
          <button className="iconBtn" onClick={onClose} aria-label="Cerrar" type="button">
            ✕
          </button>
        </div>

        <div className="miniModalBody">
          <label className="field">
            <span className="fieldLabel">Nombre</span>
            <input
              className="fieldInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={state.kind === "folder" ? "Ej: Redes" : "Ej: Epic Games"}
              autoFocus
            />
          </label>

          {state.kind === "entry" && (
            <>
              <label className="field">
                <span className="fieldLabel">Usuario</span>
                <input
                  className="fieldInput"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Ej: nercy_epic"
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Contraseña</span>
                <input
                  className="fieldInput"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="(opcional)"
                  type="password"
                />
              </label>

              <label className="field">
                <span className="fieldLabel">URL</span>
                <input
                  className="fieldInput"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                />
              </label>

              <label className="field">
                <span className="fieldLabel">Notas</span>
                <textarea
                  className="fieldTextarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="(opcional)"
                  rows={3}
                />
              </label>
            </>
          )}
        </div>

        <div className="miniModalFooter">
          <button className="btn" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className="btn btnPrimary" onClick={submit} type="button">
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}
