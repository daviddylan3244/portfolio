// Shared by the landing page title and the /clothing gallery panel.
export const SCRAMBLE_CHARS = '!<>-_\\/[]{}=+*^?#$%&@ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

// Timing matches the old 60fps frame counts: characters started every
// 1/0.42 frames (~40ms) and locked after 13 + 0–18 frames (~217–517ms).
export const SCRAMBLE_FRAME_MS = 1000 / 60;
export const SCRAMBLE_START_INTERVAL_MS = SCRAMBLE_FRAME_MS / 0.42;
export const SCRAMBLE_MIN_MS = 13 * SCRAMBLE_FRAME_MS;
export const SCRAMBLE_EXTRA_MS = 18 * SCRAMBLE_FRAME_MS;

export function randomScrambleChar() {
  return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
}
