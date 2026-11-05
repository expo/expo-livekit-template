# LiveKit Agents UI

The Aura, Grid and Bar components are adapted from [LiveKit Agents UI](https://github.com/livekit/components-js/tree/9cfeb0c492669401242ebcd7828a7dc832b1ae59/packages/shadcn). `upstream.json` records the original files, commit and source hashes.

The Expo DOM view receives the agent state and native audio levels. Aura uses LiveKit’s fragment shader and Motion animations. Its canvas renderer uses the shader’s time, resolution and animated float uniforms, resizes with the view and pauses off screen. Grid and Bars use LiveKit’s animation sequences and volume calculations. Scoped CSS reproduces the full-size visualizers and the smaller settings preview. The native screen supplies the dark theme and white foreground.

`LICENSE` and `NOTICE` retain LiveKit’s Apache 2.0 license and attribution. LiveKit designed Aura in partnership with Unicorn Studio. The renderer adapted from ReactShaderToy has a separate [MIT license](LICENSE.react-shader-toy).
