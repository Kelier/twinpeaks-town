# Supplementary state checks

The final scripts/title-landscape-states.mjs run passed normal arrival, entry/disposal, saved portrait choices and forced initial GLB failure/retry. Normal arrival asserts changing camera yaw and a light ramp below full brightness. A screenshot starts headless Chromium composition before the frame assertion; an earlier run without this activation timed out. The actual worker/renderer and model are used throughout; only the failure case injects one HTTP 503.

These checks supplement the scoped two-fix review verdict. They do not measure physical-device frame rate or establish an 850ms end-to-end game load. The VM uses SwiftShader.
