import { Award, RotateCcw } from "lucide-react";
import { GameState } from "../game/types";
import { routeBonus } from "../game/logic";

type VictoryScreenProps = {
  game: GameState;
  onRestart: () => void;
};

export function VictoryScreen({ game, onRestart }: VictoryScreenProps) {
  const winner = game.winner ? game[game.winner] : game.player;
  const playerPrecision = game.player.shots ? Math.round((game.player.hits / game.player.shots) * 100) : 0;
  const remaining = game.player.ships.filter((ship) => ship.hits.length < ship.coordinates.length).length;

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-5xl place-items-center px-4 py-8">
      <div className="panel w-full max-w-3xl text-center">
        <Award className="mx-auto h-12 w-12 text-ormuz-sand" />
        <p className="mt-4 text-xs uppercase tracking-[0.28em] text-ormuz-tactical">Contrôle maritime établi</p>
        <h1 className="mt-2 text-4xl font-semibold text-white">{winner.name}</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Stat label="Tirs" value={String(game.player.shots)} />
          <Stat label="Précision" value={`${playerPrecision}%`} />
          <Stat label="Navires restants" value={String(remaining)} />
          <Stat label="Bonus routes" value={`${routeBonus(game.player)} pts`} />
        </div>
        <button className="primary-button mx-auto mt-6" onClick={onRestart}>
          <RotateCcw className="h-4 w-4" />
          Nouvelle partie
        </button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.04] p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
