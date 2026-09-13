/* ============================================================
   aurora.js — 极光背景

   来源：React Bits「Aurora」(reactbits.dev/backgrounds/aurora)
   跟 scanner.js 同一套搬运方式：GLSL 原样复制，外壳用原生 WebGL2
   重写，不引入 React / ogl，整站依然零依赖。

   这个组件自带 uLightMode 分支，是给浅色底设计的：
   输出 mix(白, 归一化后的色相, coverage)，不透明。
   所以不会踩 Scanner 那个「白色峰值在白底上等于隐形」的坑。

   注意 lightMode 里 chroma 会被峰值通道归一化 —— 传很淡的颜色
   之所以还能保持淡，是因为它最亮的通道本来就接近 1。传饱和色
   会被拉到全饱和，那就会跟 h1 的 .accent 撞。色板规矩见 index.html。

   强度用 CSS opacity 控制（data-opacity），不改着色器。
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.querySelector("canvas.aurora");
  if (!canvas) return;

  var gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false, // 全屏片元着色器，MSAA 没有意义
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return; // 老浏览器：静默退场，.wash 的光斑还在

  var d = canvas.dataset;
  function num(k, fallback) {
    var v = parseFloat(d[k]);
    return isNaN(v) ? fallback : v;
  }
  function bool(k, fallback) {
    if (d[k] === undefined) return fallback;
    return d[k] !== "false" && d[k] !== "0";
  }
  function rgb(hex, fallback) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    if (!m) return fallback;
    return [
      parseInt(m[1], 16) / 255,
      parseInt(m[2], 16) / 255,
      parseInt(m[3], 16) / 255,
    ];
  }

  var VERT =
    "#version 300 es\n" +
    "in vec2 position;\n" +
    "void main() { gl_Position = vec4(position, 0.0, 1.0); }\n";

  /* ---- 以下 GLSL 与组件完全一致 ---- */
  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "",
    "uniform float uTime;",
    "uniform float uAmplitude;",
    "uniform vec3 uColorStops[3];",
    "uniform vec2 uResolution;",
    "uniform float uBlend;",
    "uniform float uLightMode;",
    "",
    "out vec4 fragColor;",
    "",
    "vec3 permute(vec3 x) {",
    "  return mod(((x * 34.0) + 1.0) * x, 289.0);",
    "}",
    "",
    "float snoise(vec2 v){",
    "  const vec4 C = vec4(",
    "      0.211324865405187, 0.366025403784439,",
    "      -0.577350269189626, 0.024390243902439",
    "  );",
    "  vec2 i  = floor(v + dot(v, C.yy));",
    "  vec2 x0 = v - i + dot(i, C.xx);",
    "  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);",
    "  vec4 x12 = x0.xyxy + C.xxzz;",
    "  x12.xy -= i1;",
    "  i = mod(i, 289.0);",
    "",
    "  vec3 p = permute(",
    "      permute(i.y + vec3(0.0, i1.y, 1.0))",
    "    + i.x + vec3(0.0, i1.x, 1.0)",
    "  );",
    "",
    "  vec3 m = max(",
    "      0.5 - vec3(",
    "          dot(x0, x0),",
    "          dot(x12.xy, x12.xy),",
    "          dot(x12.zw, x12.zw)",
    "      ), ",
    "      0.0",
    "  );",
    "  m = m * m;",
    "  m = m * m;",
    "",
    "  vec3 x = 2.0 * fract(p * C.www) - 1.0;",
    "  vec3 h = abs(x) - 0.5;",
    "  vec3 ox = floor(x + 0.5);",
    "  vec3 a0 = x - ox;",
    "  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);",
    "",
    "  vec3 g;",
    "  g.x  = a0.x  * x0.x  + h.x  * x0.y;",
    "  g.yz = a0.yz * x12.xz + h.yz * x12.yw;",
    "  return 130.0 * dot(m, g);",
    "}",
    "",
    "struct ColorStop {",
    "  vec3 color;",
    "  float position;",
    "};",
    "",
    "#define COLOR_RAMP(colors, factor, finalColor) {              \\",
    "  int index = 0;                                            \\",
    "  for (int i = 0; i < 2; i++) {                               \\",
    "     ColorStop currentColor = colors[i];                    \\",
    "     bool isInBetween = currentColor.position <= factor;    \\",
    "     index = int(mix(float(index), float(i), float(isInBetween))); \\",
    "  }                                                         \\",
    "  ColorStop currentColor = colors[index];                   \\",
    "  ColorStop nextColor = colors[index + 1];                  \\",
    "  float range = nextColor.position - currentColor.position; \\",
    "  float lerpFactor = (factor - currentColor.position) / range; \\",
    "  finalColor = mix(currentColor.color, nextColor.color, lerpFactor); \\",
    "}",
    "",
    "void main() {",
    "  vec2 uv = gl_FragCoord.xy / uResolution;",
    "  ",
    "  ColorStop colors[3];",
    "  colors[0] = ColorStop(uColorStops[0], 0.0);",
    "  colors[1] = ColorStop(uColorStops[1], 0.5);",
    "  colors[2] = ColorStop(uColorStops[2], 1.0);",
    "  ",
    "  vec3 rampColor;",
    "  COLOR_RAMP(colors, uv.x, rampColor);",
    "  ",
    "  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25)) * 0.5 * uAmplitude;",
    "  height = exp(height);",
    "  height = (uv.y * 2.0 - height + 0.2);",
    "  float intensity = 0.6 * height;",
    "  ",
    "  float midPoint = 0.20;",
    "  float auroraAlpha = smoothstep(midPoint - uBlend * 0.5, midPoint + uBlend * 0.5, intensity);",
    "  ",
    "  vec3 auroraColor = intensity * rampColor;",
    "  ",
    "  if (uLightMode > 0.5) {",
    "    float energy = clamp(max(intensity, 0.0), 0.0, 1.0);",
    "    float coverage = clamp(auroraAlpha * (0.55 + 0.45 * energy), 0.0, 0.86);",
    "    vec3 chroma = pow(clamp(rampColor, 0.0, 1.0), vec3(1.2));",
    "    float chromaPeak = max(chroma.r, max(chroma.g, chroma.b));",
    "    chroma /= max(chromaPeak, 0.0001);",
    "    fragColor = vec4(mix(vec3(1.0), chroma, min(coverage * 1.08, 0.94)), 1.0);",
    "  } else {",
    "    fragColor = vec4(auroraColor * auroraAlpha, auroraAlpha);",
    "  }",
    "}",
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("aurora:", gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("aurora:", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 预乘，跟组件一致

  var vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  var vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  var posLoc = gl.getAttribLocation(prog, "position");
  gl.enableVertexAttribArray(posLoc);
  gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ["uTime", "uAmplitude", "uResolution", "uBlend", "uLightMode"].forEach(
    function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    },
  );
  // vec3 数组：拿 [0] 的位置，一次传 9 个 float
  U.uColorStops = gl.getUniformLocation(prog, "uColorStops[0]");

  var SPEED = num("speed", 1);
  gl.uniform1f(U.uAmplitude, num("amplitude", 1));
  gl.uniform1f(U.uBlend, num("blend", 0.5));
  gl.uniform1f(U.uLightMode, bool("lightMode", true) ? 1 : 0);

  var stops = []
    .concat(rgb(d.color1, [0.32, 0.15, 1.0]))
    .concat(rgb(d.color2, [0.49, 1.0, 0.4]))
    .concat(rgb(d.color3, [0.32, 0.15, 1.0]));
  gl.uniform3fv(U.uColorStops, new Float32Array(stops));

  if (d.opacity) canvas.style.opacity = d.opacity;

  var DPR_CAP = num("dprCap", 1.5);
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.uResolution, w, h);
  }

  function draw(sec) {
    gl.uniform1f(U.uTime, sec * SPEED);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  resize();
  new ResizeObserver(resize).observe(canvas);

  var still = window.matchMedia("(prefers-reduced-motion: reduce)");
  var raf = 0;
  var t0 = performance.now();

  function loop(t) {
    resize();
    draw((t - t0) * 0.001);
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (!raf && !document.hidden && !still.matches) {
      raf = requestAnimationFrame(loop);
    }
  }
  function stop() {
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  document.addEventListener("visibilitychange", function () {
    document.hidden ? stop() : start();
  });
  still.addEventListener("change", function () {
    if (still.matches) {
      stop();
      draw(0);
    } else {
      start();
    }
  });

  if (still.matches)
    draw(0); // 只画一帧静止的极光
  else start();
})();
