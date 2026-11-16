import React from 'react';
import {
  CalculateMetadataFunction,
  interpolate,
  Series,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BrowserFrame } from './components/BrowserFrame';
import { Sidebar } from './components/Sidebar';
import { Scene } from './components/Scene';
import { TitleCard } from './components/TitleCard';
import { Outro } from './components/Outro';
import { Storyboard } from '../src/types';

export type DemoProps = {
  storyboard: Storyboard;
  [key: string]: unknown;
};

const TITLE_FRAMES = 75; // 2.5 seconds
const OUTRO_FRAMES = 75; // 2.5 seconds

export const calculateMetadata: CalculateMetadataFunction<DemoProps> = async ({
  props,
}) => {
  const fps = props.storyboard?.meta?.fps || 30;
  const scenes = props.storyboard?.scenes || [];

  const scenesFrames = scenes.reduce((acc, scene) => {
    return acc + Math.round((scene.audio_sec || 3.5) * fps);
  }, 0);

  const durationInFrames = TITLE_FRAMES + scenesFrames + OUTRO_FRAMES;

  return {
    fps,
    width: 1920,
    height: 1080,
    durationInFrames: Math.max(fps * 3, durationInFrames),
  };
};

export const Demo: React.FC<DemoProps> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const scenes = storyboard.scenes;
  const meta = storyboard.meta;

  // Determine which scene is active based on the current frame
  let sceneOffset = TITLE_FRAMES;
  let activeSceneIndex = 0;
  let found = false;

  for (let i = 0; i < scenes.length; i++) {
    const sceneFrames = Math.round((scenes[i].audio_sec || 3.5) * fps);
    if (frame >= sceneOffset && frame < sceneOffset + sceneFrames) {
      activeSceneIndex = i;
      found = true;
      break;
    }
    sceneOffset += sceneFrames;
  }

  if (!found) {
    if (frame < TITLE_FRAMES) {
      activeSceneIndex = 0;
    } else {
      activeSceneIndex = scenes.length - 1;
    }
  }

  // Smooth fade transitions
  const isTitleVisible = frame < TITLE_FRAMES;
  const isOutroVisible = frame >= durationInFrames - OUTRO_FRAMES;

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#090d16',
        backgroundImage: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #090d16 80%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        boxSizing: 'border-box',
        gap: 24,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Title Card Overlay */}
      {isTitleVisible && <TitleCard title={meta.title} />}

      {/* Main Studio Viewport (Browser Frame + Sidebar) */}
      <BrowserFrame url={`http://localhost:8080/invoices`} width={1450} height={854}>
        <Series>
          {/* Title placeholder offset */}
          <Series.Sequence durationInFrames={TITLE_FRAMES}>
            <div style={{ width: 1920, height: 1080, backgroundColor: '#0f172a' }} />
          </Series.Sequence>

          {/* Sequential Scenes */}
          {scenes.map((scene, idx) => {
            const sceneFrames = Math.round((scene.audio_sec || 3.5) * fps);
            return (
              <Series.Sequence key={scene.id} durationInFrames={sceneFrames}>
                <Scene
                  scene={scene}
                  videoSrc={meta.source.video}
                  durationInFrames={sceneFrames}
                  currentStep={idx + 1}
                  totalSteps={scenes.length}
                />
              </Series.Sequence>
            );
          })}

          {/* Outro placeholder */}
          <Series.Sequence durationInFrames={OUTRO_FRAMES}>
            <div style={{ width: 1920, height: 1080, backgroundColor: '#0f172a' }} />
          </Series.Sequence>
        </Series>
      </BrowserFrame>

      {/* Synchronized Step Sidebar */}
      <Sidebar
        scenes={scenes}
        activeSceneIndex={activeSceneIndex}
        title={meta.title}
      />

      {/* Outro Overlay: Verified End Card */}
      {isOutroVisible && <Outro title={meta.title} />}
    </div>
  );
};
