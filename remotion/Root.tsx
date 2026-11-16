import React from 'react';
import { Composition } from 'remotion';
import { Demo, calculateMetadata } from './Demo';
import storyboardData from '../storyboard.json';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Demo"
      component={Demo}
      calculateMetadata={calculateMetadata}
      defaultProps={{
        storyboard: storyboardData as any,
      }}
    />
  );
};
