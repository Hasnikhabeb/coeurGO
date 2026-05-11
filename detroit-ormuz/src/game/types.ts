export type CellState = "empty" | "ship" | "hit" | "miss" | "mine" | "route" | "revealed";
export type GamePhase = "lobby" | "placement" | "battle" | "victory";
export type PlayerId = "player" | "opponent";
export type ShotResult = "Raté" | "Touché" | "Coulé" | "Zone brouillée" | "Mine détectée";

export type Coordinate = {
  row: number;
  col: number;
};

export type Ship = {
  id: string;
  name: string;
  size: number;
  symbol: string;
  points: number;
  coordinates: Coordinate[];
  hits: Coordinate[];
};

export type BoardCell = {
  row: number;
  col: number;
  state: CellState;
  zone: "iran-coast" | "traffic-lane" | "oman-coast" | "open-water";
  shipId?: string;
  isRoute?: boolean;
  hasMine?: boolean;
  scanned?: boolean;
};

export type PlayerState = {
  id: PlayerId;
  name: string;
  board: BoardCell[][];
  ships: Ship[];
  score: number;
  shots: number;
  hits: number;
  streak: number;
  skipNextTurn: boolean;
  jammedTurns: number;
  droneUses: number;
  radarJams: number;
  minesLeft: number;
  protectedRoutes: number;
};

export type LogEntry = {
  id: string;
  text: string;
  tone: "neutral" | "hit" | "miss" | "warning" | "bonus";
};

export type GameState = {
  size: number;
  phase: GamePhase;
  activePlayer: PlayerId;
  player: PlayerState;
  opponent: PlayerState;
  winner?: PlayerId;
  stormTurns: number;
  turn: number;
  log: LogEntry[];
};

export const FLEET: Omit<Ship, "coordinates" | "hits">[] = [
  { id: "container", name: "Porte-conteneurs", size: 5, symbol: "PC", points: 45 },
  { id: "tanker", name: "Pétrolier", size: 4, symbol: "PT", points: 40 },
  { id: "frigate", name: "Frégate", size: 3, symbol: "FR", points: 30 },
  { id: "patrol", name: "Patrouilleur rapide", size: 2, symbol: "PR", points: 20 },
  { id: "drone", name: "Drone naval", size: 1, symbol: "DN", points: 15 }
];
