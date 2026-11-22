# Haruna Pass radio sessions

Four original cues for Tofu Touge, composed and performed locally with YuE2. The first pass generated a two-part ABC score from the style prompt and section sheet. On the jazz-hop and lo-fi cues, the written melody was assigned to the instrumental part and the vocal part received rests. Daybreak Signal and Kōri no Hibana use original Japanese lyrics. The audio pass used the finished score, the same seed, and the 3B BF16 checkpoint with 32 DPM2 decoder steps. [YuE2 checkpoint revision](https://huggingface.co/Comfy-Org/YuE2/tree/2f76ca75e6ee094169de899cc7fc99d6887e2196)

| Cue | Score | Driving edit | Integrated level | True peak |
| --- | --- | --- | --- | --- |
| [Cedar Afterglow](cedar-afterglow.abc) · Jazz-hop | C, 4/4, 92 BPM | 16 bars, 41.740 s | -16.7 LUFS | -3.2 dBTP |
| [Rain on the Engawa](rain-on-the-engawa.abc) · Lo-fi | Bbm, 2/4, 76 BPM | 40 bars, 63.150 s | -17.6 LUFS | -1.9 dBTP |
| [Daybreak Signal](daybreak-signal.abc) · J-pop | Bb, 4/4, 143 BPM | 48 bars, 80.250 s | -16.6 LUFS | -3.4 dBTP |
| [Kōri no Hibana](kori-no-hibana.abc) · Kawaii metal | D♯m, 4/4, 180 BPM | 68 bars, 90.600 s | -16.5 LUFS | -4.7 dBTP |

The master edits use matching attacks an integral number of measures apart. Each ends in a short raised-cosine blend into the material immediately preceding its start. Cuts are listed in seconds from the beginning of the generated stereo FLAC. The MP3 files carry a gapless header. Each was decoded and checked for exact sample count, peak level, and the sample step across the wrap at 48 kHz. Night Delivery measures −16.5 LUFS in the same mix.

## Cedar Afterglow

> Japanese instrumental jazz hip-hop, 92 BPM boom bap in 4/4. Airy flute and a soft acoustic grand trade an original, lyrical call-and-response over warm Rhodes major-ninth and minor-seventh voicings. A nimble round upright bass, gently shuffled dusty drum break, rimshot backbeat and delicate brushing on the ride. Wistful golden-hour warmth, pentatonic turns, a human pocket. Clear stereo, short soft room reverb, solely instrumental.

Seed `86092114` produced a 53.72-second stereo render. The game uses 2.746–44.486 s with a 75 ms crossfade.

| Generation record | Value |
| --- | --- |
| YuE2 planning job | `7405d447-19f6-48ce-9d56-7802f8c66c51` |
| YuE2 audio job | `3b107c3a-f677-4506-8f88-010cef25862e` |
| Generated FLAC SHA-256 | `cedc7159204fca90b2990c5b9bf6b571d4ee8099f91bf050d053f44b9a1c356b` |
| Shipped MP3 SHA-256 | `f14690f249eaf83e63871d1ba4689f9b6e10fa629f09cbf0430ff567ce554900` |

## Rain on the Engawa

> Mellow Japanese lo-fi instrumental hip-hop, slow 76 BPM in 4/4, small intimate rainy wooden veranda at night. A spare gently detuned felt electric piano repeats a minor add-nine figure, answered by isolated silk koto plucks, long rests, rounded electric bass, muted brushed kick and side-stick with ghost taps. Gentle cassette wow and very faint vinyl texture. Soft rolled-off highs, close warm stereo. Understated and spacious, no singing.

Seed `86120314` produced a 101.36-second stereo render. The game uses 15.706–78.856 s with a 100 ms crossfade.

| Generation record | Value |
| --- | --- |
| YuE2 planning job | `f5b5ce76-0669-41e5-afb6-cf286b12f05b` |
| YuE2 audio job | `43c4eafa-3cdf-4ecd-90e8-a062cab1fdd2` |
| Generated FLAC SHA-256 | `eda743e8fa5b2e829a2bfe62916808f30793680fdc462e19de8ffdbf98b2160e` |
| Shipped MP3 SHA-256 | `cf6e5a69791c2c1628a883084faeac5b51abdca5f27de9691274c26a73420464` |

## Daybreak Signal

> Japanese language, female lead singer, 148 BPM melodic J-pop in 4/4. Bright, buoyant early-morning city-pop guitar band with a soaring modern anime-opening chorus. Clear Japanese melody, bright octave guitar answers, sparkling synth arpeggios and piano, melodic moving electric bass, fast crisp acoustic drums, vocal doubles on the chorus. Aim for a compact verse, a climbing pre-chorus, a joyous singalong refrain, and a four-bar instrumental turn. Warm optimistic polished stereo.

Seed `86081855` produced a 98.64-second stereo render. The game uses 12.986–93.236 s with a 65 ms crossfade.

| Generation record | Value |
| --- | --- |
| YuE2 planning job | `8560a196-46b7-4065-9599-f4ab95e1fb8a` |
| YuE2 audio job | `1060209a-bd16-4ec1-aff3-ac347a9af091` |
| Generated FLAC SHA-256 | `72e9f5bdbb2a3117cd24014a06e820751064a3ad36b7e6eca16e6b6f2f5030ef` |
| Shipped MP3 SHA-256 | `20e3c8322c8686e95e41b609d72402abfdb2aedf5d60445c0acfdbbf6628e42c` |

### Original lyric sheet

```text
[Intro]

[Verse]
雨上がりの　白いガードレール
遠い街は　まだ夢の中
曲がるたびに　ほどけてゆく
青い霧の　向こう側

[Pre-Chorus]
窓をあけて　朝を呼んだ
風がそっと　背中を押す

[Chorus]
ひかれ　ひかれ　夜明けの合図
山を越えて　きみに届け
ひかれ　ひかれ　わたしの声
朝焼けへ　走り出そう

[Instrumental]

[Chorus]
ひかれ　ひかれ　夜明けの合図
山を越えて　きみに届け
ひかれ　ひかれ　わたしの声
朝焼けへ　走り出そう

[Outro]
```

## Kōri no Hibana

氷の火花 means “Ice Sparks.” YuE2 composed the two-part D-sharp minor score. The radio arrangement opens with four bars of the guitar riff and moves into a sixteen-bar verse, eight-bar pre-chorus and sixteen-bar refrain. An eight-bar half-time break pairs short shouted notes with low instrumental stops, followed by the full refrain and four closing bars.

> Japanese kawaii metal, 172 BPM, E minor in 4/4. A high clear Japanese woman sings a bright major-leaning pentatonic refrain over a minor drop-tuned seven-string riff. A small group answers her short calls in tight unison. Wide palm-muted sixteenth-note guitars with clipped syncopated stops, sharply pitched bass, relentless acoustic double-kick and bright snare. An opening riff, compact verse, a rising two-line pre-chorus, a big doubled vocal chorus, then an abrupt halftime breakdown with shouted counts before the final chorus. The guitars push against the simple singable hook, bright stereo studio rock production.

Seed `861121573` produced a 96.56-second stereo performance of the arranged score. The driving loop uses 2.876–93.476 s with a 72 ms crossfade. Its 48 kHz stereo MP3 decodes to 4,348,800 samples per channel.

| Generation record | Value |
| --- | --- |
| YuE2 planning job | `01b1289e-2482-4cbe-9d60-f8c148fb5f39` |
| YuE2 audio job | `41ef6a49-3099-4b0d-8a4e-a1bef7e4c446` |
| Generated FLAC SHA-256 | `75d5dde44817413cb63bfd605146ce8a86b93493356fff86ec0ce9e668c5e60f` |
| Shipped MP3 SHA-256 | `1bea9aafda207cead0f8361caa5d8fb36c2d40e7147c2abf82e2a8e100db3af4` |

### Original lyric sheet

```text
[Intro]
せーの！

[Verse]
息をひそめた　峠のミラー
月を二つに　割るヘアピン
手袋の奥　脈を数えて
凍る朝へと　弧を描く

[Pre-Chorus]
白い静けさ　あと一秒
胸の拍で　灯をともせ

[Chorus]
氷の火花　ぱっと咲け
ひとつ　ふたつ　星になれ
氷の火花　声を合わせ
夜の継ぎ目を　飛び越えて

[Breakdown]
一拍　ためて
せーの！　鳴らせ！

[Chorus]
氷の火花　ぱっと咲け
ひとつ　ふたつ　星になれ
氷の火花　声を合わせ
夜の継ぎ目を　飛び越えて

[Outro]
せーの！　朝が来る
```
