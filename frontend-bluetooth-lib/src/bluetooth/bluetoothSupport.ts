export function isWebBluetoothSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'bluetooth' in navigator &&
    typeof window !== 'undefined' &&
    window.isSecureContext
  );
}

export function getBluetoothUnsupportedReason(): string {
  if (typeof navigator === 'undefined') return 'Not running in browser';
  if (typeof window !== 'undefined' && !window.isSecureContext) {
    return 'Web Bluetooth requires HTTPS. Please access via a secure URL.';
  }
  if (!('bluetooth' in navigator)) {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/.test(ua)) {
      return 'Web Bluetooth is not supported on iOS Safari. Please use an Android device or desktop Chrome.';
    }
    if (/Firefox/.test(ua)) {
      return 'Web Bluetooth is not supported in Firefox. Please use Chrome or Edge.';
    }
    if (/Safari/.test(ua) && !/Chrome/.test(ua)) {
      return 'Web Bluetooth is not supported in Safari. Please use Chrome or Edge.';
    }
    return 'Web Bluetooth is not supported in your browser. Please use Chrome 56+ or Edge 79+.';
  }
  return '';
}
