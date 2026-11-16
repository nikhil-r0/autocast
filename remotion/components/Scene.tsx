import React from 'react';
import { OffthreadVideo, staticFile } from 'remotion';
import { CameraRig } from './CameraRig';
import { Cursor } from './Cursor';
import { Scene as SceneType } from '../../src/types';

interface SceneProps {
  scene: SceneType;
  videoSrc: string;
  durationInFrames: number;
}

export const Scene: React.FC<SceneProps> = ({
  scene,
  videoSrc,
  durationInFrames,
}) => {
  const startSec = scene.segments[0]?.src_start || 0;
  const startFrame = Math.round(startSec * 30);

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#0f172a',
      }}
    >
      <CameraRig
        target={scene.target}
        zoom={scene.camera.zoom}
        durationInFrames={durationInFrames}
        punch={scene.cursor.click}
      >
        <OffthreadVideo
          src={staticFile(videoSrc)}
          startFrom={startFrame}
          style={{
            width: 1920,
            height: 1080,
            objectFit: 'contain',
          }}
        />

        <Cursor
          from={scene.cursor.from}
          to={scene.cursor.to}
          click={scene.cursor.click}
          durationInFrames={durationInFrames}
        />
      </CameraRig>
    </div>
  );
};
