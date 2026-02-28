import type { Entry } from "../models/types";

type Props = {
  entry: Entry;
  onOpen: (id: string) => void;
  variant?: "grid" | "tab";
  active?: boolean;
};

export function PostItCard({ entry, onOpen, variant = "grid", active }: Props) {
  const tilt = tiltFromId(entry.id);

  const className =
    variant === "tab"
      ? `edgePostit ${active ? "edgePostitActive" : ""}`.trim()
      : "postit";

  // En la grid sí queda bien el efecto "post-it" con un poco de inclinación.
  // (En pestañas lo manejamos con CSS para no pelear con z-index.)
  const style =
    variant === "grid" ? ({ transform: `rotate(${tilt}deg)` } as const) : undefined;

  return (
    <button className={className} style={style} onClick={() => onOpen(entry.id)} title={entry.name}>
      <div className="postitTitle">{entry.name}</div>
      <div className="postitUser">{entry.username}</div>
      {entry.favorite && <div className="postitStar">★</div>}
    </button>
  );
}

function tiltFromId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  const v = Math.abs(h) % 7; // 0..6
  return v - 3; // -3..+3
}