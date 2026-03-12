#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MASTER_ICON = ROOT / "public" / "icons" / "renations-app-icon-master.png"

PNG_SIZES = {
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-512.png": 512,
    "icon-512-maskable.png": 512,
    "favicon-32.png": 32,
    "favicon-16.png": 16,
}


def write_png(icon: Image.Image, destination: Path, size: int) -> None:
    resized = icon.resize((size, size), Image.Resampling.LANCZOS)
    resized.save(destination, format="PNG", optimize=True)


def main() -> None:
    if not MASTER_ICON.exists():
        raise SystemExit(f"Missing source icon: {MASTER_ICON}")

    output_dir = MASTER_ICON.parent
    output_dir.mkdir(parents=True, exist_ok=True)

    with Image.open(MASTER_ICON) as source:
        icon = source.convert("RGBA")

        for filename, size in PNG_SIZES.items():
            write_png(icon, output_dir / filename, size)

        icon.save(output_dir / "favicon.ico", format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])


if __name__ == "__main__":
    main()
