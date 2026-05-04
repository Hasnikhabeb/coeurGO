import { Button } from "./components/ui/button";
import { DaeMapPlaceholder } from "./components/map/dae-map-placeholder";

export default function App() {
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Mission terrain</p>
          <h1 className="text-3xl font-bold">Vérification DAE</h1>
          <p className="max-w-3xl text-sm text-slate-600">Socle frontend prêt pour brancher la carte interactive React-Leaflet et les écrans de validation.</p>
        </header>

        <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <h2 className="text-lg font-semibold">Actions rapides</h2>
            <p className="text-sm text-slate-600">Composants shadcn/ui et styles Tailwind opérationnels.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button>Commencer la vérification</Button>
            <Button variant="outline">Voir les DAE proches</Button>
          </div>
        </section>

        <DaeMapPlaceholder />
      </div>
    </main>
  );
}
