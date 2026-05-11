import { Anchor, LogIn, Radar } from "lucide-react";

type LobbyProps = {
  gameCode?: string;
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onCreateGame: () => void;
  onJoinGame: () => void;
  onLocalGame: () => void;
};

export function Lobby({ gameCode, joinCode, onJoinCodeChange, onCreateGame, onJoinGame, onLocalGame }: LobbyProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-6xl flex-col justify-between px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between border-b border-white/10 pb-4">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded border border-ormuz-tactical/40 bg-ormuz-deep shadow-radar">
            <Anchor className="h-6 w-6 text-ormuz-tactical" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-ormuz-sand">Simulation navale</p>
            <h1 className="text-2xl font-semibold text-white sm:text-4xl">Ormuz 2026</h1>
          </div>
        </div>
        <Radar className="h-7 w-7 text-ormuz-radar" />
      </header>

      <div className="grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <div className="relative overflow-hidden border border-ormuz-tactical/20 bg-ormuz-night/70 p-5 shadow-2xl sm:p-7">
            <div className="absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-ormuz-tactical/10 to-transparent" />
            <div className="relative">
              <p className="text-sm uppercase tracking-[0.24em] text-ormuz-tactical">Poste de commandement</p>
              <h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-6xl">
                Tenez le chenal du détroit.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300">
                Une carte inspirée d'Ormuz : côte iranienne au nord, Musandam au sud, deux voies de trafic au centre entre Golfe Persique et Golfe d'Oman.
              </p>
            </div>
          </div>
        </div>

        <div className="border border-white/10 bg-white/[0.045] p-4 shadow-2xl backdrop-blur sm:p-5">
          <div className="space-y-3">
            <button className="primary-button w-full" onClick={onCreateGame}>
              Créer une partie
            </button>
            {gameCode && (
              <div className="border border-ormuz-sand/30 bg-ormuz-sand/10 p-3 text-center">
                <p className="text-xs uppercase tracking-[0.2em] text-ormuz-sand">Code partageable</p>
                <p className="mt-1 text-3xl font-semibold text-white">{gameCode}</p>
              </div>
            )}
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 border border-white/10 bg-ormuz-night px-3 py-3 text-sm uppercase text-white outline-none focus:border-ormuz-tactical"
                placeholder="CODE"
                value={joinCode}
                onChange={(event) => onJoinCodeChange(event.target.value)}
              />
              <button className="icon-button px-4" onClick={onJoinGame} aria-label="Rejoindre une partie">
                <LogIn className="h-5 w-5" />
              </button>
            </div>
            <button className="secondary-button w-full" onClick={onLocalGame}>
              Jouer contre l'IA locale
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
