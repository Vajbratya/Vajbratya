import React from 'react';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  Sequence,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

const C = {
  ink: '#090909',
  paper: '#F4F3EF',
  white: '#FFFFFF',
  muted: '#9C9B96',
  line: '#2A2A28',
  red: '#FF4A2D',
  redDark: '#C32C16',
};

const FONT = 'Arial, Helvetica, sans-serif';

const clamp = {extrapolateLeft: 'clamp' as const, extrapolateRight: 'clamp' as const};
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Grain: React.FC<{opacity?: number; light?: boolean}> = ({opacity = 0.08, light = false}) => (
  <AbsoluteFill
    style={{
      opacity,
      pointerEvents: 'none',
      backgroundImage: light
        ? 'radial-gradient(circle at 20% 15%, rgba(255,255,255,0.18) 0 1px, transparent 1.5px), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.12) 0 1px, transparent 1.5px)'
        : 'radial-gradient(circle at 20% 15%, rgba(0,0,0,0.14) 0 1px, transparent 1.5px), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.09) 0 1px, transparent 1.5px)',
      backgroundSize: '7px 7px, 11px 11px',
    }}
  />
);

const Wordmark: React.FC<{inverse?: boolean; compact?: boolean}> = ({inverse = false, compact = false}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: compact ? 36 : 44,
      fontWeight: 800,
      letterSpacing: -1.8,
      color: inverse ? C.paper : C.ink,
    }}
  >
    Laudos<span style={{color: C.red}}>.AI</span>
  </div>
);

const Kicker: React.FC<{children: React.ReactNode; inverse?: boolean}> = ({children, inverse = false}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: 24,
      fontWeight: 800,
      letterSpacing: 4.2,
      color: inverse ? '#B9B8B3' : '#63625F',
      textTransform: 'uppercase',
    }}
  >
    {children}
  </div>
);

const BigText: React.FC<{
  children: React.ReactNode;
  inverse?: boolean;
  size?: number;
  width?: number | string;
}> = ({children, inverse = false, size = 112, width = 900}) => (
  <div
    style={{
      fontFamily: FONT,
      fontSize: size,
      lineHeight: 0.93,
      fontWeight: 900,
      letterSpacing: -6.5,
      color: inverse ? C.paper : C.ink,
      width,
    }}
  >
    {children}
  </div>
);

