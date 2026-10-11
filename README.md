# 双峰 · 小小梦魇（可玩 · 人偶剧场）

`index.html` 是一部 2.5D 人偶剧场式的恐怖短篇（致敬《双峰》，画风参考《小小梦魇》，人物为釉面陶瓷人偶）。旧版点击式放映页保留在 `tv.html`。

- **十一幕，按电视剧播出顺序**（幕卡上标着集数）：湖岸「裹在塑料布里」(S1E1) → 双 R 餐馆 (S1E2) → 警长办公室 (S1E3) → 红房间之梦「二十五年后」(S1E3) → 木头女士的小屋 (S1E4) → 帕默家 (S1E5) → 大北方旅馆 315 房·巨人 (S1E8→S2E1) → 公路酒吧「又发生了」(S2E7) → 拘留室·洒水器 (S2E9) → 幽林·格拉斯顿伯里林地 (S2E22) → 红房间 (S2E22)。每一幕都是一个封闭、全暗的景箱，四周有丝绒台口框。
- **对话与选择**：靠近人物按 E 交谈，用 ←→ 或 W/S 选择，回车确认。选择会决定拿到哪些线索（共 9 条），并记入剧情树。
- **三种结局**：镜中人「安妮还好吗？」、晨光「梦醒」、低语「二十五年后见」，取决于线索数量、奥黛丽的信任和你在红房间的选择。按 Esc 暂停可以查看「节目单」，里面有十一幕的路线（附集数）和已得线索。
- **双语**：中文 / English，可在标题页、幕间或导览里切换，选择会被记住。代码里文案写作 `T('中文','English')`，界面文字放在 `src/game/i18n.js`，新增语言就在那里扩展。
- **两本蜡笔导览**：「大卫·林奇涂鸦本」16 页，「与火同行涂鸦本」11 页。贴纸、胶带、印章、蜡笔儿童画，都由代码在 canvas 上实时绘制。每张贴纸都标了来源编号，还没核实的条目标为「待复核」；电影涉及的创伤内容做了克制处理。入口在标题页和幕间，代码见 `src/game/guide.js`、`guide-data.js`、`guide.css`。
- **背景音乐**：使用用户提供的 `Twin Peaks - Julee Cruise - Falling.mp3`，原文件存放在 `public/audio/falling.mp3`。每次进入默认关闭，在首页或暂停菜单点击开关后循环播放。浏览器拒绝播放时显示重试，不自动抢播。切换关卡不重启音乐，切到后台暂停。背景音乐与环境音效独立控制，不叠加旧合成配乐。
- **27 个人物**：库珀、劳拉、BOB、奥黛丽、杜鲁门、木头女士、巨人、来自另一个地方的人、利兰、萨拉、唐娜、詹姆斯、雪莉、诺玛、鲍比、本·霍恩、露西、安迪、霍克、歌手、乔西、皮特、戈登、阿尔伯特、独臂人、温德姆、娜丁。
- **操作**：A/D 移动 · W/S 进出景深 · 空格跳（贴着台面跳会自动攀爬）· Shift 跑 · E 互动／交谈／按住抓取 · F 手电 · Esc 幕间与节目单 · M 静音。
- **存档**：每 1.5 秒和关闭页面时自动保存，内容包括所在幕、位置、谜题进度和剧情树；刷新后在标题页按回车继续。
- **代码**：`src/game/`，其中 main 负责流程、对话、存档、语言和台口框，story 是播出顺序、线索和结局，levels / levels2 / levels3 是十一幕，bgm 是背景音乐开关，guide 是导览，另有 gfx、audio、player、world。
- **人物**：`blender-materials/figurines/figurine.py` 加 `cast_more.py`，每个人偶由各部件体素融合成一整块封闭曲面，不会穿模。用 `build_all.sh` 批量建模，再由 `cast-mpfb/export_puppet.py` 加动作导出到 `public/game/cast/*.glb`。
- **房间**：`blender-materials/game-sets/build_set.py --set=<shore|diner|station|cabin|palmer|hotel|roadhouse|cell|forest|redroom>` 导出 `public/game/sets/*.glb`。
- **自动化**：`scripts/game-mechanics.mjs`（谜题）、`game-ai.mjs`（BOB 与结局）、`game-save.mjs`（刷新续玩）、`game-story.mjs <幕…>`（各幕截图与对话）、`game-shore.mjs`（湖岸与拘留室谜题）、`game-ui.mjs`（旧版语言与导览检查）、`guide-capture.mjs`（导览逐页截图）。需要开发服务器在 5191 端口运行。

