"""Render the Tofu Touge effects with SuperCollider and master the PCM loops.

    python3 sound/sfx/render.py
    python3 sound/sfx/render.py --engine-only
    python3 sound/sfx/render.py --trueno
    python3 sound/sfx/render.py --turbo-tires
    python3 sound/sfx/render.py --only turbo-spool

Requires Python 3 and SuperCollider. Set SCLANG to a custom sclang executable
if it is outside PATH and the standard macOS application directory.
"""

import argparse
import array
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import wave


HERE = Path(__file__).resolve().parent
DEST = HERE.parents[1] / "dist" / "assets" / "sfx"
RATE = 32000
FIRING = {
    "engine-idle": 32, "engine-low": 80, "engine-drive": 120, "engine-high": 220,
    "engine-coast": 120, "engine-intake": 180,
}
# Fraction of one firing interval. Compensate for measured differences in
# acoustic delay through the header, airbox and muffler. Adjacent loaded
# recordings then reinforce each other as playback moves between them.
ACOUSTIC_PHASE = {
    "engine-idle": -0.120, "engine-low": -0.045, "engine-drive": 0.023,
    "engine-high": -0.127, "engine-coast": 0.148, "engine-intake": -0.135,
    "trueno-idle": -0.167, "trueno-low": 0, "trueno-drive": 0.138,
    "trueno-high": 0.463, "trueno-coast": 0.314, "trueno-intake": 0.400,
}
LOOPS = {
    "engine-idle": 3.75, "engine-low": 3.0, "engine-drive": 3.0,
    "engine-high": 4.0, "engine-coast": 3.0, "engine-intake": 4.0,
    "tire-scrub": 3.0, "tire-squeal": 3.0, "tire-front": 3.0, "tire-lock": 3.0,
    "turbo-spool": 3.0, "road-air": 2.5,
}
CUES = ["shift", "overrun", "blowoff", "afterfire", "impact", "checkpoint", "go", "finish"]
NEO_ENGINE = list(FIRING)
TRUENO_ENGINE = [name.replace("engine-", "trueno-") for name in NEO_ENGINE]
for original, trueno in zip(NEO_ENGINE, TRUENO_ENGINE):
    FIRING[trueno] = FIRING[original]
    LOOPS[trueno] = LOOPS[original]


