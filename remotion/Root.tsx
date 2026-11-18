import React from 'react';
import { Composition } from 'remotion';
import { Demo, calculateMetadata } from './Demo';
import { AutoCastShowcase, calculateShowcaseMetadata, ShowcaseProps } from './Showcase';
import { RemotionTerminalOnly, RemotionTerminalSplitHud } from './TerminalShowcase';
import storyboardData from '../storyboard.json';
import defaultShowcaseProps from '../examples/output/showcase-props.json';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        calculateMetadata={calculateMetadata}
        defaultProps={{
          storyboard: storyboardData as any,
        }}
      />
      <Composition
        id="AutoCastShowcase"
        component={AutoCastShowcase}
        calculateMetadata={calculateShowcaseMetadata}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={6750}
        defaultProps={defaultShowcaseProps as ShowcaseProps}
      />
      <Composition
        id="RemotionTerminalOnly"
        component={RemotionTerminalOnly}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={120} // 4.0 seconds test
      />
      <Composition
        id="RemotionTerminalSplitHud"
        component={RemotionTerminalSplitHud}
        width={1920}
        height={1080}
        fps={30}
        durationInFrames={120} // 4.0 seconds test
      />
    </>
  );
};
