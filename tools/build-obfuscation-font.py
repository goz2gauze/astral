#!/usr/bin/env python3
"""Build the glyph-scrambled font behind Settings -> Privacy -> Font Obfuscation.

The page scrambles its visible text with a fixed cipher (letters rotate by 13,
digits by 5, see js/obfuscate.js). This font maps every scrambled codepoint to
the glyph of the original character, so the scrambled DOM text still renders
as normal reading text while scanners only ever see the cipher.

Source font: Inter (variable, OFL) from Google Fonts:
  https://github.com/google/fonts/raw/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf

Requires fontTools and brotli:
  python3 -m pip install fonttools brotli

Usage:
  python3 tools/build-obfuscation-font.py /path/to/Inter[opsz,wght].ttf
"""

import json
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
OUT = FONT_DIR / "astral-obfuscated.woff2"
MANIFEST = FONT_DIR / "astral-obfuscated.json"
ASCII_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
DIGITS = "0123456789"


def scramble_char(ch: str) -> str:
    if ch in ASCII_LETTERS:
        base = ord("A") if ch.isupper() else ord("a")
        return chr(base + (ord(ch) - base + 13) % 26)
    if ch in DIGITS:
        return str((int(ch) + 5) % 10)
    return ch


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: build-obfuscation-font.py <Inter variable ttf>")

    font = TTFont(sys.argv[1])
    original = {cp: name for cp, name in font.getBestCmap().items()}

    # For every plain character, point the scrambled codepoint at the plain glyph.
    for ch in ASCII_LETTERS + DIGITS:
        glyph = original.get(ord(ch))
        if not glyph:
            raise SystemExit(f"source font is missing {ch!r}")
        target = ord(scramble_char(ch))
        for table in font["cmap"].tables:
            if table.isUnicode():
                table.cmap[target] = glyph

    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_legacy = True
    options.notdef_outline = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(
        unicodes=list(range(0x20, 0x7F))
        + list(range(0xA0, 0x100))
        + list(range(0x2000, 0x2070))
        + list(range(0x20AC, 0x20AD))
        + list(range(0x2190, 0x21A0))
    )
    subsetter.subset(font)

    for name_id, value in {
        1: "Astral Obfuscated",
        4: "Astral Obfuscated",
        6: "AstralObfuscated-Regular",
        16: "Astral Obfuscated",
        17: "Regular",
    }.items():
        font["name"].setName(value, name_id, 3, 1, 0x409)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    font.save(OUT)

    verify_mapping(sys.argv[1], OUT)
    write_manifest()


def glyph_signature(font: TTFont, name: str):
    """Outline + metrics of a glyph, used to prove the remap kept the shape."""
    glyph = font["glyf"][name]
    coords, _, _ = glyph.getCoordinates(font["glyf"])
    return (
        font["hmtx"][name][0],
        font["hmtx"][name][1],
        glyph.xMin,
        glyph.yMin,
        glyph.xMax,
        glyph.yMax,
        tuple(map(tuple, coords)),
    )


def verify_mapping(source_path: str, out_path: Path) -> None:
    """Every scrambled codepoint must draw the glyph of the plain character."""
    source = TTFont(source_path)
    out = TTFont(out_path)
    plain_cmap = source.getBestCmap()
    out_cmap = out.getBestCmap()
    for ch in ASCII_LETTERS + DIGITS:
        cipher = scramble_char(ch)
        expected = glyph_signature(source, plain_cmap[ord(ch)])
        actual = glyph_signature(out, out_cmap[ord(cipher)])
        if expected != actual:
            raise SystemExit(f"mapping mismatch: {cipher!r} does not draw the glyph for {ch!r}")
    print(f"verified {len(ASCII_LETTERS + DIGITS)} scrambled glyph mappings")


def write_manifest() -> None:
    data = {
        "family": "Astral Obfuscated",
        "cipher": "letters rot13 / digits rot5",
        "mapping": {ch: scramble_char(ch) for ch in ASCII_LETTERS + DIGITS},
    }
    MANIFEST.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST}")


if __name__ == "__main__":
    main()
