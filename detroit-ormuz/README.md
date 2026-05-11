# Ormuz 2026

Jeu web de stratégie navale en 1 contre 1 inspiré du principe des tirs sur grille cachée, avec une carte stylisée du détroit d'Ormuz : côte iranienne au nord, péninsule de Musandam/Oman au sud et voies de trafic au centre.

## Installation

```bash
npm install
```

## Lancement

```bash
npm run dev
```

Le frontend Vite démarre sur `http://localhost:5173` et le serveur Express/Socket.io sur `http://localhost:3027`.

## Règles du jeu

- Chaque joueur déploie secrètement 5 unités : porte-conteneurs, pétrolier, frégate, patrouilleur rapide et drone naval.
- La grille contient aussi des voies de trafic pétrolier, des zones côtières stylisées et des mines maritimes.
- À votre tour, vous pouvez tirer sur une case adverse ou utiliser une action tactique.
- Résultats possibles : `Raté`, `Touché`, `Coulé`, `Zone brouillée`, `Mine détectée`.
- Le drone révèle une zone de 3 cases, réduite en cas de tempête de sable.
- Le brouillage radar masque le résultat exact du prochain tir adverse.
- Une mine fait perdre le prochain tour au joueur qui la déclenche.
- Les points viennent des tirs réussis, des navires coulés, des séries de précision et de la protection des voies de trafic.

## Architecture

```text
src/
  components/
    ActionPanel.tsx
    EnemyGrid.tsx
    GameBoard.tsx
    GameStatus.tsx
    Lobby.tsx
    PlayerGrid.tsx
    ShipPlacement.tsx
    VictoryScreen.tsx
  game/
    logic.ts
    types.ts
server/
  index.ts
```

## Pistes d'amélioration

- Synchroniser complètement les coups entre deux joueurs humains via Socket.io.
- Ajouter une base de données pour conserver les parties et classements.
- Créer un placement de mines manuel.
- Ajouter plusieurs cartes inspirées de zones maritimes réelles.
- Améliorer l'IA avec ciblage autour des impacts confirmés.
- Ajouter un replay de fin de partie et des animations sonores.
