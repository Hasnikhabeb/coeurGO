import { GameState } from "../game/types";
import { routeBonus } from "../game/logic";

type GameStatusProps = {
  game: GameState;
};

export function GameStatus({ game }: GameStatusProps) {
  const playerTotal = game.player.score + routeBonus(game.player);
  const opponentTotal = game.opponent.score + routeBonus(game.opponent);

  return (
    <div className="panel">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="panel-title">Situation tactique</h2>
        <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Ormuz 2026 · chenal tactique 10 x 10</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        <Metric label="Tour" value={String(game.turn)} />
        <Metric label="À jouer" value={game.activePlayer === "player" ? "Vous" : "IA"} />
        <Metric label="Votre score" value={`${playerTotal} pts`} accent="tactical" />
        <Metric label="Score adverse" value={`${opponentTotal} pts`} accent="radar" />
        <Metric label="Précision" value={`${game.player.shots ? Math.round((game.player.hits / game.player.shots) * 100) : 0}%`} />
      </div>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: "tactical" | "radar" }) {
  return (
    <div className={`metric-card ${accent === "tactical" ? "metric-tactical" : accent === "radar" ? "metric-radar" : ""}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}
