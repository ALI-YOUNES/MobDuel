// Generates a 4-character room code (e.g. "AB12").
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';

export function generateRoomCode(length = 4): string {
  let code = '';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}
