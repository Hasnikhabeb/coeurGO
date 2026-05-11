import { Crosshair } from "lucide-react";
import { BoardCell, Coordinate, Ship } from "../game/types";

type EnemyGridProps = {
  board: BoardCell[][];
  ships: Ship[];
  disabled: boolean;
  onFire: (coordinate: Coordinate) => void;
  onDrone: (coordinate: Coordinate) => void;
  targetingMode: "fire" | "drone";
};

export function EnemyGrid({ board, ships, disabled, onFire, onDrone, targetingMode }: EnemyGridProps) {
  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">Secteur adverse</h2>
        <span className="text-xs uppercase tracking-[0.18em] text-ormuz-tactical">Approches Golfe d'Oman</span>
      </div>
      <div className="grid-board" style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}>
        {board.flat().map((cell) => {
          const coordinate = { row: cell.row, col: cell.col };
          const sunk = isSunkCell(cell, ships);
          return (
            <button
              key={`${cell.row}-${cell.col}`}
              className={`board-cell ${cellClass(cell, sunk)} ${targetingMode === "drone" ? "cursor-scan" : ""}`}
              disabled={disabled || cell.state === "hit" || cell.state === "miss"}
              onClick={() => (targetingMode === "drone" ? onDrone(coordinate) : onFire(coordinate))}
              aria-label={`Case ${String.fromCharCode(65 + cell.col)}${cell.row + 1}`}
            >
              {cell.scanned && cell.shipId && cell.state !== "hit" ? <Crosshair className="h-3.5 w-3.5 text-ormuz-radar" /> : null}
              {sunk ? <span className="fire-marker" /> : null}
            </button>
          );
        })}
      </div>
      <MapLegend />
    </div>
  );
}

function cellClass(cell: BoardCell, sunk: boolean) {
  if (sunk) return "cell-sunk";
  if (cell.state === "hit") return "cell-hit";
  if (cell.state === "miss") return "cell-miss";
  if (cell.scanned) return cell.shipId ? "cell-scanned-threat" : "cell-scanned";
  if (cell.isRoute) return "cell-route";
  return `cell-sea ${zoneClass(cell)}`;
}

function zoneClass(cell: BoardCell) {
  return `zone-${cell.zone}`;
}

function isSunkCell(cell: BoardCell, ships: Ship[]) {
  if (!cell.shipId || cell.state !== "hit") return false;
  const ship = ships.find((item) => item.id === cell.shipId);
  return Boolean(ship?.coordinates.length && ship.coordinates.every((coord) => ship.hits.some((hit) => hit.row === coord.row && hit.col === coord.col)));
}

function MapLegend() {
  return (
    <div className="map-legend">
      <span><i className="legend-iran" />Côte iranienne</span>
      <span><i className="legend-route" />Voies de trafic</span>
      <span><i className="legend-oman" />Musandam / Oman</span>
    </div>
  );
}
