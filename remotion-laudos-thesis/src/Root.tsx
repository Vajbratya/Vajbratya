import React from 'react';
import {Composition} from 'remotion';
import {LaudosThesis} from './LaudosThesis';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="LaudosThesis"
      component={LaudosThesis}
      durationInFrames={810}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
