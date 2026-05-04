import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const DAE_POINTS = [
  { id: 1, name: "DAE Hôtel de Ville", pos: [48.8566, 2.3522] },
  { id: 2, name: "DAE Gare", pos: [48.8584, 2.2945] },
];

export function DaeMapPlaceholder() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Carte DAE</h2>
      </div>
      <div className="h-[420px] overflow-hidden rounded-lg border border-slate-200">
        <MapContainer center={[48.8566, 2.3522]} zoom={12} className="h-full w-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {DAE_POINTS.map((dae) => (
            <Marker key={dae.id} position={dae.pos}>
              <Popup>{dae.name}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </section>
  );
}
