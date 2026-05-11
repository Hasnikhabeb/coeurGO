# Voice Chief of Staff

Petit agent vocal persistant en Python pour l'API OpenAI Realtime.

## Installation

```bash
cd /Users/Arthur/.codex/workspaces/default/voice-chief-of-staff
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Ajoute ta cle dans `.env` :

```bash
OPENAI_API_KEY=sk-...
```

## Lancement

```bash
python agent.py
```

Parle normalement. L'agent utilise la detection vocale serveur, donc il repond quand tu as fini de parler. Stop avec `Ctrl-C`.

## Memoire persistante

Le fichier `memory.md` est recharge au demarrage et ajoute au prompt systeme. Mets-y les informations stables : objectifs, contraintes, style de travail, priorites, habitudes.

## Options

```bash
python agent.py --voice marin --model gpt-realtime
python agent.py --list-devices
python agent.py --input-device 1 --output-device 3
```

La session Realtime dure au maximum environ une heure. Relance le script pour une nouvelle session.
