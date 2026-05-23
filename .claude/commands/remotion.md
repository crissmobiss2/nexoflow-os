---
name: remotion
description: Remotion programmatic video generation — React-based video framework for creating MP4 demos, explainers, and animated presentations
---

# Remotion — Programmatic Video with React

Remotion turns React components into MP4 videos. Use it to generate animated software demos, explainer videos, and data-driven presentations for NexoFlow clients.

## Core Concepts

### The Frame Model
- `useCurrentFrame()` returns the current frame number (0-based)
- `fps`: frames per second (typically 30 or 60)
- `durationInFrames`: total video length = fps × seconds
- `interpolate(frame, [from, to], [valueFrom, valueTo])` — maps frames to any value

### Basic Composition Structure
```tsx
import { Composition, useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

const MyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const opacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  
  return <div style={{ opacity }}>Hello</div>;
};

export const Root: React.FC = () => (
  <Composition
    id="MyVideo"
    component={MyScene}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
  />
);
```

### Spring Animations (Physics-based)
```tsx
const scale = spring({
  frame,
  fps,
  from: 0,
  to: 1,
  config: { damping: 200, stiffness: 300 },
});
```

### Sequences (Timeline Composition)
```tsx
import { Sequence } from 'remotion';

// Elements appear at specific frames
<Sequence from={0} durationInFrames={90}>
  <TitleSlide />
</Sequence>
<Sequence from={60} durationInFrames={90}>  {/* overlaps at frames 60-90 */}
  <ContentSlide />
</Sequence>
```

## NexoFlow Video Demo Pattern

### Structure for Client Demo Videos
```
Frame 0-60:    Logo intro + "Custom demo for [Company]" pill
Frame 60-120:  Problem statement (pain points with animated counters)
Frame 120-240: Solution walkthrough (screen recording overlay or animated UI)
Frame 240-300: ROI stats bar with counting animation
Frame 300-360: CTA + nexoflow.tech
```

### Animated Counter
```tsx
const AnimatedNumber: React.FC<{target: number; label: string}> = ({target, label}) => {
  const frame = useCurrentFrame();
  const value = Math.round(interpolate(frame, [0, 60], [0, target], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  return (
    <div>
      <span style={{fontSize: 72, fontWeight: 900}}>{value}×</span>
      <p>{label}</p>
    </div>
  );
};
```

### Typewriter Text Effect
```tsx
const TypewriterText: React.FC<{text: string}> = ({text}) => {
  const frame = useCurrentFrame();
  const charsToShow = Math.floor(interpolate(frame, [0, text.length * 2], [0, text.length], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  }));
  return <span>{text.slice(0, charsToShow)}</span>;
};
```

## Setup Commands
```bash
npx create-video@latest          # scaffold new Remotion project
npm run dev                      # open Remotion Studio at localhost:3000
npx remotion render --codec=h264 MyVideo out.mp4   # render to MP4
npx remotion render --codec=gif  MyVideo out.gif   # render to GIF
```

## Audio Integration
```tsx
import { Audio } from 'remotion';
// Edge TTS (free, no API key)
// MiniMax TTS (premium voice cloning)
<Audio src="voiceover.mp3" startFrom={0} volume={1} />
```

## Critical Rules
- Always use `extrapolateLeft: 'clamp'` and `extrapolateRight: 'clamp'` on `interpolate()` to prevent values going outside expected range
- For captions under 20 frames: `Math.min(10, Math.floor(durationInFrames / 3))` to prevent monotonic violation
- Define shared `styles.ts` with type scale — never set font sizes inline per scene
- WebGL contexts: set `chromiumOptions: { gl: "angle" }` in remotion.config.ts for 3D scenes
- Use `@remotion/three` + React Three Fiber for 3D product demos

## When to Use for NexoFlow
- Client wants a video version of their demo to embed in proposals
- Software demos that show animated user flows
- Data visualization videos showing ROI metrics over time
- Social media clips showing the transformation story
