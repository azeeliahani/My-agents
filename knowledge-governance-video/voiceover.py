"""Generate voiceover/NN.wav for each timeline segment with Piper TTS.
Usage: <venv>/bin/python voiceover.py <voice.onnx>
Uses each segment's "tts" text if present (pronunciation tweaks), else "vo".
Raw TTS is brightened slightly (pitch +3%, EQ, compression) for an upbeat read."""
import json, sys, subprocess, wave, os
from piper import PiperVoice, SynthesisConfig
here = os.path.dirname(os.path.abspath(__file__))
tl = json.load(open(os.path.join(here, 'timeline.json')))
voice = PiperVoice.load(sys.argv[1])
cfg = SynthesisConfig(length_scale=0.86, noise_scale=0.75, noise_w_scale=0.9)
os.makedirs(os.path.join(here, 'voiceover'), exist_ok=True)
for s in tl['segments']:
    raw = os.path.join(here, 'voiceover', f"{s['id']}.raw.wav")
    out = os.path.join(here, 'voiceover', f"{s['id']}.wav")
    with wave.open(raw, 'wb') as w:
        voice.synthesize_wav(s.get('tts', s['vo']), w, syn_config=cfg)
    sr = voice.config.sample_rate
    af = (f"asetrate={sr}*1.03,aresample=48000,atempo={1/1.03:.5f},"
          "highpass=f=80,equalizer=f=3500:t=q:w=1:g=3,"
          "acompressor=threshold=-20dB:ratio=3:attack=5:release=80:makeup=3,"
          "silenceremove=start_periods=1:start_threshold=-45dB,areverse,"
          "silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5")
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-af', af, '-ar', '48000', out], check=True)
    os.remove(raw)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', out], capture_output=True, text=True).stdout)
    print(f"{s['id']} {dur:5.2f}s (slot {s['dur']}s)  {s['vo']}")
