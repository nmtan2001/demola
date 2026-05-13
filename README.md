# Form Puck

Edge AI gym form checker. Runs entirely on-device using a webcam - no cloud, no data leaving the machine.

Built as a Demola university project prototype. Target hardware is laptop/webcam now, Raspberry Pi 5 later.

## What It Does

- Detects body pose in real-time using MediaPipe
- Tracks reps for squat, bicep curl, and deadlift
- Scores form and flags common faults (back rounding, knee cave, elbow swing, etc.)
- Gives audio + voice feedback ("Chest up", "Go deeper", "Knees out")
- Streams a web dashboard with live skeleton overlay, rep counter, score bar, and angle metrics

## Architecture

```
Camera Layer        Processing Layer           Feedback Layer
+-------------+    +------------------+       +------------------+
| WebcamCamera|--->| PoseExtractor    |------>| Dashboard (Flask) |
| (OpenCV)    |    | AngleCalculator  |       | AudioFeedback    |
|             |    | RepDetector      |       | SkeletonRenderer |
|             |    | FormScorer       |       | SessionLogger    |
|             |    | ExerciseAnalyzer |       +------------------+
+-------------+    +------------------+
```

All AI runs locally via MediaPipe's Tasks API with a `.task` model file (~9MB).

## Quick Start

```bash
cd form-puck
pip install -r requirements.txt
python3 main.py
```

Open `http://localhost:5000` in a browser. The webcam feed with skeleton overlay and metrics panel will appear.

## Exercises

Defined in JSON config files under `config/exercises/`. Each exercise specifies:

- **Landmarks** - which MediaPipe keypoints to track
- **Angles** - joint angle definitions (primary + secondary sides)
- **Rep detection** - state machine thresholds
- **Scoring** - faults with deduction weights and hysteresis margins

### Supported Exercises

| Exercise | Rep Detection | Faults |
|---|---|---|
| Squat | Knee angle 4-state machine | Back rounding, insufficient depth, knee cave, asymmetric descent, bounce |
| Bicep Curl | Elbow angle 4-state machine | Elbow swing, insufficient contraction |
| Deadlift | Knee angle (same as squat) | Back rounding, bar path deviation, hip shoot |

### Adding a New Exercise

1. Create a JSON file in `config/exercises/`
2. Define landmarks, angles, rep detection config, and scoring faults
3. It will appear in the dashboard's exercise dropdown automatically

## Key Features

- **3D world landmarks** - Uses MediaPipe's camera-independent world coordinates for angle calculation, with 2D fallback
- **Hysteresis fault detection** - Separate trigger/clear thresholds prevent rapid-fire alerts
- **EMA smoothing** - Reduces keypoint jitter (alpha=0.35)
- **Voice coaching** - Spoken fault cues via pyttsx3 with 5-second cooldown (falls back to beep tones if unavailable)
- **Mirror mode** - Default on, so the feed feels like a mirror
- **Session logging** - JSON after-action reports saved to `session_logs/`

## Configuration

`config/app_config.json` controls camera settings and MediaPipe parameters:

| Setting | Default | Description |
|---|---|---|
| camera_index | 0 | Webcam device index |
| frame_width | 640 | Capture resolution |
| frame_height | 480 | Capture resolution |
| target_fps | 30 | Target frame rate |
| default_exercise | squat | Exercise loaded on startup |
| model_dir | models | Directory for .task model files |

## Tech Stack

- **Python 3** - Main language
- **MediaPipe Tasks API** - On-device pose estimation
- **OpenCV** - Camera capture and frame processing
- **Flask** - Web dashboard with MJPEG streaming
- **pygame** - Beep tone audio feedback
- **pyttsx3** - Voice coaching (optional, graceful fallback)
- **NumPy** - Math operations

## Project Structure

```
form-puck/
  main.py                 # Entry point
  requirements.txt
  config/
    app_config.json
    exercises/
      squat.json
      bicep_curl.json
      deadlift.json
  camera/
    base_camera.py        # Abstract camera interface
    webcam_camera.py      # OpenCV implementation
  processing/
    pose_extractor.py     # MediaPipe pose detection
    angle_calculator.py   # Angle math + EMA smoothing
    rep_detector.py       # State machine rep counting
    form_scorer.py        # Fault detection with hysteresis
    exercise_analyzer.py  # Orchestrates processing pipeline
  feedback/
    dashboard.py          # Flask web UI + MJPEG stream
    skeleton_renderer.py  # Draws skeleton + annotations on frame
    audio_feedback.py     # Beep tones + voice coaching
  session/
    session_logger.py     # Rep logging + after-action reports
  models/
    pose_landmarker_full.task  # MediaPipe model (9MB)
```

## Roadmap

- Raspberry Pi 5 port with picamera2
- More exercises (overhead press, lunges, pull-ups)
- Multi-user profiles
- Bluetooth sync to phone app
