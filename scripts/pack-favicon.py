"""Bundle the rendered favicon PNGs into app/favicon.ico.

Run automatically by scripts/generate-icons.mjs.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ICONS = ROOT / "public" / "icons"
FAVICON = ROOT / "app" / "favicon.ico"


def main() -> None:
    source = Image.open(ICONS / "favicon-64x64.png").convert("RGBA")
    source.save(
        FAVICON,
        format="ICO",
        sizes=[(16, 16), (32, 32), (48, 48), (64, 64)],
    )
    print(f"Wrote {FAVICON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
