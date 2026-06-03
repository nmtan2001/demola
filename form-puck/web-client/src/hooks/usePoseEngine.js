import { useEffect, useRef } from 'react';
const Pose = window.Pose;
const Camera = window.Camera;

export const usePoseEngine = (videoRef, onResults) => {
  const poseRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current) return;

    poseRef.current = new Pose({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
      }
    });

    poseRef.current.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    poseRef.current.onResults(onResults);

    cameraRef.current = new Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          await poseRef.current.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480
    });

    cameraRef.current.start().catch((err) => {
      console.error("Camera error: ", err);
    });

    return () => {
      if (cameraRef.current) {
        cameraRef.current.stop();
      }
      if (poseRef.current) {
        poseRef.current.close();
      }
    };
  }, [videoRef, onResults]);
};
