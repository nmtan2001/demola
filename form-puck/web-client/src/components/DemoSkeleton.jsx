import { useRef, useEffect } from 'react';

// MediaPipe landmark indices used for skeleton drawing
const CONNECTIONS = [
  [11, 12], // shoulders
  [11, 13], [13, 15], // left arm
  [12, 14], [14, 16], // right arm
  [11, 23], [12, 24], // torso
  [23, 24], // hips
  [23, 25], [25, 27], [27, 31], // left leg
  [24, 26], [26, 28], [28, 32], // right leg
  [0, 11], [0, 12], // neck
];

// Side-view keyframes for each exercise phase
// Coordinates are [x, y] normalized 0..1 within the canvas
const EXERCISE_KEYFRAMES = {
  Squat: {
    // Standing upright
    start: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.3, 0.28], 14: [0.7, 0.28],
      15: [0.2, 0.32], 16: [0.8, 0.32],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
    // Bottom of squat
    end: {
      0: [0.38, 0.22], 11: [0.33, 0.35], 12: [0.43, 0.35],
      13: [0.18, 0.42], 14: [0.58, 0.42],
      15: [0.08, 0.46], 16: [0.68, 0.46],
      23: [0.35, 0.55], 24: [0.45, 0.55],
      25: [0.48, 0.72], 26: [0.52, 0.72],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
  },
  'Bicep Curl': {
    start: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.3, 0.38], 14: [0.7, 0.38],
      15: [0.2, 0.55], 16: [0.8, 0.55],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
    // Arms curled up
    end: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.35, 0.38], 14: [0.65, 0.38],
      15: [0.4, 0.28], 16: [0.6, 0.28],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
  },
  Deadlift: {
    start: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.35, 0.28], 14: [0.65, 0.28],
      15: [0.42, 0.55], 16: [0.58, 0.55],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
    // Bent over / at bottom
    end: {
      0: [0.28, 0.35], 11: [0.25, 0.45], 12: [0.35, 0.45],
      13: [0.15, 0.5], 14: [0.45, 0.5],
      15: [0.22, 0.6], 16: [0.38, 0.6],
      23: [0.35, 0.58], 24: [0.45, 0.58],
      25: [0.45, 0.72], 26: [0.5, 0.72],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
  },
  Lunge: {
    start: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.3, 0.28], 14: [0.7, 0.28],
      15: [0.2, 0.32], 16: [0.8, 0.32],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
    // Lunge position
    end: {
      0: [0.45, 0.1], 11: [0.4, 0.22], 12: [0.5, 0.22],
      13: [0.25, 0.3], 14: [0.65, 0.3],
      15: [0.15, 0.34], 16: [0.75, 0.34],
      23: [0.4, 0.48], 24: [0.5, 0.48],
      25: [0.55, 0.65], 26: [0.4, 0.7],
      27: [0.6, 0.88], 28: [0.35, 0.88],
      31: [0.67, 0.88], 32: [0.28, 0.88],
    },
  },
  'Overhead Press': {
    start: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.3, 0.38], 14: [0.7, 0.38],
      15: [0.2, 0.55], 16: [0.8, 0.55],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
    // Arms overhead
    end: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.4, 0.1], 14: [0.6, 0.1],
      15: [0.45, 0.03], 16: [0.55, 0.03],
      23: [0.45, 0.45], 24: [0.55, 0.45],
      25: [0.48, 0.68], 26: [0.52, 0.68],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
  },
  'Push-up': {
    start: {
      0: [0.5, 0.08], 11: [0.45, 0.2], 12: [0.55, 0.2],
      13: [0.35, 0.28], 14: [0.65, 0.28],
      15: [0.2, 0.38], 16: [0.8, 0.38],
      23: [0.45, 0.55], 24: [0.55, 0.55],
      25: [0.48, 0.72], 26: [0.52, 0.72],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
    // Arms bent / chest to floor
    end: {
      0: [0.5, 0.12], 11: [0.45, 0.24], 12: [0.55, 0.24],
      13: [0.38, 0.3], 14: [0.62, 0.3],
      15: [0.25, 0.38], 16: [0.75, 0.38],
      23: [0.45, 0.55], 24: [0.55, 0.55],
      25: [0.48, 0.72], 26: [0.52, 0.72],
      27: [0.48, 0.88], 28: [0.52, 0.88],
      31: [0.55, 0.88], 32: [0.59, 0.88],
    },
  },
};

const JOINT_COLORS = {
  outline: 'rgba(0,0,0,0.6)',
  bone: 'rgba(0, 229, 255, 0.7)',
  boneHighlight: '#00E5FF',
  joint: '#FF007F',
  label: '#ffffff',
};

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(p1, p2, t) {
  return [lerp(p1[0], p2[0], t), lerp(p1[1], p2[1], t)];
}

const DemoSkeleton = ({ exerciseName }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const phaseRef = useRef(0); // 0..1, going back and forth

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const keyframes = EXERCISE_KEYFRAMES[exerciseName] || EXERCISE_KEYFRAMES['Squat'];
    let running = true;

    const animate = () => {
      if (!running) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;

      // Update phase: oscillate 0→1→0
      phaseRef.current += 0.008;
      if (phaseRef.current > 1) phaseRef.current = 0;

      const t = phaseRef.current;
      // Use sine easing for smooth back-and-forth
      const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);

      // Interpolate all landmarks between start and end keyframes
      const interpolated = {};
      for (const idxStr of Object.keys(keyframes.start)) {
        const idx = parseInt(idxStr);
        const startPt = keyframes.start[idx];
        const endPt = keyframes.end[idx];
        if (startPt && endPt) {
          interpolated[idx] = lerpPoint(startPt, endPt, eased);
        } else if (startPt) {
          interpolated[idx] = startPt;
        }
      }

      ctx.clearRect(0, 0, w, h);

      // Draw connections (bones)
      for (const [i, j] of CONNECTIONS) {
        const p1 = interpolated[i];
        const p2 = interpolated[j];
        if (!p1 || !p2) continue;

        const x1 = p1[0] * w, y1 = p1[1] * h;
        const x2 = p2[0] * w, y2 = p2[1] * h;

        // Outline for readability
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = JOINT_COLORS.outline;
        ctx.lineWidth = 5;
        ctx.stroke();

        // Main bone line
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = JOINT_COLORS.bone;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }

      // Draw joints
      for (const idxStr of Object.keys(interpolated)) {
        const pt = interpolated[idxStr];
        const x = pt[0] * w, y = pt[1] * h;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.strokeStyle = JOINT_COLORS.outline;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = JOINT_COLORS.joint;
        ctx.fill();
      }

      animRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      running = false;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [exerciseName]);

  return (
    <div style={{
      background: 'rgba(0,0,0,0.5)',
      borderRadius: '16px',
      border: '1px solid rgba(255,255,255,0.08)',
      overflow: 'hidden',
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        padding: '6px 12px',
        fontSize: '0.7rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'rgba(255,255,255,0.5)',
        background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center',
      }}>
        Demo: {exerciseName}
      </div>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', flex: 1, display: 'block' }}
      />
    </div>
  );
};

export default DemoSkeleton;
