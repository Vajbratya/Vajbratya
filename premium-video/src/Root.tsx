import {Composition} from 'remotion';
import {PremiumThesis} from './PremiumThesis';

export const Root = () => {
  return (
    <Composition
      id="LaudosPremium"
      component={PremiumThesis}
      durationInFrames={870}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