const RawTextBlock: React.FC<{progress: number}> = ({progress}) => {
  const lines = [
    'TC de crânio sem contraste. Área hipodensa',
    'frontoparietal direita, sem efeito de massa.',
    'Sem hemorragia intracraniana aguda.',
    'Ventrículos preservados. Linha média centrada.',
    'Sem coleções extra-axiais. Correlacionar com clínica.',
  ];

  return (
    <div
      style={{
        position: 'absolute',
        left: 78,
        right: 78,
        top: 760,
        padding: '42px 40px 40px',
        border: `1px solid ${C.line}`,
        borderRadius: 28,
        backgroundColor: '#11110F',
        boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 34}}>
        <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 24, color: '#DDDDD7'}}>OUTPUT DO MODELO</div>
        <div
          style={{
            fontFamily: FONT,
            fontSize: 20,
            color: '#787872',
            padding: '8px 13px',
            borderRadius: 99,
            border: '1px solid #30302D',
          }}
        >
          texto livre
        </div>
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 18}}>
        {lines.map((line, i) => {
          const lineProgress = interpolate(progress, [i * 0.13, i * 0.13 + 0.28], [0, 1], clamp);
          return (
            <div
              key={line}
              style={{
                fontFamily: FONT,
                fontSize: 23,
                fontWeight: 500,
                color: '#C4C4BE',
                opacity: 0.25 + lineProgress * 0.75,
                clipPath: `inset(0 ${100 - lineProgress * 100}% 0 0)`,
                whiteSpace: 'nowrap',
              }}
            >
              {line}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SceneModels: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const titleIn = spring({frame, fps, config: {damping: 18, stiffness: 120, mass: 0.8}});
  const progress = interpolate(frame, [40, 125], [0, 1], {...clamp, easing: Easing.inOut(ease)});
  const strike = interpolate(frame, [126, 164], [0, 1], {...clamp, easing: ease});

  return (
    <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
      <Grain opacity={0.12} light />
      <div style={{position: 'absolute', top: 82, left: 78}}><Wordmark inverse compact /></div>
      <div style={{position: 'absolute', left: 78, top: 292, opacity: titleIn, translate: `0 ${(1 - titleIn) * 46}px`}}>
        <Kicker inverse>01 · O ERRO DE CATEGORIA</Kicker>
        <div style={{height: 24}} />
        <BigText inverse size={126}>MODELOS<br />GERAM <span style={{color: C.red}}>TEXTO.</span></BigText>
      </div>
      <RawTextBlock progress={progress} />
      <div
        style={{
          position: 'absolute',
          left: 79,
          top: 1408,
          fontFamily: FONT,
          fontSize: 58,
          lineHeight: 1.04,
          fontWeight: 900,
          letterSpacing: -2.6,
          color: C.paper,
          opacity: interpolate(frame, [126, 143], [0, 1], clamp),
        }}
      >
        Texto não é laudo.
        <div
          style={{
            marginTop: 16,
            width: 390 * strike,
            height: 8,
            borderRadius: 8,
            backgroundColor: C.red,
          }}
        />
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 92,
          left: 78,
          right: 78,
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          opacity: interpolate(frame, [142, 166], [0, 1], clamp),
        }}
      >
        {['sem contexto do fluxo', 'sem estrutura clínica', 'sem assinatura'].map((label, i) => (
          <div key={label} style={{display: 'flex', alignItems: 'center', gap: 10}}>
            <div style={{width: 9, height: 9, borderRadius: 99, backgroundColor: i === 2 ? C.red : '#52524E'}} />
            <div style={{fontFamily: FONT, fontSize: 22, color: '#8E8E88', fontWeight: 700}}>{label}</div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const ReportCard: React.FC<{reveal: number; signed?: boolean}> = ({reveal, signed = false}) => {
  const sections = [
    ['TÉCNICA', 'Aquisição volumétrica sem contraste intravenoso.'],
    ['ANÁLISE', 'Área hipodensa córtico-subcortical frontoparietal direita,\nsem efeito de massa significativo. Ausência de hemorragia\nintracraniana aguda.'],
    ['CONCLUSÃO', 'Área hipodensa frontoparietal direita, de aspecto isquêmico,\nsem sinais de transformação hemorrágica.'],
  ];
  return (
    <div
      style={{
        width: 914,
        backgroundColor: C.white,
        borderRadius: 34,
        border: '1px solid #DAD9D3',
        boxShadow: '0 34px 90px rgba(40,35,25,0.16)',
        overflow: 'hidden',
      }}
    >
      <div style={{height: 76, padding: '0 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #E7E6E0'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12}}>
          <div style={{width: 12, height: 12, backgroundColor: C.red, borderRadius: 99}} />
          <div style={{fontFamily: FONT, fontWeight: 800, fontSize: 22, color: C.ink}}>TC CRÂNIO</div>
        </div>
        <div style={{fontFamily: FONT, fontWeight: 700, fontSize: 19, color: '#8A8984'}}>Editor de laudo</div>
      </div>
      <div style={{padding: '34px 34px 30px'}}>
        {sections.map(([title, text], i) => {
          const p = interpolate(reveal, [i * 0.22, i * 0.22 + 0.52], [0, 1], clamp);
          return (
            <div key={title} style={{marginBottom: i === sections.length - 1 ? 24 : 34, opacity: 0.15 + p * 0.85, translate: `${(1 - p) * 18}px 0`}}>
              <div style={{fontFamily: FONT, fontSize: 17, letterSpacing: 2.8, fontWeight: 900, color: title === 'CONCLUSÃO' ? C.redDark : '#74736F', marginBottom: 12}}>{title}</div>
              <div style={{fontFamily: FONT, fontSize: 27, lineHeight: 1.34, fontWeight: 600, color: C.ink}}>{text}</div>
            </div>
          );
        })}
        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #ECEBE7', paddingTop: 24}}>
          <div style={{display: 'flex', gap: 10}}>
            {['coerência', 'lateralidade', 'críticos'].map((t) => (
              <div key={t} style={{fontFamily: FONT, fontSize: 16, fontWeight: 800, padding: '9px 12px', borderRadius: 99, backgroundColor: '#F2F1EC', color: '#6A6965'}}>{t}</div>
            ))}
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 21,
              fontWeight: 900,
              padding: '14px 22px',
              borderRadius: 16,
              backgroundColor: signed ? C.ink : '#E6E5DF',
              color: signed ? C.white : '#A7A6A0',
              boxShadow: signed ? '0 8px 24px rgba(0,0,0,0.18)' : 'none',
            }}
          >
            {signed ? 'ASSINADO ✓' : 'ASSINAR'}
          </div>
        </div>
      </div>
    </div>
  );
};

const SceneRadiologist: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const intro = spring({frame, fps, config: {damping: 18, stiffness: 130, mass: 0.9}});
  const reveal = interpolate(frame, [58, 175], [0, 1], {...clamp, easing: ease});
  return (
    <AbsoluteFill style={{backgroundColor: C.paper, overflow: 'hidden'}}>
      <Grain opacity={0.08} />
      <div style={{position: 'absolute', top: 78, left: 78}}><Wordmark compact /></div>
      <div style={{position: 'absolute', left: 78, top: 248, opacity: intro, translate: `0 ${(1 - intro) * 36}px`}}>
        <Kicker>02 · O QUE O MÉDICO ENTREGA</Kicker>
        <div style={{height: 22}} />
        <BigText size={102}>RADIOLOGISTAS<br />GERAM <span style={{color: C.red}}>LAUDOS.</span></BigText>
      </div>
      <div style={{position: 'absolute', left: 82, top: 700, opacity: interpolate(frame, [46, 72], [0, 1], clamp), scale: interpolate(frame, [46, 88], [0.96, 1], {...clamp, easing: ease})}}>
        <ReportCard reveal={reveal} />
      </div>
      <div style={{position: 'absolute', bottom: 102, left: 78, right: 78, display: 'flex', justifyContent: 'space-between', opacity: interpolate(frame, [142, 178], [0, 1], clamp)}}>
        {[
          ['contexto', 'do exame'],
          ['linguagem', 'radiológica'],
          ['responsabilidade', 'médica'],
          ['workflow', 'de assinatura'],
        ].map(([a, b], i) => (
          <div key={a} style={{width: 210}}>
            <div style={{fontFamily: FONT, fontSize: 15, color: C.red, fontWeight: 900, letterSpacing: 2.5, marginBottom: 8}}>0{i + 1}</div>
            <div style={{fontFamily: FONT, fontSize: 23, color: C.ink, fontWeight: 900, lineHeight: 1.0}}>{a}<br /><span style={{color: '#75746F'}}>{b}</span></div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

const PipelineChip: React.FC<{label: string; index: number; frame: number}> = ({label, index, frame}) => {
  const inP = interpolate(frame, [48 + index * 18, 78 + index * 18], [0, 1], {...clamp, easing: ease});
  return (
    <div
      style={{
        height: 74,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        borderRadius: 18,
        backgroundColor: index === 3 ? C.red : '#171715',
        border: index === 3 ? '1px solid #FF7059' : '1px solid #2E2E2B',
        opacity: inP,
        translate: `${(1 - inP) * 24}px 0`,
      }}
    >
      <div style={{fontFamily: FONT, fontSize: 22, fontWeight: 900, color: index === 3 ? C.white : '#D5D4CE'}}>{label}</div>
    </div>
  );
};

const SceneBridge: React.FC = () => {
  const frame = useCurrentFrame();
  const rawMove = interpolate(frame, [26, 98], [0, 1], {...clamp, easing: ease});
  const reportReveal = interpolate(frame, [82, 172], [0, 1], {...clamp, easing: ease});
  const signed = frame >= 173;
  return (
    <AbsoluteFill style={{backgroundColor: C.ink, overflow: 'hidden'}}>
      <Grain opacity={0.1} light />
      <div style={{position: 'absolute', left: 78, top: 82}}><Wordmark inverse compact /></div>
      <div style={{position: 'absolute', left: 78, top: 216}}>
        <Kicker inverse>03 · A CAMADA QUE FALTAVA</Kicker>
        <div style={{height: 18}} />
        <div style={{fontFamily: FONT, fontSize: 78, lineHeight: 0.96, fontWeight: 900, letterSpacing: -4.2, color: C.paper, width: 880}}>
          ENTRE O MODELO<br />E O <span style={{color: C.red}}>LAUDO.</span>
        </div>
      </div>

      <div style={{position: 'absolute', left: 78, right: 78, top: 524, height: 520}}>
        <div style={{position: 'absolute', left: 0, top: 100, width: 240, height: 250, borderRadius: 30, border: '1px solid #2B2B29', backgroundColor: '#11110F', padding: 26, opacity: 1 - rawMove * 0.48, translate: `${rawMove * 26}px 0`}}>
          <div style={{fontFamily: FONT, fontSize: 17, fontWeight: 900, letterSpacing: 2.2, color: '#777771'}}>MODELO</div>
          <div style={{marginTop: 24, fontFamily: FONT, fontSize: 24, lineHeight: 1.3, fontWeight: 700, color: '#CDCDC7'}}>“Área hipodensa... ausência de hemorragia...”</div>
          <div style={{position: 'absolute', bottom: 24, left: 26, right: 26, height: 5, borderRadius: 9, backgroundColor: '#2A2A27', overflow: 'hidden'}}>
            <div style={{height: '100%', width: `${rawMove * 100}%`, backgroundColor: C.red}} />
          </div>
        </div>

        <div style={{position: 'absolute', left: 272, top: 34, width: 500, display: 'flex', flexDirection: 'column', gap: 12}}>
          {['contexto clínico', 'estrutura do laudo', 'checagens', 'workflow médico'].map((label, i) => (
            <PipelineChip key={label} label={label} index={i} frame={frame} />
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            left: 788,
            top: 148,
            width: 108,
            height: 108,
            borderRadius: 999,
            backgroundColor: C.paper,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: interpolate(frame, [118, 148], [0, 1], clamp),
            scale: interpolate(frame, [118, 154], [0.7, 1], {...clamp, easing: ease}),
          }}
        >
          <div style={{fontFamily: FONT, color: C.ink, fontSize: 48, fontWeight: 900}}>→</div>
        </div>
      </div>

      <div style={{position: 'absolute', left: 82, top: 1015, scale: 0.9, opacity: interpolate(frame, [118, 150], [0, 1], clamp)}}>
        <ReportCard reveal={reportReveal} signed={signed} />
      </div>

      <div
        style={{
          position: 'absolute',
          left: 78,
          bottom: 42,
          fontFamily: FONT,
          fontSize: 34,
          lineHeight: 1.15,
          fontWeight: 800,
          color: '#C7C6C0',
          opacity: interpolate(frame, [158, 194], [0, 1], clamp),
        }}
      >
        Não é um chatbot para radiologia.<br />É infraestrutura para <span style={{color: C.paper}}>produzir o laudo.</span>
      </div>
    </AbsoluteFill>
  );
};

const SceneThesis: React.FC = () => {
  const frame = useCurrentFrame();
  const reveal1 = interpolate(frame, [6, 30], [0, 1], {...clamp, easing: ease});
  const reveal2 = interpolate(frame, [28, 54], [0, 1], {...clamp, easing: ease});
  const reveal3 = interpolate(frame, [56, 92], [0, 1], {...clamp, easing: ease});
  const rule = interpolate(frame, [85, 120], [0, 1], {...clamp, easing: ease});
  return (
    <AbsoluteFill style={{backgroundColor: C.paper, overflow: 'hidden'}}>
      <Grain opacity={0.08} />
      <div style={{position: 'absolute', top: 90, left: 78}}><Wordmark compact /></div>
      <div style={{position: 'absolute', left: 78, top: 355, right: 78}}>
        <div style={{opacity: reveal1, translate: `0 ${(1 - reveal1) * 34}px`}}>
          <div style={{fontFamily: FONT, fontSize: 82, fontWeight: 900, letterSpacing: -4.8, lineHeight: 0.96, color: C.ink}}>MODELOS</div>
          <div style={{fontFamily: FONT, fontSize: 82, fontWeight: 900, letterSpacing: -4.8, lineHeight: 0.96, color: '#9A9994'}}>GERAM TEXTO.</div>
        </div>
        <div style={{height: 78}} />
        <div style={{opacity: reveal2, translate: `0 ${(1 - reveal2) * 34}px`}}>
          <div style={{fontFamily: FONT, fontSize: 82, fontWeight: 900, letterSpacing: -4.8, lineHeight: 0.96, color: C.ink}}>RADIOLOGISTAS</div>
          <div style={{fontFamily: FONT, fontSize: 82, fontWeight: 900, letterSpacing: -4.8, lineHeight: 0.96, color: '#9A9994'}}>GERAM LAUDOS.</div>
        </div>
        <div style={{height: 102}} />
        <div style={{height: 10, width: `${rule * 100}%`, backgroundColor: C.red, borderRadius: 99, marginBottom: 54}} />
        <div style={{opacity: reveal3, translate: `0 ${(1 - reveal3) * 34}px`}}>
          <div style={{fontFamily: FONT, fontSize: 66, fontWeight: 900, letterSpacing: -3.5, lineHeight: 0.98, color: C.ink}}>
            A <span style={{color: C.red}}>Laudos.AI</span> é onde<br />isso acontece.
          </div>
        </div>
      </div>
      <div style={{position: 'absolute', left: 78, right: 78, bottom: 110, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', opacity: interpolate(frame, [112, 145], [0, 1], clamp)}}>
        <div style={{fontFamily: FONT, fontSize: 24, lineHeight: 1.25, fontWeight: 700, color: '#777671'}}>Speech-to-Report.<br />Não apenas speech-to-text.</div>
        <div style={{fontFamily: FONT, fontSize: 20, fontWeight: 800, color: '#A09F99', letterSpacing: 1.8}}>LAUDOS.AI</div>
      </div>
    </AbsoluteFill>
  );
};

export const LaudosThesis: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: C.ink}}>
      <Sequence from={0} durationInFrames={180}><SceneModels /></Sequence>
      <Sequence from={180} durationInFrames={195}><SceneRadiologist /></Sequence>
      <Sequence from={375} durationInFrames={225}><SceneBridge /></Sequence>
      <Sequence from={600} durationInFrames={210}><SceneThesis /></Sequence>
    </AbsoluteFill>
  );
};
