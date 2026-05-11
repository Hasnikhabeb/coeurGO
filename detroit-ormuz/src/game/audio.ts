type SoundName = "ui" | "launch" | "shot" | "scan" | "jam" | "playerHit" | "opponentHit" | "playerMiss" | "opponentMiss" | "sunk" | "victory";

let context: AudioContext | undefined;
let enabled = true;

function getContext() {
  context ??= new AudioContext();
  if (context.state === "suspended") void context.resume();
  return context;
}

function tone(frequency: number, duration: number, gain: number, type: OscillatorType = "sine", delay = 0) {
  if (!enabled) return;
  const audio = getContext();
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  volume.gain.setValueAtTime(0.0001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.015);
  volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(volume);
  volume.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.03);
}

export function setAudioEnabled(value: boolean) {
  enabled = value;
}

export function playSound(name: SoundName) {
  if (!enabled) return;

  if (name === "ui") tone(520, 0.08, 0.035, "triangle");
  if (name === "launch") {
    tone(160, 0.16, 0.04, "sawtooth");
    tone(260, 0.22, 0.035, "triangle", 0.1);
  }
  if (name === "shot") {
    tone(90, 0.08, 0.05, "square");
    tone(62, 0.18, 0.035, "sawtooth", 0.05);
  }
  if (name === "scan") {
    tone(660, 0.08, 0.025, "sine");
    tone(880, 0.1, 0.022, "sine", 0.08);
  }
  if (name === "jam") {
    tone(120, 0.12, 0.03, "sawtooth");
    tone(118, 0.16, 0.028, "square", 0.03);
  }
  if (name === "playerHit") {
    tone(180, 0.12, 0.055, "square");
    tone(70, 0.24, 0.04, "sawtooth", 0.05);
  }
  if (name === "opponentHit") {
    tone(135, 0.16, 0.055, "sawtooth");
    tone(48, 0.28, 0.045, "square", 0.06);
  }
  if (name === "playerMiss") tone(360, 0.1, 0.022, "triangle");
  if (name === "opponentMiss") {
    tone(230, 0.1, 0.026, "sine");
    tone(180, 0.08, 0.018, "triangle", 0.08);
  }
  if (name === "sunk") {
    tone(120, 0.18, 0.06, "square");
    tone(74, 0.36, 0.05, "sawtooth", 0.08);
    tone(52, 0.42, 0.04, "sawtooth", 0.18);
  }
  if (name === "victory") {
    tone(392, 0.14, 0.035, "triangle");
    tone(523, 0.16, 0.035, "triangle", 0.12);
    tone(784, 0.28, 0.03, "triangle", 0.26);
  }
}
