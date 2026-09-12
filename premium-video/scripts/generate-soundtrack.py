from __future__ import annotations
import math
import random
import struct
import wave
from pathlib import Path

SR = 48000
DURATION = 29.0
N = int(SR * DURATION)
random.seed(17)

left = [0.0] * N
right = [0.0] * N

def add_sine(t0: float, duration: float, freq: float, amp: float, decay: float = 5.0, stereo: float = 0.0):
    start = max(0, int(t0 * SR))
    end = min(N, int((t0 + duration) * SR))
    for i in range(start, end):
        t = (i - start) / SR
        env = (1.0 - min(1.0, t / max(duration, 1e-6))) ** 1.5 * math.exp(-decay * t / max(duration, 1e-6))
        s = math.sin(2 * math.pi * freq * t) * amp * env
        left[i] += s * (1.0 - max(0.0, stereo))
        right[i] += s * (1.0 + min(0.0, stereo))

def add_click(t0: float, amp: float = 0.12):
    start = int(t0 * SR)
    length = int(0.035 * SR)
    for j in range(length):
        i = start + j
        if i >= N:
            break
        env = (1 - j / length) ** 5
        s = (random.random() * 2 - 1) * amp * env
        left[i] += s
        right[i] += s

def add_whoosh(t0: float, duration: float = 0.55, amp: float = 0.085, pan: float = 0.0):
    start = max(0, int(t0 * SR))
    end = min(N, int((t0 + duration) * SR))
    lp = 0.0
    for i in range(start, end):
        x = random.random() * 2 - 1
        lp += 0.045 * (x - lp)
        t = (i - start) / max(1, end - start)
        env = math.sin(math.pi * t) ** 1.7
        s = lp * amp * env * 5
        left[i] += s * (1.0 - pan * 0.35)
        right[i] += s * (1.0 + pan * 0.35)

def add_tone_bed():
    for i in range(N):
        t = i / SR
        base = 0.013 * math.sin(2 * math.pi * 46.2 * t) + 0.006 * math.sin(2 * math.pi * 92.4 * t)
        pulse = 0.55 + 0.45 * (math.sin(2 * math.pi * 0.125 * t) * 0.5 + 0.5)
        left[i] += base * pulse
        right[i] += base * pulse

add_tone_bed()
for t in [0.0, 3.35, 7.3, 13.35, 19.0, 23.45]:
    add_sine(t, 0.72, 52, 0.22, decay=6.5)
    add_sine(t, 0.42, 104, 0.065, decay=8.0)
    add_whoosh(max(0, t - 0.22), 0.55, 0.085, pan=(-1 if int(t) % 2 else 1))

for t in [0.7, 1.15, 1.55, 4.4, 4.85, 5.3, 8.4, 8.95, 9.5, 10.05, 14.1, 15.0, 16.0, 19.8, 20.55, 21.25, 22.0, 24.4, 25.2, 26.0]:
    add_click(t, 0.085)

for t, f in [(7.65, 270), (8.15, 320), (8.65, 370), (16.4, 220), (17.0, 260), (17.6, 310), (27.0, 165)]:
    add_sine(t, 0.22, f, 0.035, decay=7.0)

peak = max(max(abs(x) for x in left), max(abs(x) for x in right), 1e-9)
scale = 0.91 / peak
out = Path('public/soundtrack.wav')
out.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(out), 'wb') as wf:
    wf.setnchannels(2)
    wf.setsampwidth(2)
    wf.setframerate(SR)
    frames = bytearray()
    for l, r in zip(left, right):
        li = int(max(-1, min(1, l * scale)) * 32767)
        ri = int(max(-1, min(1, r * scale)) * 32767)
        frames.extend(struct.pack('<hh', li, ri))
    wf.writeframes(frames)
print(out)
