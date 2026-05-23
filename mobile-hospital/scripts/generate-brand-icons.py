#!/usr/bin/env python3
"""Regenerate launcher icons from logo.jpg with safe-zone padding (Android adaptive icons crop edges)."""

from __future__ import annotations

from pathlib import Path

try:
    from PIL import Image
except ImportError:
    raise SystemExit("Install pillow: pip install pillow")

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets" / "images"
LOGO_PATH = ASSETS / "logo.jpg"

# Android adaptive icon masks ~outer 17%; keep artwork in ~66% diameter safe zone.
ADAPTIVE_LOGO_RATIO = 0.58
# Standard app icon (iOS/Android store) — slight inset so rounded corners do not clip.
APP_ICON_LOGO_RATIO = 0.72
SPLASH_LOGO_RATIO = 0.42
FAVICON_LOGO_RATIO = 0.82


def fit_logo_on_canvas(size: int, logo_ratio: float, background: tuple[int, int, int] = (255, 255, 255)) -> Image.Image:
    logo = Image.open(LOGO_PATH).convert("RGBA")
    canvas = Image.new("RGBA", (size, size), (*background, 255))
    inner = int(size * logo_ratio)
    logo.thumbnail((inner, inner), Image.Resampling.LANCZOS)
    x = (size - logo.width) // 2
    y = (size - logo.height) // 2
    canvas.paste(logo, (x, y), logo)
    return canvas.convert("RGB")


def write_rgb(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, format="PNG", optimize=True)
    print(f"wrote {path.name} ({img.width}x{img.height})")


def main() -> None:
    if not LOGO_PATH.is_file():
        raise SystemExit(f"Missing {LOGO_PATH}")

    write_rgb(fit_logo_on_canvas(1024, APP_ICON_LOGO_RATIO), ASSETS / "icon.png")
    write_rgb(fit_logo_on_canvas(1024, ADAPTIVE_LOGO_RATIO), ASSETS / "android-icon-foreground.png")
    write_rgb(Image.new("RGB", (1024, 1024), (255, 255, 255)), ASSETS / "android-icon-background.png")
    write_rgb(fit_logo_on_canvas(432, ADAPTIVE_LOGO_RATIO), ASSETS / "android-icon-monochrome.png")
    write_rgb(fit_logo_on_canvas(512, SPLASH_LOGO_RATIO), ASSETS / "splash-icon.png")
    write_rgb(fit_logo_on_canvas(192, FAVICON_LOGO_RATIO), ASSETS / "favicon.png")


if __name__ == "__main__":
    main()
