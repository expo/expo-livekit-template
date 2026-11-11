import type { AgentState } from '@livekit/components-react';

import { ReactShaderToy } from './react-shader-toy';
import { useAgentAudioVisualizerWave } from './use-agent-audio-visualizer-wave';

const shaderSource = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform float uSpeed;
uniform float uAmplitude;
uniform float uFrequency;
uniform float uMix;
const float uLineWidth = 2.0;
const float uSmoothing = 0.5;
const vec3 uColor = vec3(1.0);

float bellCurve(float distanceFromCenter, float maxDistance) {
  float normalizedDistance = distanceFromCenter / maxDistance;
  return pow(cos(normalizedDistance * (3.14159265359 / 4.0)), 16.0);
}

float oscilloscopeWave(float x, float centerX, float time) {
  float relativeX = x - centerX;
  float maxDistance = centerX;
  float distanceFromCenter = abs(relativeX);
  float bell = bellCurve(distanceFromCenter, maxDistance);
  float wave = sin(relativeX * uFrequency + time * uSpeed) * uAmplitude * bell;
  return wave;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;
  float centerX = 0.5;
  float centerY = 0.5;
  float x = uv.x;
  float y = uv.y;
  float pixelSize = 2.0 / (iResolution.x + iResolution.y);
  float lineWidthUV = uLineWidth * pixelSize;
  float smoothingUV = uSmoothing * pixelSize;
  const int NUM_SAMPLES = 50;
  float minDist = 1000.0;
  float sampleRange = 0.02;
  for(int i = 0; i < NUM_SAMPLES; i++) {
    float offset = (float(i) / float(NUM_SAMPLES - 1) - 0.5) * sampleRange;
    float sampleX = x + offset;
    float waveY = centerY + oscilloscopeWave(sampleX, centerX, iTime);
    vec2 wavePoint = vec2(sampleX, waveY);
    vec2 currentPoint = vec2(x, y);
    float dist = distance(currentPoint, wavePoint);
    minDist = min(minDist, dist);
  }
  float line = smoothstep(lineWidthUV + smoothingUV, lineWidthUV - smoothingUV, minDist);
  vec3 color = uColor * line;
  float alpha = line * uMix;
  fragColor = vec4(color * uMix, alpha);
}

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

export function AgentAudioVisualizerWave({ state, volume }: { state: AgentState; volume: number }) {
  const { speed, amplitude, frequency, opacity } = useAgentAudioVisualizerWave(state, volume);

  return (
    <div className="lk-wave" data-lk-state={state}>
      <ReactShaderToy
        source={shaderSource}
        uniforms={{ uSpeed: speed, uAmplitude: amplitude, uFrequency: frequency, uMix: opacity }}
      />
    </div>
  );
}
