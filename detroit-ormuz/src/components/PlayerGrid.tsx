import { BoardCell, Ship } from "../game/types";

type PlayerGridProps = {
  board: BoardCell[][];
  ships: Ship[];
};

export function PlayerGrid({ board, ships }: PlayerGridProps) {
  return (
    <div className="panel">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="panel-title">Votre secteur</h2>
        <span className="text-xs uppercase tracking-[0.18em] text-ormuz-sand">Côte iranienne · Chenal · Musandam</span>
      </div>
      <div className="grid-board" style={{ gridTemplateColumns: `repeat(${board.length}, minmax(0, 1fr))` }}>
        {board.flat().map((cell) => {
          const sunk = isSunkCell(cell, ships);
          return (
          <div key={`${cell.row}-${cell.col}`} className={`board-cell ${cellClass(cell, true, sunk)}`}>
            {cell.shipId && cell.state !== "hit" ? <span className="ship-dot" /> : null}
            {sunk ? <span className="fire-marker" /> : null}
          </div>
          );
        })}
      </div>
      <MapLegend />
    </div>
  );
}

function cellClass(cell: BoardCell, own: boolean, sunk: boolean) {
  if (sunk) return "cell-sunk";
  if (cell.state === "hit") return "cell-hit";
  if (cell.state === "miss") return "cell-miss";
  if (own && cell.hasMine) return "cell-mine";
  if (own && cell.shipId) return "cell-ship";
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
