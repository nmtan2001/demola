import React, { useRef, useState, useCallback } from 'react';
import { usePoseEngine } from '../hooks/usePoseEngine';
const drawConnectors = window.drawConnectors;
const drawLandmarks = window.drawLandmarks;
const POSE_CONNECTIONS = window.POSE_CONNECTIONS;

const CameraViewport = ({ onPose }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [status, setStatus] = useState('Initializing...');

  const onResults = useCallback((results) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    
    if (video && canvas.width !== video.videoWidth) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

    if (results.poseLandmarks) {
      setStatus('Tracking');
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, {
        color: '#00FF00',
        lineWidth: 4
      });
      drawLandmarks(ctx, results.poseLandmarks, {
        color: '#FF0000',
        lineWidth: 2,
        radius: 3
      });
      
      if (onPose) {
        onPose(results);
      }
    } else {
      setStatus('No pose detected');
    }
    
    ctx.restore();
  }, [onPose]);

  usePoseEngine(videoRef, onResults);

  return (
    <div className="camera-viewport glass-panel">
      <div className="camera-header">
        <h2>Live Camera</h2>
        <div className={`status-indicator ${status === 'Tracking' ? 'live' : ''}`}></div>
        <span className="status-text">{status}</span>
      </div>
      <div className="video-container" style={{ position: 'relative' }}>
        <video 
          ref={videoRef}
          className="camera-video" 
          autoPlay 
          playsInline 
          muted
          style={{ display: 'none' }}
        ></video>
        <canvas 
          ref={canvasRef}
          className="camera-canvas"
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        ></canvas>
        {status === 'Initializing...' && (
          <div className="placeholder-text">Camera Feed Offline</div>
        )}
      </div>
    </div>
  );
};

export default CameraViewport;
