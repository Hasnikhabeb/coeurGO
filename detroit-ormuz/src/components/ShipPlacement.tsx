import { RotateCcw, Ship, Shuffle } from "lucide-react";
import { BoardCell, Coordinate, PlayerState, Ship as ShipType } from "../game/types";

type ShipPlacementProps = {
  player: PlayerState;
  selectedShipId: string;
  horizontal: boolean;
  onSelectShip: (id: string) => void;
  onToggleDirection: () => void;
  onPlace: (coordinate: Coordinate) => void;
  onAutoPlace: () => void;
  onStart: () => void;
};

export function ShipPlacement({ player, selectedShipId, horizontal, onSelectShip, onToggleDirection, onPlace, onAutoPlace, onStart }: ShipPlacementProps) {
  const allPlaced = player.ships.every((ship) => ship.coordinates.length === ship.size);

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-5 lg:grid-cols-[1fr_320px]">
      <div className="panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="panel-title">Déploiement secret</h2>
          <button className="icon-button" onClick={onToggleDirection} aria-label="Changer l'orientation">
            <RotateCcw className="h-5 w-5" />
          </button>
        </div>
        <div className="grid-board" style={{ gridTemplateColumns: `repeat(${player.board.length}, minmax(0, 1fr))` }}>
          {player.board.flat().map((cell) => (
            <button key={`${cell.row}-${cell.col}`} className={`board-cell ${placementClass(cell)}`} onClick={() => onPlace({ row: cell.row, col: cell.col })}>
              {cell.shipId ? <span className="ship-dot" /> : null}
            </button>
          ))}
        </div>
        <div className="map-legend">
          <span><i className="legend-iran" />Côte iranienne</span>
          <span><i className="legend-route" />Voies de trafic</span>
          <span><i className="legend-oman" />Musandam / Oman</span>
        </div>
      </div>

      <aside className="panel space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-ormuz-sand">Orientation</p>
          <p className="mt-1 text-lg font-semibold text-white">{horizontal ? "Horizontale" : "Verticale"}</p>
        </div>
        <div className="space-y-2">
          {player.ships.map((ship) => (
            <button key={ship.id} className={`ship-button ${selectedShipId === ship.id ? "ship-button-active" : ""}`} onClick={() => onSelectShip(ship.id)}>
              <Ship className="h-4 w-4" />
              <span>{ship.name}</span>
              <span className="ml-auto text-ormuz-sand">{ship.coordinates.length ? "Placée" : `${ship.size}`}</span>
            </button>
          ))}
        </div>
        <button className="secondary-button w-full" onClick={onAutoPlace}>
          <Shuffle className="h-4 w-4" />
          Placement automatique
        </button>
        <button className="primary-button w-full" disabled={!allPlaced} onClick={onStart}>
          Lancer l'opération
        </button>
      </aside>
    </section>
  );
}

function placementClass(cell: BoardCell) {
  if (cell.shipId) return "cell-ship";
  if (cell.hasMine) return "cell-mine";
  if (cell.isRoute) return "cell-route";
  return `cell-sea zone-${cell.zone}`;
}
