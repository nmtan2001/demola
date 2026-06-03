import React, { useRef, useEffect } from 'react';
import './FormPuckWidget.css';

const FAULT_TO_SEGMENT = {
  back_rounding: 'torso',
  arching_back: 'torso',
  sagging_hips: 'torso',
  piking_hips: 'torso',
  hip_shoot: 'torso',
  insufficient_depth: 'legs',
  half_rep: 'legs',
  knee_cave: 'legs',
  knee_over_toe: 'legs',
  bounce_at_bottom: 'legs',
  asymmetric_descent: 'legs',
  elbow_swing: 'arms',
  elbow_flare: 'arms',
  insufficient_contraction: 'arms',
  incomplete_lockout: 'arms',
  bar_path_deviation: 'arms',
};

// Skeleton landmark positions as fractions of the canvas size (center-oriented)
const SKELETON = {
  // indices: [x, y] in 0..1 normalized canvas coordinates
  0: [0.5, 0.08],   // nose
  11: [0.42, 0.18], // left shoulder
  12: [0.58, 0.18], // right shoulder
  13: [0.28, 0.28], // left elbow
  14: [0.72, 0.28], // right elbow
  15: [0.2, 0.38],  // left wrist
  16: [0.8, 0.38],  // right wrist
  23: [0.44, 0.48], // left hip
  24: [0.56, 0.48], // right hip
  25: [0.46, 0.68], // left knee
  26: [0.54, 0.68], // right knee
  27: [0.46, 0.88], // left ankle
  28: [0.54, 0.88], // right ankle
  31: [0.52, 0.92], // left foot
  32: [0.58, 0.92], // right foot
};

// Body connections: [idx1, idx2, segmentName]
const CONNECTIONS = [
  [0, 11, 'head'],
  [0, 12, 'head'],
  [11, 12, 'torso'],
  [11, 13, 'arms'],
  [13, 15, 'arms'],
  [12, 14, 'arms'],
  [14, 16, 'arms'],
  [11, 23, 'torso'],
  [12, 24, 'torso'],
  [23, 24, 'torso'],
  [23, 25, 'legs'],
  [25, 27, 'legs'],
  [27, 31, 'legs'],
  [24, 26, 'legs'],
  [26, 28, 'legs'],
  [28, 32, 'legs'],
];

function getSegmentColor(segmentName, activeSegments) {
  return activeSegments.has(segmentName) ? '#ff3344' : '#36f47a';
}

function drawSkeleton(ctx, w, h, activeSegments) {
  const pts = {};
  for (const [idx, [nx, ny]] of Object.entries(SKELETON)) {
    pts[idx] = [nx * w, ny * h];
  }

  ctx.lineCap = 'round';

  // Draw connection outlines for readability
  for (const [i, j, seg] of CONNECTIONS) {
    const p1 = pts[i];
    const p2 = pts[j];
    if (!p1 || !p2) continue;

    // Outline
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Colored line
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.strokeStyle = getSegmentColor(seg, activeSegments);
    ctx.lineWidth = 3.5;
    ctx.stroke();
  }

  // Draw joint dots
  for (const [idx, [nx, ny]] of Object.entries(SKELETON)) {
    const x = nx * w;
    const y = ny * h;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fill();

    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
}

const FormPuckWidget = ({ onClick, ledStates = ['off', 'off', 'off', 'off', 'off'], faults = [], angles = {} }) => {
    const safeStates = Array.from({ length: 5 }, (_, i) => ledStates[i] || 'off');
    const canvasRef = useRef(null);

    // Compute which segments have faults
    const activeSegments = new Set();
    for (const fault of faults) {
      const seg = FAULT_TO_SEGMENT[fault.name];
      if (seg) activeSegments.add(seg);
    }

    // Redraw skeleton when faults change
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, rect.width, rect.height);
      drawSkeleton(ctx, rect.width, rect.height, activeSegments);
    }, [faults, activeSegments]);

    return (
        <div className="form-puck-stage">
            <div className="mounting-clamp">
                <div className="clamp-joint">
                    <div className="clamp-pin"></div>
                </div>
                <div className="clamp-handle">
                    <div className="clamp-texture"></div>
                </div>
            </div>

            <div className="puck-device" onClick={onClick}>
                <div className="outer-bezel"></div>

                <div className="inner-core">

                    <svg className="engravings-layer" viewBox="0 0 400 400">
                        <g transform="translate(200, 200) rotate(0) translate(0, -123) scale(1.4)">
                            <circle cx="0" cy="-4" r="4.5" className="engraved-icon"/>
                            <path d="M -9 6 C -5 -1, 5 -1, 9 6" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(72) translate(0, -123) scale(1.4)">
                            <path d="M -2 6 L 6 -2 L 0 -8" className="engraved-icon"/>
                            <path d="M 0 3 Q 4 -1 2 -5" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(144) translate(0, -123) scale(1.4)">
                            <path d="M -2 6 L 5 -1 L 0 -8 L 4 -8" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(-144) translate(0, -123) scale(1.4)">
                            <path d="M 2 6 L -5 -1 L 0 -8 L -4 -8" className="engraved-icon"/>
                        </g>

                        <g transform="translate(200, 200) rotate(-72) translate(0, -123) scale(1.4)">
                            <path d="M 2 6 L -6 -2 L 0 -8" className="engraved-icon"/>
                            <path d="M 0 3 Q -4 -1 -2 -5" className="engraved-icon"/>
                        </g>
                    </svg>

                    <svg className="led-ring-svg" viewBox="0 0 400 400">
                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(-123 200 200)" data-state={safeStates[0]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(-51 200 200)" data-state={safeStates[1]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(21 200 200)" data-state={safeStates[2]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(93 200 200)" data-state={safeStates[3]} />

                        <circle cx="200" cy="200" r="182" className="led-segment"
                                strokeDasharray="210 934" transform="rotate(165 200 200)" data-state={safeStates[4]} />
                    </svg>

                    {/* Skeleton canvas overlaid in the center of the puck */}
                    <canvas ref={canvasRef} className="skeleton-canvas" />

                    <div className="camera-lens-assembly">
                        <div className="lens-recess">
                            <div className="lens-element-outer">
                                <div className="lens-element-inner">
                                    <div className="lens-glare-secondary"></div>
                                    <div className="lens-glare-primary"></div>
                                    <div className="aperture-core"></div>
                                    <div className="aperture-specular"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default FormPuckWidget;
