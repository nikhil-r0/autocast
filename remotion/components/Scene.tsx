import React from 'react';
import {
  Audio,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import { CameraRig } from './CameraRig';
import { Cursor } from './Cursor';
import { Spotlight } from './Spotlight';
import { KineticTransition } from './KineticTransition';
import { LowerThird } from './LowerThird';
import { Scene as SceneType } from '../../src/types';

interface SceneProps {
  scene: SceneType;
  videoSrc: string;
  durationInFrames: number;
  currentStep?: number;
  totalSteps?: number;
  showLowerThird?: boolean;
}

export const Scene: React.FC<SceneProps> = ({
  scene,
  videoSrc,
  durationInFrames,
  currentStep = 1,
  totalSteps = 4,
  showLowerThird = false,
}) => {
  const frame = useCurrentFrame();
  const startSec = scene.segments[0]?.src_start || 0;
  const startFrame = Math.round(startSec * 30);

  // Dip-through-background transition: gentle fade at scene cut points
  const transitionOpacity = interpolate(
    frame,
    [0, 5, durationInFrames - 5, durationInFrames],
    [0.92, 1, 1, 0.94],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        opacity: transitionOpacity,
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

        {/* Focus Spotlight Ring around verified target */}
        <Spotlight
          target={scene.target}
          active={scene.cursor.click}
          durationInFrames={durationInFrames}
        />

        <Cursor
          from={scene.cursor.from}
          to={scene.cursor.to}
          click={scene.cursor.click}
          durationInFrames={durationInFrames}
        />
      </CameraRig>

      {/* Kinetic Scene Cut Transition Flare */}
      <KineticTransition durationInFrames={durationInFrames} leadFrames={7} />

      {/* Lower Third Caption when active / in hero wide mode */}
      {showLowerThird && (
        <LowerThird
          scene={scene}
          stepNumber={currentStep}
          totalSteps={totalSteps}
        />
      )}

      {/* Tactile interaction click sound */}
      {scene.cursor.click && (
        <Sequence from={Math.floor(durationInFrames * 0.55)}>
          <Audio src={staticFile('sfx-click.wav')} volume={0.65} />
        </Sequence>
      )}
    </div>
  );
};
