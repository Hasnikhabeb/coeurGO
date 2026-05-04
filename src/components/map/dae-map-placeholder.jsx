export function DaeMapPlaceholder() {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3">
        <h2 className="text-lg font-semibold">Carte DAE (React-Leaflet)</h2>
        <p className="text-sm text-slate-600">Zone prête pour intégrer MapContainer, TileLayer et Markers dès installation des dépendances.</p>
      </div>
      <div className="flex h-[420px] items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        Placeholder carte interactive
      </div>
    </section>
  );
}
