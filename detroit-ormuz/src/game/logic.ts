import { BoardCell, Coordinate, FLEET, GameState, LogEntry, PlayerId, PlayerState, Ship, ShotResult } from "./types";

const routeCoordinates: Coordinate[] = [
  { row: 4, col: 0 },
  { row: 4, col: 1 },
  { row: 4, col: 2 },
  { row: 4, col: 3 },
  { row: 4, col: 4 },
  { row: 4, col: 5 },
  { row: 4, col: 6 },
  { row: 4, col: 7 },
  { row: 4, col: 8 },
  { row: 4, col: 9 },
  { row: 5, col: 0 },
  { row: 5, col: 1 },
  { row: 5, col: 2 },
  { row: 5, col: 3 },
  { row: 5, col: 4 },
  { row: 5, col: 5 },
  { row: 5, col: 6 },
  { row: 5, col: 7 },
  { row: 5, col: 8 },
  { row: 5, col: 9 }
];

function zoneFor(row: number): BoardCell["zone"] {
  if (row <= 1) return "iran-coast";
  if (row >= 8) return "oman-coast";
  if (row >= 4 && row <= 5) return "traffic-lane";
  return "open-water";
}

export function createBoard(size: number): BoardCell[][] {
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      const isRoute = routeCoordinates.some((coord) => coord.row === row && coord.col === col);
      return {
        row,
        col,
        state: isRoute ? "route" : "empty",
        zone: zoneFor(row),
        isRoute
      };
    })
  );
}

function cloneFleet(): Ship[] {
  return FLEET.map((ship) => ({ ...ship, coordinates: [], hits: [] }));
}

export function createPlayer(id: PlayerId, name: string, size: number): PlayerState {
  return {
    id,
    name,
    board: createBoard(size),
    ships: cloneFleet(),
    score: 0,
    shots: 0,
    hits: 0,
    streak: 0,
    skipNextTurn: false,
    jammedTurns: 0,
    droneUses: 1,
    radarJams: 1,
    minesLeft: 2,
    protectedRoutes: 0
  };
}

export function createInitialGame(size = 10): GameState {
  const game: GameState = {
    size,
    phase: "lobby",
    activePlayer: "player",
    player: createPlayer("player", "Commandement Ormuz 2026", size),
    opponent: createPlayer("opponent", "IA coalition", size),
    stormTurns: 0,
    turn: 1,
    log: []
  };
  return addLog(game, "Canal Ormuz 2026 ouvert. Surveillez le chenal entre côte iranienne et Musandam.", "neutral");
}

function addLog(game: GameState, text: string, tone: LogEntry["tone"] = "neutral"): GameState {
  return {
    ...game,
    log: [{ id: crypto.randomUUID(), text, tone }, ...game.log].slice(0, 7)
  };
}

function sameCoordinate(a: Coordinate, b: Coordinate) {
  return a.row === b.row && a.col === b.col;
}

function coordinatesFor(start: Coordinate, size: number, horizontal: boolean): Coordinate[] {
  return Array.from({ length: size }, (_, index) => ({
    row: start.row + (horizontal ? 0 : index),
    col: start.col + (horizontal ? index : 0)
  }));
}

function canPlace(board: BoardCell[][], coordinates: Coordinate[]) {
  return coordinates.every((coord) => {
    const cell = board[coord.row]?.[coord.col];
    return cell && !cell.shipId && !cell.hasMine;
  });
}

export function placeShip(player: PlayerState, shipId: string, start: Coordinate, horizontal: boolean): PlayerState {
  const ship = player.ships.find((item) => item.id === shipId);
  if (!ship) return player;
  const coordinates = coordinatesFor(start, ship.size, horizontal);
  if (!canPlace(player.board, coordinates)) return player;

  const board = player.board.map((row) => row.map((cell) => ({ ...cell })));
  const ships = player.ships.map((item) => {
    if (item.id !== shipId) return item;
    return { ...item, coordinates };
  });

  coordinates.forEach((coord) => {
    board[coord.row][coord.col] = { ...board[coord.row][coord.col], state: "ship", shipId };
  });

  return { ...player, board, ships, protectedRoutes: countProtectedRoutes(board) };
}

export function autoPlaceFleet(player: PlayerState): PlayerState {
  let next = { ...player, board: createBoard(player.board.length), ships: cloneFleet() };

  for (const ship of next.ships) {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 300) {
      const horizontal = Math.random() > 0.45;
      const row = Math.floor(Math.random() * next.board.length);
      const col = Math.floor(Math.random() * next.board.length);
      const candidate = placeShip(next, ship.id, { row, col }, horizontal);
      placed = candidate.ships.find((item) => item.id === ship.id)?.coordinates.length === ship.size;
      next = candidate;
      attempts += 1;
    }
  }

  return placeMines(next, 2);
}

export function placeMines(player: PlayerState, count: number): PlayerState {
  const board = player.board.map((row) => row.map((cell) => ({ ...cell })));
  let placed = 0;
  while (placed < count) {
    const row = Math.floor(Math.random() * board.length);
    const col = Math.floor(Math.random() * board.length);
    const cell = board[row][col];
    if (!cell.shipId && !cell.hasMine && !cell.isRoute) {
      board[row][col] = { ...cell, hasMine: true, state: "mine" };
      placed += 1;
    }
  }
  return { ...player, board, minesLeft: count };
}

function countProtectedRoutes(board: BoardCell[][]) {
  return board.flat().filter((cell) => cell.isRoute && cell.shipId).length;
}

function isSunk(ship: Ship) {
  return ship.coordinates.length > 0 && ship.coordinates.every((coord) => ship.hits.some((hit) => sameCoordinate(hit, coord)));
}

