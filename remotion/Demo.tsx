import React from 'react';
import {
  CalculateMetadataFunction,
  interpolate,
  spring,
  Series,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { BrowserFrame } from './components/BrowserFrame';
import { Sidebar } from './components/Sidebar';
import { Scene } from './components/Scene';
import { TitleCard } from './components/TitleCard';
import { Outro } from './components/Outro';
import { FloatingHud } from './components/FloatingHud';
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

  // Smooth fade transitions for overlays
  const isTitleVisible = frame < TITLE_FRAMES;
  const isOutroVisible = frame >= durationInFrames - OUTRO_FRAMES;

  // Dynamic 3-stage layout:
  // Act 1 (Scene 1): Hero Wide opening (1720x920, centered, clean overview)
  // Act 2 (Scenes 2 to penultimate): Studio Split (1450x854 browser + synchronized sidebar)
  // Act 3 (Final Scene): Return to Hero Wide to celebrate the reconciled, approved state
  const hasMultipleScenes = scenes.length > 2;
  const scene1Frames = Math.round((scenes[0]?.audio_sec || 3.5) * fps);
  const transitionInFrame = TITLE_FRAMES + Math.round(scene1Frames * 0.7);

  const lastSceneFrames = Math.round((scenes[scenes.length - 1]?.audio_sec || 3.5) * fps);
  const transitionOutFrame = durationInFrames - OUTRO_FRAMES - Math.round(lastSceneFrames * 0.6);

  // Entrance spring (Hero -> Split)
  const splitEntrance = hasMultipleScenes
    ? spring({
        frame: Math.max(0, frame - transitionInFrame),
        fps,
        config: { damping: 18, stiffness: 80, mass: 0.9 },
      })
    : 1;

  // Exit spring (Split -> Hero Finale)
  const splitExit = hasMultipleScenes && frame >= transitionOutFrame
    ? spring({
        frame: Math.max(0, frame - transitionOutFrame),
        fps,
        config: { damping: 18, stiffness: 80, mass: 0.9 },
      })
    : 0;

  // Combined split factor: 0 = Hero Wide Mode, 1 = Studio Split Mode
  const splitFactor = Math.max(0, Math.min(1, splitEntrance - splitExit));

  const isHudLayout = (meta as any)?.layout === 'hud';

  const browserWidth = isHudLayout
    ? 1800
    : Math.round(interpolate(splitFactor, [0, 1], [1720, 1450]));
  const browserHeight = isHudLayout
    ? 960
    : Math.round(interpolate(splitFactor, [0, 1], [920, 854]));
  const browserLeft = isHudLayout
    ? 60
    : Math.round(interpolate(splitFactor, [0, 1], [(1920 - 1720) / 2, 32]));
  const browserTop = Math.round((1080 - browserHeight) / 2);

  const sidebarTranslateX = interpolate(splitFactor, [0, 1], [420, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const sidebarOpacity = interpolate(splitFactor, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        width: 1920,
        height: 1080,
        backgroundColor: '#090d16',
        backgroundImage: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #090d16 80%)',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Title Card Overlay */}
      {isTitleVisible && <TitleCard title={meta.title} />}

      {/* Main Studio Viewport (Browser Frame) */}
      <div
        style={{
          position: 'absolute',
          left: browserLeft,
          top: browserTop,
          width: browserWidth,
          height: browserHeight,
          transition: 'none',
        }}
      >
        <BrowserFrame url={`http://localhost:8080/invoices`} width={browserWidth} height={browserHeight}>
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
      </div>

      {/* Either Synchronized Step Sidebar or Floating HUD */}
      {isHudLayout ? (
        !isTitleVisible && !isOutroVisible && (
          <FloatingHud
            scene={scenes[activeSceneIndex] || scenes[0]}
            stepNumber={activeSceneIndex + 1}
            totalSteps={scenes.length}
            title={meta.title}
          />
        )
      ) : (
        <div
          style={{
            position: 'absolute',
            left: 1506,
            top: 113,
            transform: `translateX(${sidebarTranslateX}px)`,
            opacity: sidebarOpacity,
            pointerEvents: splitFactor < 0.05 ? 'none' : 'auto',
          }}
        >
          <Sidebar
            scenes={scenes}
            activeSceneIndex={activeSceneIndex}
            title={meta.title}
          />
        </div>
      )}

      {/* Outro Overlay: Verified End Card */}
      {isOutroVisible && <Outro title={meta.title} />}
    </div>
  );
};
