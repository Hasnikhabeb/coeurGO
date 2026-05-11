import { Mic, MicOff, RadioTower, ScanSearch, Target, Volume2, VolumeX } from "lucide-react";
import { GameState } from "../game/types";

type ActionPanelProps = {
  game: GameState;
  targetingMode: "fire" | "drone";
  audioEnabled: boolean;
  speechEnabled: boolean;
  onModeChange: (mode: "fire" | "drone") => void;
  onToggleAudio: () => void;
  onToggleSpeech: () => void;
  onJam: () => void;
};

export function ActionPanel({ game, targetingMode, audioEnabled, speechEnabled, onModeChange, onToggleAudio, onToggleSpeech, onJam }: ActionPanelProps) {
  const isPlayerTurn = game.activePlayer === "player";
  const actionHint =
    targetingMode === "drone"
      ? "Cliquez une case adverse pour révéler une zone de reconnaissance."
      : "Cliquez une case adverse pour engager un tir.";

  return (
    <aside className="panel space-y-4">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="panel-title">Centre d'ordres</h2>
          <div className="flex gap-2">
            <button className="icon-button h-10 min-h-10 w-10 p-0" onClick={onToggleAudio} aria-label={audioEnabled ? "Couper l'audio" : "Activer l'audio"}>
              {audioEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>
            <button className="icon-button h-10 min-h-10 w-10 p-0" onClick={onToggleSpeech} aria-label={speechEnabled ? "Couper la voix" : "Activer la voix"}>
              {speechEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <p className="mt-2 text-sm text-slate-300">{isPlayerTurn ? actionHint : "La coalition adverse prépare sa salve."}</p>
      </div>
      <div className="briefing-box">
        <p className="briefing-label">Priorité</p>
        <p className="briefing-text">Tenir les deux voies de trafic au centre du détroit, surveiller les approches de Musandam et éviter les tirs dispersés.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button className={`action-button ${targetingMode === "fire" ? "active" : ""}`} disabled={!isPlayerTurn} onClick={() => onModeChange("fire")}>
          <Target className="h-5 w-5" />
          Tir
        </button>
        <button
          className={`action-button ${targetingMode === "drone" ? "active" : ""}`}
          disabled={!isPlayerTurn || game.player.droneUses <= 0}
          onClick={() => onModeChange("drone")}
        >
          <ScanSearch className="h-5 w-5" />
          Drone
        </button>
      </div>
      <button className="secondary-button w-full" disabled={!isPlayerTurn || game.player.radarJams <= 0} onClick={onJam}>
        <RadioTower className="h-4 w-4" />
        Brouillage radar
      </button>
      <div className="space-y-2">
        <p className="section-label">Journal opérationnel</p>
        {game.log.map((entry) => (
          <p key={entry.id} className={`log-line ${entry.tone}`}>
            {entry.text}
          </p>
        ))}
      </div>
    </aside>
  );
}