def read_wav(path):
    with wave.open(str(path), "rb") as wav:
        assert (wav.getnchannels(), wav.getsampwidth(), wav.getframerate()) == (1, 2, RATE)
        samples = array.array("h", wav.readframes(wav.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def loop_cut(raw, name):
    first = RATE // 2
    length = round(LOOPS[name] * RATE)
    blend = round(RATE * 0.10)
    if name in FIRING:
        # The synth starts at 8 ms. Warm up for ten complete 720-degree
        # cycles of the common crank modulation, then align the pressure wave.
        first = round(RATE * (0.008 + (40.74 + ACOUSTIC_PHASE[name]) / FIRING[name]))
        periods = LOOPS[name] * FIRING[name] / 40
        assert abs(periods - round(periods)) < 1e-8
    else:
        first = min(range(first, first + 260), key=lambda i: abs(raw[i + length] - raw[i + length - 1]))
    assert len(raw) >= first + length + blend
    samples = list(raw[first:first + length])
    for i in range(blend):
        t = i / (blend - 1)
        if name in FIRING:
            new = 0.5 - 0.5 * math.cos(t * math.pi)
            old = 1 - new
        else:
            new = math.sin(t * math.pi / 2)
            old = math.cos(t * math.pi / 2)
        samples[i] = old * raw[first + length + i] + new * raw[first + i]
    if name in FIRING:
        # Restrict seam selection to integer periods of the crank variation.
        periods = round(periods)
        candidates = (round(cycle * length / periods) for cycle in range(periods))
        seam = min(candidates, key=lambda k: abs(samples[k] - samples[k - 1]))
        samples = samples[seam:] + samples[:seam]
    return samples


def level_engine(samples):
    # Preserve the leading edge of each stroke and gently saturate only the
    # top of the pressure peaks. Voices with more turbulent gas or sharper
    # valve noise then retain the same perceived level across the crossfade.
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    target = 0.21 * 32768
    knee = 0.50 * 32768
    headroom = 0.35 * 32768
    gain = target / max(1, rms)
    for _ in range(4):
        shaped = []
        for sample in samples:
            value = sample * gain
            magnitude = abs(value)
            if magnitude > knee:
                magnitude = knee + headroom * math.tanh((magnitude - knee) / headroom)
                value = math.copysign(magnitude, value)
            shaped.append(value)
        attained = math.sqrt(sum(x * x for x in shaped) / len(shaped))
        if abs(attained - target) < target * 0.001:
            break
        gain *= target / attained
    return shaped


def master(raw_path, dest, name):
    raw = read_wav(raw_path)
    if name in LOOPS:
        samples = loop_cut(raw, name)
        if name in FIRING:
            samples = level_engine(samples)
            gain = 1
        else:
            rms = math.sqrt(sum(s * s for s in samples) / len(samples))
            gain = min(0.21 * 32768 / max(1, rms), 0.85 * 32768 / max(map(abs, samples)))
    else:
        first = next(i for i, value in enumerate(raw) if abs(value) > 12)
        last = next(i for i in reversed(range(len(raw))) if abs(raw[i]) > 12)
        samples = list(raw[max(0, first - 50):min(len(raw), last + 240)])
        gain = 0.83 * 32768 / max(map(abs, samples))
        # The last 2 ms also cover the guard-rail resonance, which can continue
        # beneath the audible noise floor at the end of its short render.
        for i in range(64):
            samples[-64 + i] *= (63 - i) / 63
    pcm = array.array("h", (int(round(s * gain)) for s in samples))
    if sys.byteorder != "little":
        pcm.byteswap()
    with wave.open(str(dest), "wb") as wav:
        wav.setparams((1, 2, RATE, len(samples), "NONE", "not compressed"))
        wav.writeframes(pcm.tobytes())
    print(f"{name}.wav  {len(samples) / RATE:.3f} s  {dest.stat().st_size:,} bytes")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    bank = parser.add_mutually_exclusive_group()
    bank.add_argument("--engine-only", action="store_true", help="Render the engine, lift and shifter")
    bank.add_argument("--trueno", action="store_true", help="Render the naturally aspirated Trueno engine bank")
    bank.add_argument("--turbo-tires", action="store_true", help="Render the turbo, tailpipe pops and tire voices")
    bank.add_argument("--only", choices=[*LOOPS, *CUES], help="Render a single named effect")
    args = parser.parse_args()
    sclang = os.environ.get("SCLANG") or shutil.which("sclang") or "/Applications/SuperCollider.app/Contents/MacOS/sclang"
    with tempfile.TemporaryDirectory(prefix="tofu-touge-sfx-") as temp:
        env = dict(os.environ, TOFU_SFX_RAW=temp, TOFU_SFX_ENGINE_ONLY="1" if args.engine_only else "0",
                   TOFU_SFX_TURBO_TIRES="1" if args.turbo_tires else "0",
                   TOFU_SFX_TRUENO="1" if args.trueno else "0", TOFU_SFX_ONLY=args.only or "")
        if sys.platform.startswith("linux"):
            env.setdefault("QT_QPA_PLATFORM", "offscreen")
        subprocess.run([sclang, "-D", str(HERE / "render.scd")], env=env, check=True, timeout=75)
        names = [*LOOPS, *CUES]
        if args.engine_only:
            names = [*NEO_ENGINE, "overrun", "shift"]
        elif args.trueno:
            names = TRUENO_ENGINE
        elif args.turbo_tires:
            names = [name for name in names if name.startswith("tire-") or name in ("turbo-spool", "blowoff", "afterfire")]
        elif args.only:
            names = [args.only]
        DEST.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".master-", dir=DEST) as staged:
            for name in names:
                filename = f"{name}.wav"
                master(Path(temp) / filename, Path(staged) / filename, name)
            for name in names:
                filename = f"{name}.wav"
                (Path(staged) / filename).replace(DEST / filename)


if __name__ == "__main__":
    main()
