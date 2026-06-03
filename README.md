# Form Puck

Edge AI gym form checker. Runs entirely on-device inside your browser using your webcam - no cloud, no backend servers, no data leaving the machine.

Built as a Demola university project prototype. It features a beautiful, dynamic 3D "Form Puck" interface that overlays over your camera to provide real-time metrics and feedback.

**Live Demo:** [https://nmtan2001.github.io/demola/](https://nmtan2001.github.io/demola/)

## What It Does

- Detects body pose in real-time using MediaPipe inside the browser
- Tracks reps for 6 different exercises (Squat, Bicep Curl, Deadlift, Lunge, Overhead Press, Push-up)
- Scores form and flags common faults (e.g., back rounding, knee cave, asymmetric descent)
- Provides immediate visual feedback via a 3D responsive "Form Puck" widget
- Smooth, modern glassmorphism UI overlaid directly onto your webcam feed

## Architecture

The project has evolved from a Python backend into a fully client-side web application. 

```
Webcam API --> MediaPipe JS (Pose Detection) --> React Hooks (State Machine) --> 3D Puck UI / Metrics Panel
```

All AI and image processing run locally using the browser's MediaPipe Tasks API.

## Quick Start (Local Development)

```bash
cd form-puck/web-client
npm install
npm run dev
```

Open the provided `localhost` link in your browser. The webcam feed will initialize, the skeleton overlay will appear, and you can begin exercising!

## Supported Exercises

You can seamlessly cycle through exercises by clicking the 3D Form Puck widget in the bottom corner of the screen.

| Exercise | Tracking Engine | Faults Detected |
|---|---|---|
| **Squat** | Knee angle 4-state machine | Back rounding, insufficient depth, knee cave, asymmetric descent, bounce |
| **Bicep Curl** | Elbow angle 4-state machine | Elbow swing, insufficient contraction, incomplete lockout |
| **Deadlift** | Knee angle 4-state machine | Back rounding, bar path deviation, hip shoot |
| **Lunge** | Knee angle 4-state machine | Knee over toe, asymmetric descent, back rounding |
| **Overhead Press** | Shoulder angle 4-state machine | Incomplete lockout, arching back, asymmetric extension |
| **Push-up** | Elbow angle 4-state machine | Sagging hips, piking hips, half rep |

## Key Features

- **3D World Landmarks** - Uses MediaPipe's camera-independent world coordinates for angle calculation to ensure depth accuracy.
- **Hysteresis Fault Detection** - Separate trigger/clear thresholds prevent rapid-fire alerts and false positives.
- **EMA Smoothing** - Reduces keypoint jitter (alpha=0.35) for stable angle tracking.
- **Physical "Puck" UI** - The UI design mimics a physical hardware interface. The LEDs pulse dynamically based on active repetitions, and flash red instantly upon form faults.
- **CI/CD** - Automatically deploys to GitHub Pages via GitHub Actions whenever code is pushed to `main`.

## Tech Stack

- **React 19** - Core UI framework
- **Vite** - Lightning-fast build tool
- **MediaPipe JavaScript** - `@mediapipe/pose`, `@mediapipe/camera_utils`, `@mediapipe/drawing_utils` for running the pose extraction model client-side.
- **Vanilla CSS** - Rich aesthetics, glassmorphism, 3D CSS transformations, micro-animations, and dynamic variables.

## Project Structure

```
form-puck/
  web-client/
    index.html               # Main entry point
    package.json             
    vite.config.js           # Build settings (configured for gh-pages base path)
    src/
      App.jsx                # Main application wrapper
      App.css                # Global and layout styles
      components/
        CameraViewport.jsx   # MediaPipe initialization and skeleton drawing
        FormPuckWidget.jsx   # 3D interactive puck interface
        MetricsPanel.jsx     # On-screen metrics, scores, and active faults
      hooks/
        useExerciseAnalysis.js # Orchestrates pose extraction and state management
        usePoseEngine.js     # MediaPipe setup hook
      logic/
        ExerciseAnalyzer.js  # Javascript port of the Python state machine
        mathUtils.js         # Angle math and EMA smoothing
      config/
        exercises.js         # JSON configurations for all 6 exercises
```

## Continuous Deployment

This repository is configured to auto-deploy. Any changes pushed to the `main` branch inside `form-puck/web-client` will trigger a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds the Vite project and pushes the compiled assets to the `gh-pages` branch. 

## Roadmap

- Mobile-first responsiveness and PWA installation support
- Bluetooth sync to connect the UI to an *actual* physical puck device
- User profiles and historical performance tracking
- Audio feedback engine integration (Edge TTS)