---

# 双峰 · 梦境档案

Three.js 第一人称原创调查。玩法集中在双峰镇，包含五位经典 NPC、线索物件、收音机调谐、时序推理、两种收尾；手绘人物关系和林奇人生时间线可以独立阅读。

## 运行

```sh
npm install
npm run dev -- --port 5191
```

```sh
npm run build
npm test
node scripts/journey-e2e.mjs   # 层级、贴纸、推理与两种结局
```

E2E 默认使用正在运行的 `http://localhost:5191/` 和 `/usr/local/bin/chromium`。`npm run e2e` 已切换到新版流程。

## 层层递进的微缩景观

山谷（00）→ 小镇底座（01）→ 掀开屋顶的建筑剖面（02）→ 1:1 眼平漫游（03）。每层都是嵌在上一层里的真实模型，镜头连续飞入；底部胶带标签可随时返回上一层。旅馆、森林、红房间随线索逐层解锁。

## 贴纸手账

点击场景里发光的小物件、与人物交谈、找到线索会撕下贴纸（共 20 张）。贴纸手账页可拖拽、旋转、撕下；杜鲁门的推理改为把三张线索贴纸贴到时间线上。

## 操作

WASD / 方向键移动与环视；鼠标拖拽环视；双击锁定鼠标；Tab 转向下一物件；E 调查；L 聆听；J 手记；M 静音；Esc 菜单。触屏左侧拖动移动、右侧拖动环视，底部提供寻找物件与调查按钮。调查手记也提供地点跳转。

## 设计与交付

- `DESIGN.md`：设计系统与已实现/目标边界。
- `src/design/tokens.json`：规范参数；`public/design-tokens.json` 为可下载副本。
- `docs/redesign/verification.md`：验证与限制。
- `docs/redesign/img2threejs-intake.md`：输入适配评估。
- `docs/redesign/asset-provenance.md`：生成肖像来源。

配乐为原创 WebAudio 合成，参考双峰原声带音色与氛围，不包含原版录音。NPC 为由写实炭笔人物画膨胀生成的立体浮雕人偶（真实体积、受光、投影、呼吸、转身与转头看向玩家），不是骨骼绑定的扫描级演员模型。非官方致敬项目。

## 第七幕灯绳修复（2026-10-11）

修复大北方旅馆拉灯绳后因月光变量作用域错误导致剧情中断、角色锁定的问题。读档时会恢复未完成剧情的灯绳交互；已完成剧情保持门开启。使用原浏览器和原站点地址刷新后继续即可，无需清除存档。

回归验证（开发服务器默认 5191 端口）：`node scripts/game-hotel-regression.mjs`，覆盖中断存档、拉绳剧情、完成后读档以及走出旅馆进入第八幕。

## 暗红微缩剧场与手机操作（2026-10-11）

只保留暗红 3D 剧场。贴纸 Canvas 游戏、主题切换及旧偏好已移除，原有剧情、线索、存档与第七幕灯绳修复保留。导览、语言与操作说明收在「档案与设置」。

- 首页：真实 Blender Cycles 渲染的微缩红房，完整黑色景箱、红丝绒帘、黑白折线地板、黑皮椅、土星灯和金属落地灯。首页现在实时加载 Blender 导出的 GLB；拖动或方向键转动视角，点击落地灯或「开灯 / 关灯」切换真实灯光，L 切灯，Home 复位。带轻微自动与指针视角运动，遵守减少动态效果偏好。原离线渲染图仅作为加载与错误后备。进入游戏时释放首页 WebGL 场景。
- Blender：`blender-materials/title-redroom/title-redroom.blend` 可直接打开渲染；`render_title.py` 使用随包的 `miniature-production/twin-peaks-miniatures.blend` 重建标题镜头与灯光。
- 手机横竖屏：左侧四方向控制景深与左右移动；右侧跑、灯、跳和互动。拖动物件时同时按住互动和方向；取消触摸或失焦会释放输入。右上角暂停。
- 实现：`src/game/theme.css`、`touch-controls.js`、`bgm.js`；首页模型为 `public/themes/red-room-interactive.glb`，交互见 `title-room.js`，后备图为 `red-room-miniature.webp`。`export_title.py` 可从 .blend 重新导出 GLB。
- 检查：`node scripts/redroom-review.mjs`、`node scripts/redroom-touch-test.mjs`、`node scripts/game-hotel-regression.mjs`，开发服务器默认 5191。使用 Chromium 手机视口仿真，未覆盖所有实体手机的性能差异。
