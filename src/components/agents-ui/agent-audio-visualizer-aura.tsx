import type { AgentState } from '@livekit/components-react';

import { ReactShaderToy } from './react-shader-toy';
import { useAgentAudioVisualizerAura } from './use-agent-audio-visualizer-aura';

const shaderSource = `
precision highp float;
uniform float iTime;
uniform vec2 iResolution;
uniform float uSpeed;
uniform float uScale;
uniform float uFrequency;
uniform float uAmplitude;
uniform float uMix;
const float uBlur = 0.2;
const float uShape = 1.0;
const float uBloom = 0.0;
const float uSpacing = 0.5;
const float uColorShift = 0.12;
const float uVariance = 0.1;
const float uSmoothing = 1.0;
const float uMode = 0.0;
const vec3 uColor = vec3(1.0);
const float TAU = 6.283185;

vec2 randFibo(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.xx + p.yx) * p.xy);
}

vec3 Tonemap(vec3 x) {
  x *= 4.0;
  return x / (1.0 + x);
}

float luma(vec3 color) {
  return dot(color, vec3(0.299, 0.587, 0.114));
}

vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float sdCircle(vec2 st, float r) {
  return length(st) - r;
}

float sdLine(vec2 p, float r) {
  float halfLen = r * 2.0;
  vec2 a = vec2(-halfLen, 0.0);
  vec2 b = vec2(halfLen, 0.0);
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

float getSdf(vec2 st) {
  if(uShape == 1.0) return sdCircle(st, uScale);
  else if(uShape == 2.0) return sdLine(st, uScale);
  return sdCircle(st, uScale);
}

vec2 turb(vec2 pos, float t, float it) {

  mat2 rotation = mat2(0.6, -0.25, 0.25, 0.9);

  mat2 layerRotation = mat2(0.6, -0.8, 0.8, 0.6);

  float frequency = mix(2.0, 15.0, uFrequency);
  float amplitude = uAmplitude;
  float frequencyGrowth = 1.4;
  float animTime = t * 0.1 * uSpeed;

  const int LAYERS = 4;
  for(int i = 0; i < LAYERS; i++) {

    vec2 rotatedPos = pos * rotation;
    vec2 wave = sin(frequency * rotatedPos + float(i) * animTime + it);

    pos += (amplitude / frequency) * rotation[0] * wave;

    rotation *= layerRotation;
    amplitude *= mix(1.0, max(wave.x, wave.y), uVariance);
    frequency *= frequencyGrowth;
  }

  return pos;
}

const float ITERATIONS = 36.0;

const float LIGHT_MODE_OPACITY = 1.5;
const float LIGHT_MODE_MIN_FADE = 0.5;

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
  vec2 uv = fragCoord / iResolution.xy;

  vec3 pp = vec3(0.0);
  vec3 bloom = vec3(0.0);
  float t = iTime * 0.5;
  vec2 pos = uv - 0.5;

  vec2 prevPos = turb(pos, t, 0.0 - 1.0 / ITERATIONS);
  float spacing = mix(1.0, TAU, uSpacing);

  for(float i = 1.0; i < ITERATIONS + 1.0; i++) {
    float iter = i / ITERATIONS;
    vec2 st = turb(pos, t, iter * spacing);
    float d = abs(getSdf(st));
    float pd = distance(st, prevPos);
    prevPos = st;
    float dynamicBlur = exp2(pd * 2.0 * 1.4426950408889634) - 1.0;
    float ds = smoothstep(0.0, uBlur * 0.05 + max(dynamicBlur * uSmoothing, 0.001), d);

    vec3 color = uColor;
    if(uColorShift > 0.01) {
      vec3 hsv = rgb2hsv(color);

      hsv.x = fract(hsv.x + (1.0 - iter) * uColorShift * 0.3);
      color = hsv2rgb(hsv);
    }

    float invd = 1.0 / max(d + dynamicBlur, 0.001);
    pp += (ds - 1.0) * color;
    bloom += clamp(invd, 0.0, 250.0) * color;
  }

  pp *= 1.0 / ITERATIONS;

  vec3 color;

  if(uMode < 0.5) {

    bloom = bloom / (bloom + 2e4);
    color = (-pp + bloom * 3.0 * uBloom) * 1.2;
    color += (randFibo(fragCoord).x - 0.5) / 255.0;
    color = Tonemap(color);
    float alpha = luma(color) * uMix;
    fragColor = vec4(color * uMix, alpha);
  }

  else {

    color = -pp;
    color += (randFibo(fragCoord).x - 0.5) / 255.0;

    float brightness = length(color);
    vec3 direction = brightness > 0.0 ? color / brightness : color;

    float factor = 2.0;
    float mappedBrightness = (brightness * factor) / (1.0 + brightness * factor);
    color = direction * mappedBrightness;

    float gray = dot(color, vec3(0.2, 0.5, 0.1));
    float saturationBoost = 3.0;
    color = mix(vec3(gray), color, saturationBoost);

    color = clamp(color, 0.0, 1.0);

    float alpha = mappedBrightness * LIGHT_MODE_OPACITY;

    float fade = mix(LIGHT_MODE_MIN_FADE, 1.0, smoothstep(0.5, 1.0, uMix));
    fragColor = vec4(color * fade, alpha * fade);
  }
}

void main() {
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  mainImage(color, gl_FragCoord.xy);
  gl_FragColor = color;
}`;

export function AgentAudioVisualizerAura({ state, volume }: { state: AgentState; volume: number }) {
  const { speed, scale, amplitude, frequency, brightness } = useAgentAudioVisualizerAura(state, volume);

  return (
    <div className="lk-aura" data-lk-state={state}>
      <ReactShaderToy
        source={shaderSource}
        uniforms={{ uSpeed: speed, uScale: scale, uFrequency: frequency, uAmplitude: amplitude, uMix: brightness }}
      />
    </div>
  );
}
