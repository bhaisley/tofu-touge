"""Pack the static game and its assets into a double-clickable offline HTML file."""
import base64
import json
import mimetypes
import re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
DIST = PROJECT / "dist"


def data_url(path):
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def inline_scripts(match):
    src = DIST / match.group(1)
    code = src.read_text(encoding="utf-8").replace("</script", "<\\/script")
    return f"<script>\n{code}\n</script>"


def main():
    html = (DIST / "index.html").read_text(encoding="utf-8")
    css = (DIST / "style.css").read_text(encoding="utf-8")
    css = re.sub(r"url\('([^']+)'\)", lambda m: "url('" + data_url(DIST / m[1]) + "')", css)
    html = re.sub(r'  <link rel="preload"[^>]+>\n', "", html)
    html = html.replace('<link rel="stylesheet" href="style.css">', "<style>\n" + css + "\n</style>")

    banks = {
        "TougeMusicURLs": "assets/music/*.mp3",
        "TougeArtURLs": "assets/art/*.webp",
        "TougeEmbeddedAudio": "assets/sfx/*.wav",
    }
    # Covers already live in the stylesheet. Keep the remaining binary assets
    # outside executable JavaScript so opening the game does not compile 28 MB
    # of string literals before the controls can respond.
    payload = []
    for bank, pattern in banks.items():
        for asset in sorted(DIST.glob(pattern)):
            if asset.name not in {"haruna-dawn.webp", "haruna-night.webp"}:
                payload.append(
                    f'<script type="application/octet-stream" data-bank="{bank}" '
                    f'data-name="{asset.name}">{data_url(asset)}</script>'
                )
    licenses = {
        "Three.js (MIT)": (DIST / "vendor/THREE-LICENSE.txt").read_text(encoding="utf-8"),
        "Barlow (SIL OFL)": (DIST / "assets/fonts/OFL.txt").read_text(encoding="utf-8"),
        "Poly Haven materials (CC0)": {
            "license": "https://polyhaven.com/license",
            "Asphalt 04, Sergej Majboroda and Jenelle van Heerden": "https://polyhaven.com/a/asphalt_04",
            "Gravel Floor 03, Charlotte Baglioni": "https://polyhaven.com/a/gravel_floor_03",
            "Forest Ground 01, Rob Tuytel": "https://polyhaven.com/a/forrest_ground_01",
            "Mossy Stone Wall, Amal Kumar": "https://polyhaven.com/a/mossy_stone_wall",
            "Rock Face 03, Dario Barresi and Rico Cilliers": "https://polyhaven.com/a/rock_face_03",
            "Leafy Grass, Charlotte Baglioni": "https://polyhaven.com/a/leafy_grass",
            "Aerial Grass Rock, Rob Tuytel": "https://polyhaven.com/a/aerial_grass_rock",
        },
    }
    bootstrap = """<script>
    for (const asset of document.querySelectorAll('script[data-bank]')) {
      const bank = window[asset.dataset.bank] ||= {};
      const name = asset.dataset.name;
      Object.defineProperty(bank, name, {
        enumerable: true, configurable: true, get() {
          const url = asset.textContent;
          Object.defineProperty(bank, name, { value: url, enumerable: true });
          asset.remove();
          return url;
        }
      });
    }
    Object.defineProperties(window, {
      TougeMusicURL: {get: () => TougeMusicURLs['night-delivery.mp3']},
      TougeSkyURL: {get: () => TougeArtURLs['haruna-sky.webp']},
      TougeGroundURL: {get: () => TougeArtURLs['forest-floor.webp']},
      TougeTreesURL: {get: () => TougeArtURLs['haruna-trees.webp']}
    });
    </script>"""
    notices = '<script type="application/json" id="third-party-notices">' + json.dumps(licenses) + "</script>"
    first_script = '<script defer src="vendor/three.min.js">'
    html = html.replace(first_script, "\n".join([notices, *payload, bootstrap, first_script]))
    html = re.sub(r'<script defer src="([^"]+)"></script>', inline_scripts, html)
    out = PROJECT / "Tofu Touge.html"
    out.write_text(html, encoding="utf-8")
    print(f"{out.name} · {out.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