export function startBattle(game: GameState): GameState {
  return addLog(
    {
      ...game,
      phase: "battle",
      activePlayer: "player",
      opponent: autoPlaceFleet(game.opponent)
    },
    "Flotte déployée. Le chenal de trafic Golfe Persique vers Golfe d'Oman est sous surveillance.",
    "bonus"
  );
}

export function fireAt(game: GameState, attackerId: PlayerId, target: Coordinate): GameState {
  if (game.phase !== "battle" || game.activePlayer !== attackerId) return game;

  const defenderId: PlayerId = attackerId === "player" ? "opponent" : "player";
  const attacker = { ...game[attackerId] };
  const defender = { ...game[defenderId], board: game[defenderId].board.map((row) => row.map((cell) => ({ ...cell }))) };
  const cell = defender.board[target.row]?.[target.col];
  if (!cell || cell.state === "hit" || cell.state === "miss" || cell.state === "revealed") return game;

  attacker.shots += 1;
  let result: ShotResult = "Raté";
  let tone: LogEntry["tone"] = "miss";

  if (cell.hasMine) {
    defender.board[target.row][target.col] = { ...cell, state: "miss", hasMine: false };
    attacker.skipNextTurn = true;
    result = "Mine détectée";
    tone = "warning";
  } else if (cell.shipId) {
    const ships = defender.ships.map((ship) => {
      if (ship.id !== cell.shipId) return ship;
      return { ...ship, hits: [...ship.hits, target] };
    });
    const hitShip = ships.find((ship) => ship.id === cell.shipId)!;
    defender.ships = ships;
    defender.board[target.row][target.col] = { ...cell, state: "hit" };
    attacker.hits += 1;
    attacker.streak += 1;
    attacker.score += 10 + Math.max(0, attacker.streak - 1) * 3;
    result = isSunk(hitShip) ? "Coulé" : "Touché";
    tone = "hit";
    if (result === "Coulé") attacker.score += hitShip.points;
  } else {
    defender.board[target.row][target.col] = { ...cell, state: "miss" };
    attacker.streak = 0;
  }

  const displayResult = defender.jammedTurns > 0 && attackerId === "player" ? "Zone brouillée" : result;
  defender.jammedTurns = Math.max(0, defender.jammedTurns - 1);

  let next: GameState = {
    ...game,
    [attackerId]: attacker,
    [defenderId]: defender,
    activePlayer: defenderId,
    turn: game.turn + 1,
    stormTurns: Math.max(0, game.stormTurns - 1)
  };

  next = maybeTriggerStorm(next);
  next = addLog(next, `${attacker.name} : ${displayResult} en ${String.fromCharCode(65 + target.col)}${target.row + 1}.`, tone);
  return checkVictory(next);
}

export function useDrone(game: GameState, ownerId: PlayerId, center: Coordinate): GameState {
  if (game.phase !== "battle" || game.activePlayer !== ownerId || game[ownerId].droneUses <= 0) return game;
  const targetId: PlayerId = ownerId === "player" ? "opponent" : "player";
  const owner = { ...game[ownerId], droneUses: game[ownerId].droneUses - 1 };
  const target = { ...game[targetId], board: game[targetId].board.map((row) => row.map((cell) => ({ ...cell }))) };
  const radius = game.stormTurns > 0 ? 0 : 1;

  for (let row = center.row - radius; row <= center.row + radius; row += 1) {
    for (let col = center.col - radius; col <= center.col + radius; col += 1) {
      const cell = target.board[row]?.[col];
      if (cell) target.board[row][col] = { ...cell, scanned: true };
    }
  }

  return addLog(
    { ...game, [ownerId]: owner, [targetId]: target, activePlayer: targetId },
    "Drone naval déployé. Une fenêtre tactique s'ouvre sur la grille adverse.",
    "bonus"
  );
}

export function jamRadar(game: GameState, ownerId: PlayerId): GameState {
  if (game.phase !== "battle" || game.activePlayer !== ownerId || game[ownerId].radarJams <= 0) return game;
  const owner = { ...game[ownerId], radarJams: game[ownerId].radarJams - 1, jammedTurns: 1 };
  return addLog({ ...game, [ownerId]: owner, activePlayer: ownerId === "player" ? "opponent" : "player" }, "Brouillage radar actif pendant un tour.", "warning");
}

export function aiTurn(game: GameState): GameState {
  if (game.phase !== "battle" || game.activePlayer !== "opponent") return game;
  if (game.opponent.skipNextTurn) {
    return addLog({ ...game, opponent: { ...game.opponent, skipNextTurn: false }, activePlayer: "player" }, "L'IA perd son tour après contact avec une mine.", "warning");
  }

  const candidates = game.player.board.flat().filter((cell) => cell.state !== "hit" && cell.state !== "miss");
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  return fireAt(game, "opponent", { row: target.row, col: target.col });
}

function maybeTriggerStorm(game: GameState): GameState {
  if (game.stormTurns > 0 || game.turn < 4 || Math.random() > 0.14) return game;
  return addLog({ ...game, stormTurns: 1 }, "Tempête de sable sur le détroit : visibilité réduite au prochain scan.", "warning");
}

function checkVictory(game: GameState): GameState {
  const playerLost = game.player.ships.every(isSunk);
  const opponentLost = game.opponent.ships.every(isSunk);
  if (!playerLost && !opponentLost) return game;
  const winner = opponentLost ? "player" : "opponent";
  return addLog({ ...game, phase: "victory", winner }, `${game[winner].name} contrôle Ormuz 2026.`, "bonus");
}

export function routeBonus(player: PlayerState) {
  return player.protectedRoutes * 6;
}
