# LiveKit Agents UI

The Aura, Wave, Bar, Grid and Radial visualizers are adapted from [LiveKit Agents UI](https://github.com/livekit/components-js/tree/9cfeb0c492669401242ebcd7828a7dc832b1ae59/packages/shadcn). `upstream.json` records the original files, commit and source hashes.

`agent-audio-visualizer.tsx` is an [Expo DOM component](https://docs.expo.dev/guides/dom-components/). It receives the agent state and the native audio levels, and it draws the selected visualizer. Aura and Wave draw LiveKit's fragment shaders on a canvas, and Motion animates the shader values. Bar, Grid and Radial use LiveKit's animation sequences. `visualizers.css` replaces the Tailwind classes of the original components.

`LICENSE` and `NOTICE` retain LiveKit's Apache 2.0 license and attribution. LiveKit designed Aura in partnership with Unicorn Studio. The renderer adapted from ReactShaderToy has a separate [MIT license](LICENSE.react-shader-toy).
