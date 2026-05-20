/**
 * Web Bluetooth DOM types. `bluetooth` is optional here so feature-detection
 * (`"bluetooth" in navigator`) type-checks correctly; not all browsers expose it.
 */
/// <reference types="web-bluetooth" />

interface Navigator {
  bluetooth?: Bluetooth;
}
