/* ============================================================
   scanner.js — 扫描信号场背景

   来源：React Bits「Scanner」(reactbits.dev/backgrounds/scanner)
   原版是 React + ogl。这里只搬了那段 GLSL —— 一个字没改 ——
   外壳用原生 WebGL2 重写，所以整站依然是零依赖、双击就能开。

   ogl 的 Renderer / Program / Mesh / Triangle 四个类，
   在这里就是：createProgram + 一个全屏三角形的 vertex buffer。

   参数写在 <canvas> 的 data-* 上，改数值不用碰 JS。
   没有 WebGL2 的浏览器 → 什么都不画，页面照常（渐进增强）。
   prefers-reduced-motion → 只画一帧静止的场，不进 rAF。
   ============================================================ */
(function () {
  "use strict";

  var canvas = document.querySelector("canvas.scanner");
  if (!canvas) return;

  var gl = canvas.getContext("webgl2", {
    alpha: true,
    premultipliedAlpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference: "low-power",
  });
  if (!gl) return; // 老浏览器：静默退场，.wash 的光斑还在

  /* ---------- 参数：读 data-*，缺省值取自组件默认值 ---------- */
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
  var DIR = { vertical: 0, horizontal: 1, diagonal: 2 };

  /* ---------- 着色器（GLSL 原样搬运） ---------- */
  var VERT =
    "#version 300 es\n" +
    "in vec2 position;\n" +
    "void main() { gl_Position = vec4(position, 0.0, 1.0); }\n";

  var FRAG = [
    "#version 300 es",
    "precision highp float;",
    "uniform vec2 iResolution;",
    "uniform float iTime;",
    "uniform float uSpeed;",
    "uniform float uSweepSpeed;",
    "uniform float uSweepWidth;",
    "uniform float uSweepFalloff;",
    "uniform float uScale;",
    "uniform float uFrequency;",
    "uniform float uRipple;",
    "uniform float uBandDensity;",
    "uniform float uLineSharpness;",
    "uniform float uGlow;",
    "uniform float uColorSpread;",
    "uniform float uBrightness;",
    "uniform float uContrast;",
    "uniform float uSoftness;",
    "uniform float uVignette;",
    "uniform float uOpacity;",
    "uniform float uScanline;",
    "uniform float uGrain;",
    "uniform float uGrainIntensity;",
    "uniform float uDirection;",
    "uniform vec2 uMouse;",
    "uniform float uMouseEnabled;",
    "uniform float uMouseRadius;",
    "uniform float uMouseStrength;",
    "uniform float uMouseActive;",
    "uniform vec3 uColor1;",
    "uniform vec3 uColor2;",
    "uniform vec3 uColor3;",
    "out vec4 fragColor;",
    "",
    "const float TAU = 6.2831853;",
    "",
    "float signalField(vec2 p, float t) {",
    "  float w = sin(p.x * 1.3 + t * 0.7);",
    "  w += sin(p.y * 1.7 - t * 0.52) * 0.8;",
    "  w += sin((p.x + p.y) * 0.9 + t * 0.91) * 0.6;",
    "  w += sin((p.x - p.y) * 1.53 - t * 0.63) * 0.42;",
    "  return w * 0.35;",
    "}",
    "",
    "vec3 palette(float f) {",
    "  f = clamp(f, 0.0, 1.0);",
    "  f = pow(f, uContrast);",
    "  vec3 c = mix(uColor1, uColor2, smoothstep(0.08, 0.6, f));",
    "  return mix(c, uColor3, smoothstep(0.68, 1.0, f));",
    "}",
    "",
    "float scanBand(float x, float aa, float sharp) {",
    "  float v = mix(0.5, 0.5 + 0.5 * cos(x * TAU), aa);",
    "  return pow(v, sharp);",
    "}",
    "",
    "void main() {",
    "  float aspect = iResolution.x / iResolution.y;",
    "  vec2 uv0 = (gl_FragCoord.xy * 2.0 - iResolution.xy) / iResolution.y;",
    "  vec2 p = uv0 / max(uScale, 0.001);",
    "",
    "  float t = iTime * uSpeed;",
    "",
    "  float mouseBoost = 0.0;",
    "  if (uMouseEnabled > 0.5) {",
    "    vec2 mUv = vec2((uMouse.x * 2.0 - 1.0) * aspect, uMouse.y * 2.0 - 1.0);",
    "    vec2 md = uv0 - mUv;",
    "    float r = max(uMouseRadius, 0.001);",
    "    mouseBoost = exp(-dot(md, md) / (r * r)) * uMouseStrength * uMouseActive;",
    "  }",
    "",
    "  float axis;",
    "  if (uDirection < 0.5) axis = p.y;",
    "  else if (uDirection < 1.5) axis = p.x;",
    "  else axis = (p.x + p.y) * 0.70710678;",
    "",
    "  float sig = signalField(p * uFrequency, t);",
    "  float coord = axis + sig * uRipple;",
    "",
    "  float phase = coord / max(uSweepWidth, 0.05) - t * uSweepSpeed;",
    "  float sweep = pow(0.5 + 0.5 * cos(phase * TAU), max(uSweepFalloff, 0.1));",
    "",
    "  float lc = coord * uBandDensity;",
    "  float aa = 1.0 / (1.0 + uSoftness * fwidth(lc) * 3.0);",
    "  aa = clamp(aa * (1.0 + mouseBoost * 0.6), 0.0, 1.0);",
    "",
    "  float bodyBase = clamp(0.5 + 0.5 * sig, 0.0, 1.0);",
    "  float body = bodyBase * bodyBase * uGlow * sweep;",
    "",
    "  float sharp = max(uLineSharpness, 0.1);",
    "  float split = uColorSpread * 0.16;",
    "  float fr = clamp(scanBand(lc + split, aa, sharp) * sweep + body, 0.0, 1.0);",
    "  float fg = clamp(scanBand(lc, aa, sharp) * sweep + body, 0.0, 1.0);",
    "  float fb = clamp(scanBand(lc - split, aa, sharp) * sweep + body, 0.0, 1.0);",
    "",
    "  vec3 col = vec3(palette(fr).r, palette(fg).g, palette(fb).b);",
    "",
    "  float inten = (fr + fg + fb) * 0.3333333 * uBrightness;",
    "  inten *= 1.0 + mouseBoost * 0.9;",
    "",
    "  if (uScanline > 0.5) {",
    "    inten *= 1.0 - 0.18 * (0.5 + 0.5 * cos(gl_FragCoord.y * 1.7));",
    "  }",
    "",
    "  if (uGrain > 0.5) {",
    "    float g = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233)) + iTime) * 43758.5453);",
    "    inten += (g - 0.5) * uGrainIntensity;",
    "  }",
    "",
    "  inten *= clamp(1.0 - uVignette * smoothstep(0.55, 1.65, length(uv0)), 0.0, 1.0);",
    "  inten = clamp(inten, 0.0, 1.0);",
    "",
    "  float a = clamp(inten * uOpacity, 0.0, 1.0);",
    "  fragColor = vec4(clamp(col, 0.0, 1.0) * a, a);",
    "}",
  ].join("\n");

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn("scanner:", gl.getShaderInfoLog(s));
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
    console.warn("scanner:", gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  /* 全屏三角形：比两个三角形拼的矩形少一次对角线上的重复着色 */
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
  [
    "iResolution",
    "iTime",
    "uSpeed",
    "uSweepSpeed",
    "uSweepWidth",
    "uSweepFalloff",
    "uScale",
    "uFrequency",
    "uRipple",
    "uBandDensity",
    "uLineSharpness",
    "uGlow",
    "uColorSpread",
    "uBrightness",
    "uContrast",
    "uSoftness",
    "uVignette",
    "uOpacity",
    "uScanline",
    "uGrain",
    "uGrainIntensity",
    "uDirection",
    "uMouse",
    "uMouseEnabled",
    "uMouseRadius",
    "uMouseStrength",
    "uMouseActive",
    "uColor1",
    "uColor2",
    "uColor3",
  ].forEach(function (n) {
    U[n] = gl.getUniformLocation(prog, n);
  });

  /* ---------- 一次性 uniform ---------- */
  var mouseEnabled = bool("mouse", true);
  gl.uniform1f(U.uSpeed, num("speed", 0.5));
  gl.uniform1f(U.uSweepSpeed, num("sweepSpeed", 0.25));
  gl.uniform1f(U.uSweepWidth, num("sweepWidth", 1.6));
  gl.uniform1f(U.uSweepFalloff, num("sweepFalloff", 6));
  gl.uniform1f(U.uScale, num("scale", 1.5));
  gl.uniform1f(U.uFrequency, num("frequency", 2));
  gl.uniform1f(U.uRipple, num("ripple", 0.22));
  gl.uniform1f(U.uBandDensity, num("bandDensity", 11));
  gl.uniform1f(U.uLineSharpness, num("lineSharpness", 5.5));
  gl.uniform1f(U.uGlow, num("glow", 0.22));
  gl.uniform1f(U.uColorSpread, num("colorSpread", 0.7));
  gl.uniform1f(U.uBrightness, num("brightness", 1));
  gl.uniform1f(U.uContrast, num("contrast", 1.15));
  gl.uniform1f(U.uSoftness, num("softness", 1.4));
  gl.uniform1f(U.uVignette, num("vignette", 0.45));
  gl.uniform1f(U.uOpacity, num("opacity", 1));
  gl.uniform1f(U.uScanline, bool("scanline", true) ? 1 : 0);
  gl.uniform1f(U.uGrain, bool("grain", true) ? 1 : 0);
  gl.uniform1f(U.uGrainIntensity, num("grainIntensity", 0.05));
  gl.uniform1f(U.uDirection, DIR[d.direction] || 0);
  gl.uniform1f(U.uMouseEnabled, mouseEnabled ? 1 : 0);
  gl.uniform1f(U.uMouseRadius, num("mouseRadius", 0.5));
  gl.uniform1f(U.uMouseStrength, num("mouseStrength", 0.5));
  gl.uniform3fv(U.uColor1, rgb(d.color1, [0.32, 0.15, 1.0]));
  gl.uniform3fv(U.uColor2, rgb(d.color2, [1.0, 0.62, 0.99]));
  gl.uniform3fv(U.uColor3, rgb(d.color3, [1.0, 1.0, 1.0]));

  /* ---------- 尺寸 ---------- */
  var DPR_CAP = num("dprCap", 1.5); // 组件原版是 2；压到 1.5，手机上省电
  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
    var w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
    var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width === w && canvas.height === h) return;
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
    gl.uniform2f(U.iResolution, w, h);
  }

  /* ---------- 指针：画布是 pointer-events:none，所以监听 window ---------- */
  var mx = 0.5,
    my = 0.5,
    tx = 0.5,
    ty = 0.5,
    act = 0,
    tact = 0;
  if (mouseEnabled) {
    window.addEventListener(
      "pointermove",
      function (e) {
        if (e.pointerType !== "mouse") return; // 触屏不追，省得一点就闪
        tx = e.clientX / window.innerWidth;
        ty = 1 - e.clientY / window.innerHeight;
        tact = 1;
      },
      { passive: true },
    );
    document.addEventListener("pointerleave", function () {
      tact = 0;
    });
  }

  /* ---------- 绘制 ---------- */
  function draw(timeSec) {
    gl.uniform1f(U.iTime, timeSec);
    mx += 0.05 * (tx - mx);
    my += 0.05 * (ty - my);
    act += 0.05 * (tact - act);
    gl.uniform2f(U.uMouse, mx, my);
    gl.uniform1f(U.uMouseActive, act);
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
    draw(0); // 只画一帧静止的场
  else start();
})();
