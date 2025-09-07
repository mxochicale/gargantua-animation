const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  console.error("WebGL2 not supported");
}

const vertexShaderSource = `#version 300 es
            in vec4 a_position;
            void main() {
                gl_Position = a_position;
            }`;

const fragmentShaderSource = `#version 300 es
            precision highp float;
            uniform vec2 iResolution;
            uniform float iTime;
            uniform vec2 iMouse;
            uniform vec2 iMouseDelta;
            uniform float iClick;
            out vec4 fragColor;

            #define S smoothstep
            #define L length

            float hash(vec2 p) {
                float h = dot(p, vec2(127.1, 311.7));
                return fract(sin(h) * 43758.5453123);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                           mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
            }

            float fbm(vec2 p) {
                float sum = 0.0;
                float amp = 0.5;
                float freq = 1.0;
                mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
                for(int i = 0; i < 6; i++) {
                    sum += amp * noise(p * freq);
                    amp *= 0.5;
                    freq *= 2.0;
                    p = rot * p;
                }
                return sum;
            }

            vec3 palette(float t) {
                vec3 a = vec3(0.5, 0.5, 0.5);
                vec3 b = vec3(0.5, 0.5, 0.5);
                vec3 c = vec3(1.0, 1.0, 1.0);
                vec3 d = vec3(0.263, 0.416, 0.557);
                return a + b * cos(6.28318 * (c * t + d));
            }

            void mainImage(out vec4 o, in vec2 i) {
                vec2 uv = (i - 0.5 * iResolution.xy) / iResolution.y;
                vec2 m = (iMouse - 0.5 * iResolution.xy) / iResolution.y;
                
                float d = L(uv - m);
                float mouseMoveStrength = L(iMouseDelta) * 0.0015;
                float t = iTime * 0.05;
                
                vec2 q = vec2(fbm(uv + t), fbm(uv + vec2(1.0)));
                vec2 r = vec2(fbm(uv + 4.0 * q + vec2(1.7, 9.2) + 0.15 * t),
                              fbm(uv + 4.0 * q + vec2(8.3, 2.8) + 0.126 * t));
                float f = fbm(uv + 4.0 * r);
                
                // Smooth mouse influence
                float mouseInfluence = S(1.0, 0.0, d) * 0.2;
                f += mouseMoveStrength * fbm(uv * 2.0 + m) * mouseInfluence;
                
                // Add subtle swirl
                float angle = atan(uv.y, uv.x);
                float radius = length(uv);
                f += 0.05 * sin(angle * 3.0 + t + fbm(uv * 2.0));
                
                vec3 col = palette(f + d * 0.04 + t);
                
                col += palette(mouseMoveStrength * 0.4 + d * 0.05) * 0.02;
                
                col *= S(0.4, 0.05, d);
                
                float clickWave = S(1.0, 0.0, abs(d - mod(iTime - iClick, 2.0)) * 0.5) * exp(-(iTime - iClick) * 0.7);
                col += vec3(1.0, 0.5, 0.2) * clickWave * 0.5;
                
                col *= 1.0 + 0.03 * sin(iTime * 0.8 + f * 5.0);
                
                o = vec4(col, 1.0);
            }

            void main() {
                mainImage(fragColor, gl_FragCoord.xy);
            }`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(
  gl,
  gl.FRAGMENT_SHADER,
  fragmentShaderSource
);
const program = createProgram(gl, vertexShader, fragmentShader);

const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
const positionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(
  gl.ARRAY_BUFFER,
  new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
  gl.STATIC_DRAW
);

const resolutionUniformLocation = gl.getUniformLocation(program, "iResolution");
const timeUniformLocation = gl.getUniformLocation(program, "iTime");
const mouseUniformLocation = gl.getUniformLocation(program, "iMouse");
const mouseDeltaUniformLocation = gl.getUniformLocation(program, "iMouseDelta");
const clickUniformLocation = gl.getUniformLocation(program, "iClick");

let mouseX = 0,
  mouseY = 0;
let lastMouseX = 0,
  lastMouseY = 0;
let clickTime = 0;

// Smoothed mouse movement
let smoothMouseX = 0,
  smoothMouseY = 0;
const smoothFactor = 0.15;

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// Create an overlay div to capture mouse events
const overlay = document.createElement("div");
overlay.style.position = "fixed";
overlay.style.top = "0";
overlay.style.left = "0";
overlay.style.width = "100%";
overlay.style.height = "100%";
overlay.style.zIndex = "1";
overlay.style.pointerEvents = "auto";
document.body.appendChild(overlay);

overlay.addEventListener("mousemove", (e) => {
  lastMouseX = mouseX;
  lastMouseY = mouseY;
  mouseX = e.clientX;
  mouseY = e.clientY;
});

overlay.addEventListener("mousedown", () => {
  clickTime = performance.now() * 0.001; // Convert to seconds
});

function render(time) {
  time *= 0.001; // Convert to seconds

  // Smooth mouse movement
  smoothMouseX += (mouseX - smoothMouseX) * smoothFactor;
  smoothMouseY += (mouseY - smoothMouseY) * smoothFactor;

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.useProgram(program);
  gl.enableVertexAttribArray(positionAttributeLocation);
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.vertexAttribPointer(positionAttributeLocation, 2, gl.FLOAT, false, 0, 0);

  gl.uniform2f(resolutionUniformLocation, canvas.width, canvas.height);
  gl.uniform1f(timeUniformLocation, time);
  gl.uniform2f(
    mouseUniformLocation,
    smoothMouseX,
    canvas.height - smoothMouseY
  );
  gl.uniform2f(
    mouseDeltaUniformLocation,
    smoothMouseX - lastMouseX,
    lastMouseY - smoothMouseY
  );
  gl.uniform1f(clickUniformLocation, clickTime);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
