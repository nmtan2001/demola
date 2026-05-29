import json
import os
import threading
import time
import cv2
import numpy as np
from flask import Flask, Response, jsonify, request

from camera.webcam_camera import WebcamCamera
from processing.pose_extractor import PoseExtractor
from processing.exercise_analyzer import ExerciseAnalyzer
from feedback.skeleton_renderer import SkeletonRenderer
from feedback.audio_feedback import AudioFeedback
from session.session_logger import SessionLogger

DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Form Puck - Edge AI Form Coach</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #1a1a2e; color: #e0e0e0; font-family: -apple-system, Arial, sans-serif; display: flex; height: 100vh; overflow: hidden; }
.left { flex: 7; display: flex; align-items: center; justify-content: center; padding: 10px; }
.left img { max-width: 100%; max-height: 100%; border-radius: 8px; border: 2px solid #16213e; }
.right { flex: 3; min-width: 280px; max-width: 350px; padding: 16px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.led { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto; transition: background-color 0.15s; }
.led-green { background: #00c853; box-shadow: 0 0 30px #00c85388; }
.led-red { background: #ff1744; box-shadow: 0 0 30px #ff174488; animation: pulse 0.5s infinite alternate; }
.led-yellow { background: #ffd600; box-shadow: 0 0 30px #ffd60088; }
@keyframes pulse { from { opacity: 1; } to { opacity: 0.5; } }
.rep-counter { font-size: 48px; font-weight: bold; text-align: center; color: #00d4ff; }
.score-bar-bg { background: #2a2a4a; border-radius: 6px; height: 30px; position: relative; overflow: hidden; }
.score-bar-fill { height: 100%; border-radius: 6px; transition: width 0.15s, background-color 0.15s; }
.score-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 16px; font-weight: bold; }
.state { font-size: 20px; font-weight: bold; text-align: center; color: #888; padding: 4px 0; }
.section-title { font-size: 14px; font-weight: bold; color: #aaa; margin-top: 8px; }
.metrics { display: flex; flex-direction: column; gap: 4px; }
.metric-row { display: flex; justify-content: space-between; padding: 3px 0; }
.metric-name { color: #999; font-size: 15px; }
.metric-val { color: #00d4ff; font-weight: bold; font-size: 15px; }
.faults { color: #ff5252; font-size: 15px; font-weight: bold; min-height: 30px; line-height: 1.4; padding: 4px 0; }
select { background: #2a2a4a; color: #e0e0e0; border: 1px solid #3a3a5a; padding: 8px 12px; border-radius: 4px; font-size: 16px; width: 100%; }
.btn-row { display: flex; gap: 8px; }
button { flex: 1; padding: 12px; border: none; border-radius: 6px; font-weight: bold; font-size: 16px; cursor: pointer; color: white; }
.btn-start { background: #00c853; }
.btn-start:hover { background: #00e676; }
.btn-start.active { background: #ff9800; }
.btn-start.active:hover { background: #ffb74d; }
.btn-reset { background: #ff5252; }
.btn-reset:hover { background: #ff6e6e; }
.summary { color: #888; font-size: 11px; margin-top: auto; }
.report-overlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); z-index: 100; align-items: center; justify-content: center; }
.report-box { background: #1a1a2e; border: 2px solid #00d4ff; border-radius: 12px; padding: 24px; max-width: 400px; width: 90%; }
.report-box h2 { color: #00d4ff; margin-bottom: 12px; }
.report-box p { margin: 4px 0; font-size: 14px; }
.report-box button { margin-top: 16px; width: 100%; }
</style>
</head>
<body>
<div class="left">
  <img id="feed" src="/video" alt="Camera feed">
</div>
<div class="right">
  <div id="led" class="led led-green"></div>
  <div id="reps" class="rep-counter">Reps: 0</div>
  <div>
    <div class="section-title" style="text-align:center">Form Score</div>
    <div class="score-bar-bg">
      <div id="score-fill" class="score-bar-fill" style="width:100%;background:#00c853"></div>
      <div id="score-text" class="score-text">100%</div>
    </div>
  </div>
  <div id="state" class="state">STANDING</div>
  <div class="section-title">Live Metrics</div>
  <div id="metrics-panel" class="metrics">
    <div class="metric-row"><span class="metric-name" id="ml-0">Knee Angle:</span><span id="mv-0" class="metric-val">--</span></div>
    <div class="metric-row"><span class="metric-name" id="ml-1">Hip Angle:</span><span id="mv-1" class="metric-val">--</span></div>
    <div class="metric-row"><span class="metric-name" id="ml-2">Back Angle:</span><span id="mv-2" class="metric-val">--</span></div>
    <div class="metric-row"><span class="metric-name" id="ml-3">Knee Tracking:</span><span id="mv-3" class="metric-val">--</span></div>
    <div class="metric-row"><span class="metric-name" id="ml-4">Symmetry:</span><span id="mv-4" class="metric-val">--</span></div>
  </div>
  <div id="faults" class="faults"></div>
  <div class="section-title">Exercise</div>
  <select id="exercise"></select>
  <div class="btn-row">
    <button id="btn-start" class="btn-start" onclick="toggleSession()">Start Session</button>
    <button class="btn-reset" onclick="resetSession()">Reset</button>
  </div>
  <div id="summary" class="summary"></div>
</div>
<div id="report-overlay" class="report-overlay">
  <div class="report-box">
    <h2>Session Report</h2>
    <div id="report-content"></div>
    <button class="btn-start" onclick="closeReport()">Close</button>
  </div>
</div>
<script>
const exerciseEl = document.getElementById('exercise');
let currentMetrics = [
  {key:'knee_angle', label:'Knee Angle'},
  {key:'hip_angle', label:'Hip Angle'},
  {key:'back_angle', label:'Back Angle'},
  {key:'knee_cave', label:'Knee Tracking'},
  {key:'asymmetry', label:'Symmetry'}
];

const exerciseMetrics = {
  squat: [
    {key:'knee_angle', label:'Knee Angle'},
    {key:'hip_angle', label:'Hip Angle'},
    {key:'back_angle', label:'Back Angle'},
    {key:'knee_cave', label:'Knee Tracking'},
    {key:'asymmetry', label:'Symmetry'}
  ],
  bicep_curl: [
    {key:'elbow_angle', label:'Elbow Angle'},
    {key:'shoulder_angle', label:'Shoulder Angle'},
    null, null, null
  ],
  deadlift: [
    {key:'knee_angle', label:'Knee Angle'},
    {key:'hip_angle', label:'Hip Angle'},
    {key:'back_angle', label:'Back Angle'},
    null, null
  ],
  pushup: [
    {key:'elbow_angle', label:'Elbow Angle'},
    {key:'hip_angle', label:'Hip Angle'},
    {key:'back_angle', label:'Back Angle'},
    null, null
  ],
  overhead_press: [
    {key:'elbow_angle', label:'Elbow Angle'},
    {key:'shoulder_angle', label:'Shoulder Angle'},
    {key:'back_angle', label:'Back Angle'},
    null, null
  ],
  lunge: [
    {key:'knee_angle', label:'Knee Angle'},
    {key:'hip_angle', label:'Hip Angle'},
    {key:'back_angle', label:'Back Angle'},
    {key:'asymmetry', label:'Symmetry'},
    null
  ]
};

function setMetrics(exId){
  const m = exerciseMetrics[exId] || exerciseMetrics.squat;
  currentMetrics = m.filter(x=>x);
  for(let i=0;i<5;i++){
    const lbl = document.getElementById('ml-'+i);
    const val = document.getElementById('mv-'+i);
    if(m[i]){
      lbl.textContent = m[i].label+':';
      lbl.parentElement.style.display='flex';
    } else {
      lbl.parentElement.style.display='none';
    }
  }
}

fetch('/api/exercises').then(r=>r.json()).then(data=>{
  data.exercises.forEach(e=>{
    const opt=document.createElement('option');
    opt.value=e.id; opt.textContent=e.name;
    exerciseEl.appendChild(opt);
  });
  if(data.default_exercise){
    exerciseEl.value=data.default_exercise;
    setMetrics(data.default_exercise);
  }
});
exerciseEl.addEventListener('change',()=>{
  setMetrics(exerciseEl.value);
  fetch('/api/exercise',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:exerciseEl.value})});
});

function toggleSession(){
  fetch('/api/session/toggle',{method:'POST'}).then(r=>r.json()).then(d=>{
    const btn=document.getElementById('btn-start');
    if(d.active){btn.textContent='End Session';btn.classList.add('active');}
    else{btn.textContent='Start Session';btn.classList.remove('active');if(d.report)showReport(d.report);}
  });
}
function resetSession(){
  fetch('/api/session/reset',{method:'POST'});
}
function showReport(r){
  document.getElementById('report-content').innerHTML=
    '<p>Exercise: '+r.exercise+'</p>'+
    '<p>Total Reps: '+r.total_reps+'</p>'+
    '<p>Average Score: '+r.average_score+'%</p>'+
    '<p>Best Rep: '+(r.best_rep||'N/A')+'</p>'+
    '<p>Worst Rep: '+(r.worst_rep||'N/A')+'</p>'+
    (r.most_common_fault?'<p>Most Common Fault: '+r.most_common_fault+'</p>':'');
  document.getElementById('report-overlay').style.display='flex';
}
function closeReport(){document.getElementById('report-overlay').style.display='none';}

setInterval(()=>{
  fetch('/api/state').then(r=>r.json()).then(d=>{
    document.getElementById('reps').textContent='Reps: '+d.rep_count;
    document.getElementById('state').textContent=d.state;
    const score=d.score;
    document.getElementById('score-fill').style.width=score+'%';
    document.getElementById('score-fill').style.background=score>70?'#00c853':score>40?'#ffd600':'#ff1744';
    document.getElementById('score-text').textContent=score+'%';
    const led=document.getElementById('led');
    led.className='led '+(d.is_good?'led-green':'led-red');
    for(let i=0;i<currentMetrics.length;i++){
      const v=d.angles[currentMetrics[i].key];
      document.getElementById('mv-'+i).textContent=v!=null?v.toFixed(1):'--';
    }
    document.getElementById('faults').textContent=d.faults.map(f=>f.description).join(' | ');
    if(d.summary)document.getElementById('summary').textContent='Last: '+d.summary;
  });
},150);
</script>
</body>
</html>"""


class FormPuckServer:
    def __init__(self, config_path="config/app_config.json"):
        with open(config_path, "r") as f:
            self._config = json.load(f)

        self._camera = WebcamCamera(
            camera_index=self._config["camera_index"],
            width=self._config["frame_width"],
            height=self._config["frame_height"],
            fps=self._config["target_fps"],
        )
        self._pose_extractor = PoseExtractor(
            model_complexity=self._config["mediapipe_model_complexity"],
            min_detection_confidence=self._config["min_detection_confidence"],
            min_tracking_confidence=self._config["min_tracking_confidence"],
            model_dir=self._config.get("model_dir", "models"),
        )
        self._available_exercises = ExerciseAnalyzer.list_available_exercises(
            self._config.get("exercises_dir", "config/exercises")
        )
        default_ex = self._config.get("default_exercise", "squat")
        self._analyzer = ExerciseAnalyzer(default_ex)
        self._renderer = SkeletonRenderer()
        self._audio = AudioFeedback()
        self._logger = None
        self._session_active = False
        self._prev_form_good = True
        self._last_summary = None
        self._debug_frame_count = 0

        # Latest state for API polling
        self._state = {
            "rep_count": 0,
            "state": "STANDING",
            "score": 100,
            "is_good": True,
            "angles": {},
            "faults": [],
        }
        self._lock = threading.Lock()
        self._running = False
        self._latest_jpeg = None
        self._camera_connected = True
        self._hip_velocity_history = []
        self._prev_hip_y = None

    def _producer_loop(self):
        """Dedicated background thread to capture and process frames thread-safely."""
        fps = self._config.get("target_fps", 30)
        delay = 1.0 / fps if fps > 0 else 0.033
        consecutive_failures = 0

        while self._running:
            success, frame = self._camera.read()
            if not success or frame is None:
                consecutive_failures += 1
                if consecutive_failures > 50:
                    with self._lock:
                        self._camera_connected = False
                        self._state["state"] = "CAMERA_DISCONNECTED"
                    time.sleep(1.0)
                else:
                    time.sleep(delay)
                continue

            consecutive_failures = 0
            with self._lock:
                self._camera_connected = True

            pose_result = self._pose_extractor.process(frame)
            landmarks = pose_result["landmarks"] if pose_result else None
            world_landmarks = pose_result["world_landmarks"] if pose_result else None

            # Calculate hip vertical velocity
            current_velocity = 0.0
            if world_landmarks is not None and len(world_landmarks) > 24:
                left_hip_y = world_landmarks[23][1]
                right_hip_y = world_landmarks[24][1]
                hip_y = (left_hip_y + right_hip_y) / 2.0

                if self._prev_hip_y is not None:
                    current_velocity = (hip_y - self._prev_hip_y) / delay
                self._prev_hip_y = hip_y
            else:
                self._prev_hip_y = None

            if world_landmarks is not None:
                self._hip_velocity_history.append(current_velocity)
                if len(self._hip_velocity_history) > 5:
                    self._hip_velocity_history.pop(0)
            else:
                self._hip_velocity_history = []

            with self._lock:
                analyzer = self._analyzer

            result = analyzer.analyze(landmarks, world_landmarks, self._hip_velocity_history)
            rep_info = result["rep_info"]
            form_eval = result["form_eval"]

            landmark_map = analyzer._landmark_map if landmarks is not None else {}
            self._renderer.set_fault_joints(form_eval.get("faults", []), landmark_map)

            is_good = form_eval.get("is_good", True)
            if pose_result:
                self._pose_extractor.draw_landmarks(frame, pose_result, is_good)
                self._renderer.draw_fault_markers(frame, landmarks, form_eval.get("faults", []), landmark_map)
                self._renderer.draw_angle_annotations(
                    frame, landmarks, form_eval.get("angles", {}), landmark_map
                )

            # Audio feedback
            if form_eval.get("is_good", True):
                self._prev_form_good = True
            else:
                if self._prev_form_good:
                    self._audio.play_fault()
                self._prev_form_good = False
                faults = form_eval.get("faults", [])
                if faults:
                    self._audio.speak_fault(faults[0]["name"])

            # Rep completion
            if rep_info["rep_completed"]:
                score = form_eval.get("score", 0)
                fault_descs = [f["description"] for f in form_eval.get("faults", [])]
                print(f"Rep {rep_info['rep_count']} | Score: {score} | Faults: {', '.join(fault_descs) if fault_descs else 'None'}", flush=True)
                self._audio.play_rep_complete()
                with self._lock:
                    if self._logger:
                        self._logger.log_rep(
                            rep_info["rep_count"],
                            form_eval.get("score", 0),
                            form_eval.get("faults", []),
                            form_eval.get("angles", {}),
                        )

            # Mirror the frame for display (natural mirror view)
            display_frame = cv2.flip(frame, 1)

            # Encode as JPEG
            _, jpeg = cv2.imencode(".jpg", display_frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
            jpeg_bytes = jpeg.tobytes() if jpeg is not None else None

            # Update shared state
            with self._lock:
                self._latest_jpeg = jpeg_bytes
                self._state = {
                    "rep_count": rep_info["rep_count"],
                    "state": rep_info["state"].value,
                    "score": form_eval.get("score", 100),
                    "is_good": form_eval.get("is_good", True),
                    "angles": {
                        k: round(v, 1) if isinstance(v, (int, float)) else None
                        for k, v in form_eval.get("angles", {}).items()
                    },
                    "faults": [
                        {"name": f["name"], "description": f["description"]}
                        for f in form_eval.get("faults", [])
                    ],
                    "summary": self._last_summary,
                }


    def _generate_frames(self):
        """Generator for MJPEG stream."""
        last_frame = None
        while True:
            with self._lock:
                jpeg = self._latest_jpeg
                connected = self._camera_connected

            if not connected:
                time.sleep(0.5)
                continue

            if jpeg and jpeg != last_frame:
                last_frame = jpeg
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + jpeg + b"\r\n"
                )
            else:
                time.sleep(0.01)

    def _get_state(self):
        with self._lock:
            return dict(self._state)

    def create_app(self):
        app = Flask(__name__, static_folder=None)

        @app.route("/")
        def index():
            return DASHBOARD_HTML

        @app.route("/video")
        def video():
            return Response(
                self._generate_frames(),
                mimetype="multipart/x-mixed-replace; boundary=frame",
            )

        @app.route("/api/state")
        def api_state():
            return jsonify(self._get_state())

        @app.route("/api/exercises")
        def api_exercises():
            return jsonify({
                "exercises": self._available_exercises,
                "default_exercise": self._config.get("default_exercise", "squat"),
            })

        @app.route("/api/exercise", methods=["POST"])
        def api_set_exercise():
            data = request.get_json()
            ex_id = data.get("id", "squat")
            with self._lock:
                self._analyzer = ExerciseAnalyzer(ex_id)
                self._analyzer.reset()
                self._hip_velocity_history = []
                self._prev_hip_y = None
            return jsonify({"ok": True})

        @app.route("/api/session/toggle", methods=["POST"])
        def api_toggle_session():
            with self._lock:
                active = self._session_active
                analyzer_name = self._analyzer.name

            if not active:
                logger = SessionLogger(analyzer_name)
                with self._lock:
                    self._session_active = True
                    self._logger = logger
                return jsonify({"active": True})
            else:
                report = {}
                with self._lock:
                    logger = self._logger
                    self._logger = None
                    self._session_active = False

                if logger:
                    report = logger.generate_report()
                    with self._lock:
                        self._last_summary = logger.get_summary_text()

                return jsonify({"active": False, "report": report})

        @app.route("/api/session/reset", methods=["POST"])
        def api_reset_session():
            with self._lock:
                self._analyzer.reset()
            with self._lock:
                self._state = {
                    "rep_count": 0,
                    "state": "STANDING",
                    "score": 100,
                    "is_good": True,
                    "angles": {},
                    "faults": [],
                    "summary": self._last_summary,
                }
            return jsonify({"ok": True})

        return app

    def run(self, host="0.0.0.0", port=5000, debug=False):
        self._running = True
        self._producer_thread = threading.Thread(target=self._producer_loop, daemon=True)
        self._producer_thread.start()

        flask_app = self.create_app()
        print(f"Form Puck running at http://localhost:{port}")
        print("Open this URL in your browser.")
        print("Press Ctrl+C to stop.")
        flask_app.run(host=host, port=port, debug=debug, use_reloader=False, threaded=True)

    def cleanup(self):
        self._running = False
        if hasattr(self, "_producer_thread"):
            self._producer_thread.join(timeout=2.0)
        self._pose_extractor.release()
        self._audio.release()
        self._camera.release()


def run_dashboard():
    server = FormPuckServer()
    try:
        server.run()
    except KeyboardInterrupt:
        pass
    finally:
        server.cleanup()
