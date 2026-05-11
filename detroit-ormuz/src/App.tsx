import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { ActionPanel } from "./components/ActionPanel";
import { GameBoard } from "./components/GameBoard";
import { GameStatus } from "./components/GameStatus";
import { Lobby } from "./components/Lobby";
import { ShipPlacement } from "./components/ShipPlacement";
import { VictoryScreen } from "./components/VictoryScreen";
import { aiTurn, autoPlaceFleet, createInitialGame, fireAt, jamRadar, placeShip, startBattle, useDrone } from "./game/logic";
import { playSound, setAudioEnabled } from "./game/audio";
import { setSpeechEnabled, speakReport } from "./game/speech";
import { Coordinate, GameState } from "./game/types";

type TargetingMode = "fire" | "drone";

function App() {
  const [game, setGame] = useState<GameState>(() => createInitialGame(10));
  const [selectedShipId, setSelectedShipId] = useState("container");
  const [horizontal, setHorizontal] = useState(true);
  const [targetingMode, setTargetingMode] = useState<TargetingMode>("fire");
  const [audioEnabled, setAudioEnabledState] = useState(true);
  const [speechEnabled, setSpeechEnabledState] = useState(true);
  const [gameCode, setGameCode] = useState<string>();
  const [joinCode, setJoinCode] = useState("");
  const previousLogId = useRef<string>();
  const socket = useMemo<Socket>(() => io({ autoConnect: false }), []);

  useEffect(() => {
    return () => {
      socket.disconnect();
    };
  }, [socket]);

  // The MVP always keeps the local AI available, even when the lobby server is absent.
  useEffect(() => {
    if (game.phase !== "battle" || game.activePlayer !== "opponent") return;
    const timer = window.setTimeout(() => setGame((current) => aiTurn(current)), 650);
    return () => window.clearTimeout(timer);
  }, [game.activePlayer, game.phase]);

  useEffect(() => {
    const latest = game.log[0];
    if (!latest || latest.id === previousLogId.current) return;
    previousLogId.current = latest.id;
    const fromPlayer = latest.text.startsWith("Commandement Ormuz");
    const fromOpponent = latest.text.startsWith("IA coalition");
    if (latest.text.includes("Coulé")) playSound("sunk");
    else if (latest.tone === "hit") playSound(fromOpponent ? "opponentHit" : "playerHit");
    if (latest.tone === "miss") playSound(fromOpponent ? "opponentMiss" : "playerMiss");
    if (latest.tone === "bonus" && game.phase === "victory") playSound("victory");
    if (shouldSpeak(latest.text, latest.tone)) speakReport(latest.text);
  }, [game.log, game.phase]);

  useEffect(() => {
    if (game.phase !== "battle" || game.activePlayer !== "player" || !game.player.skipNextTurn) return;
    const timer = window.setTimeout(() => {
      setGame((current) => ({
        ...current,
        player: { ...current.player, skipNextTurn: false },
        activePlayer: "opponent",
        log: [{ id: crypto.randomUUID(), text: "Votre tour est perdu après déclenchement d'une mine.", tone: "warning" as const }, ...current.log].slice(0, 7)
      }));
    }, 550);
    return () => window.clearTimeout(timer);
  }, [game.activePlayer, game.phase, game.player.skipNextTurn]);

  function createGame() {
    playSound("ui");
    socket.connect();
    socket.emit("create-game", ({ code }: { code: string }) => setGameCode(code));
    window.setTimeout(() => {
      setGameCode((code) => code ?? Math.random().toString(36).slice(2, 8).toUpperCase());
    }, 500);
  }

  function joinGame() {
    if (!joinCode.trim()) return;
    playSound("ui");
    socket.connect();
    socket.emit("join-game", joinCode, (payload: { ok: boolean; message?: string }) => {
      if (payload.ok) setGame((current) => ({ ...current, phase: "placement" }));
    });
  }

  function localGame() {
    playSound("ui");
    setGame((current) => ({ ...current, phase: "placement" }));
  }

  function placeSelectedShip(coordinate: Coordinate) {
    playSound("ui");
    setGame((current) => ({
      ...current,
      player: placeShip(current.player, selectedShipId, coordinate, horizontal)
    }));
  }

  function autoPlace() {
    playSound("scan");
    setGame((current) => ({ ...current, player: autoPlaceFleet(current.player) }));
  }

  function launchBattle() {
    playSound("launch");
    setGame((current) => startBattle(current));
  }

  function fire(coordinate: Coordinate) {
    playSound("shot");
    setGame((current) => fireAt(current, "player", coordinate));
  }

  function drone(coordinate: Coordinate) {
    playSound("scan");
    setGame((current) => useDrone(current, "player", coordinate));
    setTargetingMode("fire");
  }

  function toggleAudio() {
    const next = !audioEnabled;
    setAudioEnabledState(next);
    setAudioEnabled(next);
    if (next) playSound("ui");
  }

  function toggleSpeech() {
    const next = !speechEnabled;
    setSpeechEnabledState(next);
    setSpeechEnabled(next);
    if (next) speakReport("Synthèse vocale opérationnelle.");
  }

  function restart() {
    playSound("ui");
    setGame(createInitialGame(10));
    setGameCode(undefined);
    setJoinCode("");
    setSelectedShipId("container");
    setTargetingMode("fire");
    previousLogId.current = undefined;
  }

  if (game.phase === "lobby") {
    return (
      <Lobby
        gameCode={gameCode}
        joinCode={joinCode}
        onJoinCodeChange={setJoinCode}
        onCreateGame={createGame}
        onJoinGame={joinGame}
        onLocalGame={localGame}
      />
    );
  }

  if (game.phase === "placement") {
    return (
      <ShipPlacement
        player={game.player}
        selectedShipId={selectedShipId}
        horizontal={horizontal}
        onSelectShip={setSelectedShipId}
        onToggleDirection={() => setHorizontal((value) => !value)}
        onPlace={placeSelectedShip}
        onAutoPlace={autoPlace}
        onStart={launchBattle}
      />
    );
  }

  if (game.phase === "victory") {
    return <VictoryScreen game={game} onRestart={restart} />;
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[1fr_330px]">
      <section className="space-y-4">
        <GameStatus game={game} />
        <GameBoard game={game} targetingMode={targetingMode} onFire={fire} onDrone={drone} />
      </section>
      <ActionPanel
        game={game}
        targetingMode={targetingMode}
        audioEnabled={audioEnabled}
        speechEnabled={speechEnabled}
        onModeChange={(mode) => {
          playSound("ui");
          setTargetingMode(mode);
        }}
        onToggleAudio={toggleAudio}
        onToggleSpeech={toggleSpeech}
        onJam={() => {
          playSound("jam");
          setGame((current) => jamRadar(current, "player"));
        }}
      />
    </main>
  );
}

function shouldSpeak(text: string, tone: string) {
  return tone === "hit" || text.includes("Raté") || text.includes("Mine détectée") || text.includes("Zone brouillée") || text.includes("Coulé");
}

export default App;
