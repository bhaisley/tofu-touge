# Night Delivery

Original Tofu Touge soundtrack, generated locally with the native ComfyUI YuE2 nodes and the official YuE2 3B BF16 checkpoint. YuE2 composed the melody and chords from the style prompt below. The 97.6-second score excerpt contains 61 measures in C minor at 150 BPM, 271 instrumental notes and a resting vocal part. The audio request used this score with empty lyrics.

> Instrumental, brass-edged 1990s Japanese arcade racing eurobeat, 156 BPM, 4/4, E minor. An urgent syncopated sawtooth lead trades a rising four-note hook with muted electric guitar. Rolling sixteenth-note octave bass, warm analog polyphonic chords, tight four-on-the-floor kick and snare backbeat, open hats. Melodic late-night mountain run, focused and exhilarating, punchy crisp stereo, instrumental solo, no vocals, no singing, no choir, no spoken words.

Both model stages used seed 86112126. The full checkpoint is `yue2_3b_bf16.safetensors`, from [Comfy-Org's YuE2 weights](https://huggingface.co/Comfy-Org/YuE2/tree/2f76ca75e6ee094169de899cc7fc99d6887e2196). The audio decoder used 32 DPM2 steps.

The 48 kHz stereo render is 98.68 seconds long. The edit uses 40 bars from 10.826 to 74.826, with a 70 ms cosine crossfade into the original preroll. The game MP3 decodes to 64.000 seconds, with integrated loudness of -16.5 LUFS and a true peak of -3.9 dBTP.

| Generation record | Value |
| --- | --- |
| YuE2 planning job | `a7c48ea2-c8e6-4e48-bd31-e179c0cdbd36` |
| YuE2 audio job | `8dc8ebd8-6a8f-4b23-902a-e6ea7bc0240e` |
| Source FLAC SHA-256 | `3a2d497999e0738d685fff561c854e0f8948aecdc4e2a53aec6387e4756188e8` |
| Delivery MP3 SHA-256 | `35061ada4d1780634c404dab9f6536acb270656a71f32f88e74d9ce91e996f7d` |

See the [YuE2 model terms](https://github.com/multimodal-art-projection/YuE/blob/main/MODEL_LICENSE) for personal creator permissions and commercial use of the model by companies.
