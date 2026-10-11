// 统一的后期着色器：胶片颗粒、暗角、色差，以及全部帧缓冲转场（幕布、Z 字擦除、雪花、光圈、负片、淡出）。
export const PostShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: [1, 1] },
    uGrain: { value: 0.06 },
    uVignette: { value: 0.9 },
    uChroma: { value: 0.0015 },
    uFade: { value: 0 },
    uCurtain: { value: 0 },
    uCurtainColor: { value: [0.32, 0.008, 0.01] },
    uZig: { value: 0 },
    uStatic: { value: 0 },
    uIris: { value: 0 },
    uInvert: { value: 0 },
    uWarp: { value: 0 },
    uTilt: { value: 0 },
    uTiltCenter: { value: 0.5 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uChroma, uFade, uCurtain, uZig, uStatic, uIris, uInvert, uWarp, uTilt, uTiltCenter;
    uniform vec2 uRes;
    uniform vec3 uCurtainColor;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      // 梦境扭曲（缓慢的波纹）
      uv += uWarp * 0.012 * vec2(sin(uv.y * 14.0 + uTime * 1.3), cos(uv.x * 11.0 + uTime));
      vec2 c = uv - 0.5;
      float ca = uChroma * (1.0 + 2.0 * uWarp) * length(c) * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + c * ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - c * ca).b;

      // 移轴微缩：画面上下带模糊、中间清晰，并略提饱和度，让场景读作桌面模型
      if (uTilt > 0.0) {
        float band = smoothstep(0.08, 0.42, abs(uv.y - uTiltCenter)) * uTilt;
        if (band > 0.002) {
          vec3 acc = vec3(0.0); float wsum = 0.0;
          vec2 px = 1.0 / uRes;
          for (int i = 0; i < 12; i++) {
            float a = float(i) * 2.39996;
            float rr = sqrt(float(i) + 0.5) / 3.6;
            vec2 o = vec2(cos(a), sin(a)) * rr * band * 9.0 * px * (uRes.y / 900.0);
            acc += texture2D(tDiffuse, uv + o).rgb; wsum += 1.0;
          }
          col = mix(col, acc / wsum, min(1.0, band * 1.4));
        }
        float l = dot(col, vec3(0.299, 0.587, 0.114));
        col = mix(vec3(l), col, 1.0 + 0.22 * uTilt);
      }

      // 雪花
      float n = hash(floor(uv * uRes / 2.0) + fract(uTime * 37.0) * 91.0);
      float scan = 0.85 + 0.15 * sin(uv.y * uRes.y * 1.2 + uTime * 40.0);
      col = mix(col, vec3(n * scan * 0.6), uStatic);

      // Z 字擦除（自下而上，被覆盖区域显示黑白 Z 字纹）
      if (uZig > 0.0) {
        float zz = abs(fract(uv.x * 7.0) - 0.5) * 0.18;
        float edge = uZig * 1.25 - 0.1;
        if (uv.y - zz < edge) {
          float stripe = step(0.5, fract((uv.y + abs(fract(uv.x * 9.0) - 0.5) * 0.25) * 18.0));
          col = vec3(stripe * 0.85);
        }
      }

      // 红色幕布从两侧合拢
      if (uCurtain > 0.0) {
        float hw = uCurtain * 0.52;
        float wave = 0.015 * sin(uv.y * 9.0 + uTime * 0.8) * uCurtain;
        float d = min(uv.x, 1.0 - uv.x);
        if (d < hw + wave) {
          float x = uv.x < 0.5 ? uv.x : 1.0 - uv.x;
          float folds = 0.55 + 0.45 * sin(x * 140.0 + sin(uv.y * 3.0) * 2.0);
          float lip = smoothstep(0.0, 0.03, hw + wave - d);
          col = uCurtainColor * (0.35 + folds) * (0.6 + 0.4 * lip) * (0.7 + 0.3 * uv.y);
        }
      }

      // 光圈收缩
      float ar = uRes.x / uRes.y;
      float r = length(vec2(c.x * ar, c.y));
      col *= 1.0 - smoothstep((1.0 - uIris) * 1.05 - 0.02, (1.0 - uIris) * 1.05, r);

      col = mix(col, vec3(1.0) - col, uInvert);

      // 暗角与颗粒
      col *= mix(1.0, smoothstep(1.05, 0.25, length(c) * 1.2), uVignette);
      col += (hash(uv * uRes + uTime * 60.0) - 0.5) * uGrain;
      col *= 1.0 - uFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
