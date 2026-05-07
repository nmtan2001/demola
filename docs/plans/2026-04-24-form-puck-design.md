# Form Puck - Edge AI Camera for Gym Form Analysis

## Problem Statement

Novice lifters perform exercises with bad form, risking injury. They cannot look at a screen while lifting heavy weights. Existing solutions require cloud processing, raising privacy concerns. The Form Puck is a standalone edge AI camera device that provides real-time form feedback via LED + audio cues, with no video data ever leaving the device.

## Product Vision

A small, magnetic camera puck that sticks to gym racks or walls. LED ring (green/yellow/red) + audio cues for instant non-visual feedback. Bluetooth-only connectivity (no WiFi) to sync session summaries as text data to a companion app. All AI inference runs on-device.

## Prototype Scope (Demo Phase)

### Hardware Path
1. **Phase 1 (Current):** Laptop/PC with webcam - prove the AI logic and GUI
2. **Phase 2 (Later):** Raspberry Pi 5 + camera module - prove edge deployment

### Target Exercise
- **Squat** (primary) with extensible architecture for deadlift, bench press, etc.

### Tech Stack
- Python 3
- MediaPipe Pose (33 3D landmarks, model_complexity=1)
- OpenCV (camera capture, frame processing)
- PyQt5 (GUI dashboard)
- pygame (audio feedback)

---

## Architecture

Three-layer design, each layer decoupled via frame/result queues:

```
Camera Layer       -->  Processing Layer          -->  Feedback Layer
(OpenCV capture)      (MediaPipe + rules engine)     (GUI + audio)
```

### Camera Layer
- OpenCV VideoCapture at 640x480, targeting 30 FPS
- Abstract interface (`base_camera.py`) so RPi `picamera2` is a drop-in replacement later
- Frames never touch disk or network

### Processing Layer

Each frame goes through:

1. **Pose Extraction** (`pose_extractor.py`): MediaPipe Pose extracts 33 3D landmarks
2. **Angle Calculation** (`angle_calculator.py`): Vector math computes joint angles from landmarks
3. **Rep Detection** (`rep_detector.py`): State machine tracks exercise phases
4. **Form Scoring** (`form_scorer.py`): Evaluates configurable thresholds per exercise

### Feedback Layer
- **Dashboard** (`dashboard.py`): PyQt5 GUI with skeleton overlay, metrics, LED simulation
- **Audio** (`audio_feedback.py`): Beeps on rep completion, tone on bad form
- **Session Logger** (`session_logger.py`): Records data for after-action report

---

## Squat Analysis Logic

### Joint Angles Calculated

| Angle | Landmarks Used | Purpose |
|---|---|---|
| Knee angle | hip-knee-ankle | Squat depth |
| Hip angle | shoulder-hip-knee | Forward lean |
| Back angle | shoulder-hip vs vertical | Back rounding risk |
| Knee tracking | knee vs foot center lateral | Knee cave (valgus) |

### Rep Detection State Machine

```
STANDING --> DESCENDING (hip Y approaches knee Y)
DESCENDING --> BOTTOM (hip Y below threshold for >0.3s)
BOTTOM --> ASCENDING (hip Y rising above knee Y)
ASCENDING --> STANDING (hip Y stable at top) --> increment rep count
```

### Form Scoring (per rep, 0-100 base)

| Fault | Deduction | Detection |
|---|---|---|
| Back rounding (>45 deg forward lean) | -20 pts | Shoulder-hip vertical angle |
| Insufficient depth (knee > 110 deg) | -15 pts | Hip-knee-ankle angle |
| Knee cave (valgus > 15 deg) | -15 pts | Knee lateral deviation |
| Asymmetric descent | -10 pts | Left vs right hip-knee diff |
| Speed too fast (bounce at bottom) | -10 pts | Frame-to-frame hip velocity |

---

## GUI Dashboard

### Layout (Single Window)

**Left Zone (70% width) - Live Camera Feed:**
- Webcam feed with MediaPipe skeleton overlay
- Joints color-coded: green (OK), yellow (approaching limit), red (fault)
- Angle annotations at joint locations
- Current rep state as text overlay

**Right Zone (30% width) - Metrics Panel:**
- Simulated LED ring indicator (green = good, flashing red = bad)
- Rep counter (large number)
- Current form score with progress bar
- Live metrics: knee angle, back angle, depth status, knee tracking
- Exercise selector dropdown (extensible)

**Bottom Zone - Session Summary:**
- Total reps, average form score, most common fault
- "End Session" button for final after-action report

### Audio Feedback
- Short beep on completed rep (positive reinforcement)
- Continuous low tone while bad form detected (corrective)
- Distinct tones for different fault types

---

## Project Structure

```
form-puck/
├── main.py                    # Entry point, wires layers together
├── config/
│   ├── exercises/
│   │   ├── squat.json         # Squat thresholds and angle rules
│   │   └── deadlift.json      # Future: Deadlift config
│   └── app_config.json        # Camera index, resolution, FPS target
├── camera/
│   ├── base_camera.py         # Abstract camera interface
│   └── webcam_camera.py       # OpenCV webcam implementation
├── processing/
│   ├── pose_extractor.py      # MediaPipe Pose wrapper
│   ├── angle_calculator.py    # Vector math for joint angles
│   ├── rep_detector.py        # State machine for rep counting
│   ├── form_scorer.py         # Threshold evaluation + scoring
│   └── exercise_analyzer.py   # Combines all processing for one exercise
├── feedback/
│   ├── dashboard.py           # PyQt5 GUI dashboard
│   ├── skeleton_renderer.py   # Color-coded skeleton drawing
│   └── audio_feedback.py      # Sound alerts via pygame
├── session/
│   └── session_logger.py      # Records rep data, generates reports
├── requirements.txt
└── README.md
```

---

## Extensibility Design

Adding a new exercise requires:
1. Create a JSON config file in `config/exercises/` defining thresholds and which angles to track
2. Define the rep state machine transitions (or reuse the generic descending/ascending model)
3. No changes to processing pipeline code -- it reads angles and thresholds from config

## Privacy Architecture

- No networking code in the prototype
- Session data saved as local JSON files (same format as future Bluetooth sync payload)
- On RPi: no WiFi module, optional Bluetooth for text-only data transfer
- Video frames processed in memory, never persisted

---

## Research References

### Latest Research (2024-2026)
- Raspberry Pi 5 + AI HAT+ runs real-time pose estimation at 30+ FPS (26 TOPS)
- REBA/RULA ergonomic scoring on RPi 4B+ at 15+ FPS with INT8 quantization (SSRG, 2026)
- ViT-based skeleton-free ergonomic classification (F1 > 0.99) (PMC, 2025)
- VERA privacy framework: on-device Canny obfuscation for unidentifiable pose tracking (Applied Sciences, 2026)

### Key Frameworks
- **MediaPipe BlazePose**: 33 3D landmarks, optimized for edge, world coordinate output
- **YOLO26-Pose**: NMS-free inference, deterministic latency on edge TPUs
- **LiteRT** (formerly TF Lite): Unified NPU API for cross-device deployment
- **Sony AITRIOS IMX500**: AI on camera sensor chip (max privacy reference architecture)
