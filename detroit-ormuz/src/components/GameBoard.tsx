import { Coordinate, GameState } from "../game/types";
import { EnemyGrid } from "./EnemyGrid";
import { PlayerGrid } from "./PlayerGrid";

type GameBoardProps = {
  game: GameState;
  targetingMode: "fire" | "drone";
  onFire: (coordinate: Coordinate) => void;
  onDrone: (coordinate: Coordinate) => void;
};

export function GameBoard({ game, targetingMode, onFire, onDrone }: GameBoardProps) {
  const isPlayerTurn = game.activePlayer === "player" && game.phase === "battle";

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <PlayerGrid board={game.player.board} ships={game.player.ships} />
      <EnemyGrid board={game.opponent.board} ships={game.opponent.ships} disabled={!isPlayerTurn} onFire={onFire} onDrone={onDrone} targetingMode={targetingMode} />
    </div>
  );
}
