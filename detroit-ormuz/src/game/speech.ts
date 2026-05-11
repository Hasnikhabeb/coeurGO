let enabled = true;
const queue: string[] = [];
let speaking = false;

export function setSpeechEnabled(value: boolean) {
  enabled = value;
  if (!value && "speechSynthesis" in window) {
    queue.length = 0;
    speaking = false;
    window.speechSynthesis.cancel();
  }
}

export function speakReport(text: string) {
  if (!enabled || !("speechSynthesis" in window)) return;
  const spoken = tacticalVoiceLine(text);
  if (!spoken) return;

  const lastQueued = queue[queue.length - 1];
  if (lastQueued === spoken) return;
  if (queue.length >= 2) queue.shift();
  queue.push(spoken);
  playNext();
}

function playNext() {
  if (!enabled || speaking || !queue.length || !("speechSynthesis" in window)) return;

  speaking = true;
  const spoken = queue.shift()!;

  const utterance = new SpeechSynthesisUtterance(spoken);
  utterance.lang = "fr-FR";
  utterance.rate = 0.86;
  utterance.pitch = 0.72;
  utterance.volume = 0.82;
  utterance.onend = () => {
    speaking = false;
    window.setTimeout(playNext, 180);
  };
  utterance.onerror = () => {
    speaking = false;
    window.setTimeout(playNext, 180);
  };
  window.speechSynthesis.speak(utterance);
}

function tacticalVoiceLine(text: string) {
  const isPlayer = text.startsWith("Commandement Ormuz 2026");
  const isOpponent = text.startsWith("IA coalition");
  const actor = isPlayer ? "Nos forces" : isOpponent ? "Coalition adverse" : "Opérations";
  const coordinate = text.match(/en ([A-J]10|[A-J][1-9])/i)?.[1];
  const position = coordinate ? ` secteur ${coordinate}` : "";

  if (text.includes("Touché")) {
    return `${actor}. Touché confirmé${position}. Priorité feu : verrouillez les cases adjacentes. Achevez la cible.`;
  }

  if (text.includes("Raté")) {
    return `${actor}. Raté${position}. Correction de tir. Ouvrez le quadrillage, changez d'axe.`;
  }

  if (text.includes("Coulé")) {
    return `${actor}. Cible coulée${position}. Bâtiment neutralisé. Reprise du balayage chenal, sécurisez les voies de trafic.`;
  }

  if (text.includes("Mine détectée")) {
    return `${actor}. Mine détectée${position}. Stop manœuvre. Sécurisez la zone, prochain tour compromis.`;
  }

  if (text.includes("Zone brouillée")) {
    return `${actor}. Zone brouillée${position}. Renseignement incertain. Passez reconnaissance, conservez discipline de tir.`;
  }

  return "";
}
