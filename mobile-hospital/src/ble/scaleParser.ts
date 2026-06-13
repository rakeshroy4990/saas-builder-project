/** Mi scale weight parser — mirrors frontend-bluetooth-lib `parseScaleData`. */
export function parseScaleWeightKg(bytes: Uint8Array): number | null {
  try {
    if (bytes.byteLength < 13) {
      return null;
    }
    const stabilized = (bytes[1]! & 0x04) !== 0;
    if (!stabilized) {
      return null;
    }
    const raw = bytes[11]! | (bytes[12]! << 8);
    return raw / 100;
  } catch {
    return null;
  }
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
