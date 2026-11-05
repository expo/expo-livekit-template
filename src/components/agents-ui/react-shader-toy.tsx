import { useEffect, useRef } from 'react';

const vertexSource = `
attribute vec3 aVertexPosition;
void main() {
  gl_Position = vec4(aVertexPosition, 1.0);
}`;

const vertices = new Float32Array([1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0]);

function createProgram(gl: WebGLRenderingContext, fragmentSource: string) {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create the Aura shader program.');

  const shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]] as const) {
      const shader = gl.createShader(type);
      if (!shader) throw new Error('Could not create the Aura shader.');
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) || 'Could not compile the Aura shader.');
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(program) || 'Could not link the Aura shader.');
    }
    return program;
  } catch (error) {
    gl.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
}

export function ReactShaderToy({ source, uniforms }: {
  source: string;
  uniforms: Record<string, number>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniformsRef = useRef(uniforms);
  useEffect(() => { uniformsRef.current = uniforms; }, [uniforms]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let release: (() => void) | undefined;

    const setupFrame = requestAnimationFrame(() => {
      const gl = canvas.getContext('webgl') ??
        canvas.getContext('experimental-webgl') as WebGLRenderingContext | null;
      if (!gl) {
        console.error('WebGL is unavailable for the Aura visualizer.');
        return;
      }

      let program: WebGLProgram | undefined;
      let buffer: WebGLBuffer | null = null;
      let frame: number | undefined;
      let resizeObserver: ResizeObserver | undefined;
      let visibilityObserver: IntersectionObserver | undefined;

      function resize() {
        if (!gl || !canvas) return;
        const bounds = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
        canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
      }

      release = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        resizeObserver?.disconnect();
        visibilityObserver?.disconnect();
        window.removeEventListener('resize', resize);
        gl.useProgram(null);
        gl.deleteBuffer(buffer);
        if (program) gl.deleteProgram(program);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      };

      try {
        program = createProgram(gl, source);
        gl.useProgram(program);
        buffer = gl.createBuffer();
        if (!buffer) throw new Error('Could not create the Aura vertex buffer.');
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'aVertexPosition');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0);
        gl.clearColor(0, 0, 0, 1);
        gl.clearDepth(1);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);

        const time = gl.getUniformLocation(program, 'iTime');
        const resolution = gl.getUniformLocation(program, 'iResolution');
        const locations = Object.keys(uniformsRef.current).map(
          (name) => [name, gl.getUniformLocation(program!, name)] as const,
        );
        let startTime: number | undefined;
        const draw = (timestamp: number) => {
          startTime ??= timestamp;
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
          gl.uniform1f(time, (timestamp - startTime) / 1000);
          gl.uniform2f(resolution, gl.drawingBufferWidth, gl.drawingBufferHeight);
          for (const [name, location] of locations) {
            gl.uniform1f(location, uniformsRef.current[name]);
          }
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
          frame = requestAnimationFrame(draw);
        };

        resize();
        resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(canvas);
        window.addEventListener('resize', resize);
        visibilityObserver = new IntersectionObserver(([entry]) => {
          if (entry.isIntersecting && frame === undefined) {
            frame = requestAnimationFrame(draw);
          } else if (!entry.isIntersecting && frame !== undefined) {
            cancelAnimationFrame(frame);
            frame = undefined;
          }
        });
        visibilityObserver.observe(canvas);
        frame = requestAnimationFrame(draw);
      } catch (error) {
        release();
        release = undefined;
        console.error('Aura shader error:', error);
      }
    });
    return () => {
      cancelAnimationFrame(setupFrame);
      release?.();
    };
  }, [source]);

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />;
}
