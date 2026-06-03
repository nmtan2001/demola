export class EMASmoother {
  constructor(alpha = 0.35) {
    this.alpha = alpha;
    this.values = {};
  }

  smooth(key, value) {
    if (value == null) {
      return null;
    }
    if (!(key in this.values) || this.values[key] == null) {
      this.values[key] = value;
    } else {
      this.values[key] = this.alpha * value + (1 - this.alpha) * this.values[key];
    }
    return this.values[key];
  }

  reset() {
    this.values = {};
  }
}

export function dotProduct(v1, v2) {
  let sum = 0;
  for (let i = 0; i < v1.length; i++) {
    sum += v1[i] * v2[i];
  }
  return sum;
}

export function magnitude(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

export function clip(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function degrees(radians) {
  return radians * (180 / Math.PI);
}

export const AngleCalculator = {
  calculateAngle: (a, b, c) => {
    if (!a || !b || !c) return null;
    
    // a, b, c are arrays [x, y] or [x, y, z]
    const ba = a.map((val, i) => val - b[i]);
    const bc = c.map((val, i) => val - b[i]);

    let cosine = dotProduct(ba, bc) / (magnitude(ba) * magnitude(bc) + 1e-8);
    cosine = clip(cosine, -1.0, 1.0);
    return degrees(Math.acos(cosine));
  },

  calculateVerticalAngle: (upper, lower) => {
    if (!upper || !lower) return null;
    
    // upper: [x, y, z], lower: [x, y, z]
    const vec = [
      upper[0] - lower[0],
      upper[1] - lower[1],
      upper[2] - lower[2]
    ];
    
    const vecNorm = magnitude(vec);
    if (vecNorm < 1e-8) {
      return 0.0;
    }
    
    const vecNormalized = vec.map(v => v / vecNorm);
    const vertical = [0.0, -1.0, 0.0];
    let cosine = dotProduct(vertical, vecNormalized);
    cosine = clip(cosine, -1.0, 1.0);
    return degrees(Math.acos(cosine));
  },

  getLandmarkXy: (landmarks, idx) => {
    if (!landmarks || !landmarks[idx]) return null;
    return [landmarks[idx].x, landmarks[idx].y]; // Assuming MediaPipe JS format
  },

  getLandmarkXyz: (worldLandmarks, idx) => {
    if (!worldLandmarks || !worldLandmarks[idx]) return null;
    return [worldLandmarks[idx].x, worldLandmarks[idx].y, worldLandmarks[idx].z];
  },

  calculateKneeCave: (knee, ankle, footIndex) => {
    if (!knee || !ankle || !footIndex) return null;
    
    const footCenterX = (ankle[0] + footIndex[0]) / 2.0;
    let sign = 1.0;
    if (Math.abs(footCenterX) > 1e-6) {
      sign = Math.sign(footCenterX);
    }
    
    const lateralDeviation = Math.max(0.0, sign * (footCenterX - knee[0]));
    const verticalDist = Math.abs(knee[1] - ankle[1]);
    
    if (verticalDist < 1e-6) {
      return 0.0;
    }
    
    return degrees(Math.atan(lateralDeviation / verticalDist));
  }
};
