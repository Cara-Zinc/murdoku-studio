# v1.1.0 Web UI — merge notes / 合并说明

## Unreleased / 未发布

- Placing a person crosses out their pencil candidates elsewhere. Cells with only placed candidates receive a cross; mixed cells retain other candidates. Undo/redo derives these marks from placements without deleting notes or manual exclusions.
- 放置人物后划除其他格中的同名候选；全部候选均已放置时整格打叉，多候选格保留其他人。撤销与重做同步恢复，原笔记和手动排除独立保留。

- Select the map page independently from one or more roster pages. Portrait crops retain their page ownership, including in standalone JSON saves.
- Upload separate PNG/JPEG/WebP portraits (up to 8 MiB), crop them, and keep the source image for later adjustments.
- 地图与人物支持分页识别，可合并多个人物页；手动裁剪会打开对应来源页，来源图随 JSON 存档保存。
- 支持单独上传 PNG/JPEG/WebP 头像（最大 8 MiB）、取消或调整裁剪，并保留上传原图。

- Fix dense-map grid detection: fit fractional spacing, verify all four borders, and refine alignment against internal lines at source resolution.
- Draw import/editor guide lines without repeated raster tiles; explicitly size board rows and columns.
- Use **Edit case → Re-detect alignment** to repair the crop of an existing case with matching dimensions. Placements and notes are preserved; saving an edit clears undo history as before. Existing crops are not changed automatically.
- 修复大地图网格检测：拟合小数格距、校验四条边界，并按原图内部网格精确校准。
- 导入和编辑预览改用独立矢量网格线，游戏棋盘明确等分行列。
- 旧案件可在「编辑案件 → 重新检测对齐」中修复裁切。行列数必须一致；保留人物位置与笔记。保存编辑仍会清空撤销记录，旧裁切范围不会自动修改。


## Included / 已合并

The UI and PDF changes from the supplied `murdoku-studio-1.0.0.zip` are integrated: editable import previews, original-page references in the editor, board recropping, full page text, optional English OCR, and drafts without a designated victim. Existing portrait crops, initial-based IDs, automatic crosses, and save files remain supported.

已合并搭档 ZIP 中的导入预览编辑、原图对照、棋盘重新裁剪、完整原文、可选英文 OCR，以及不指定受害者的草稿。保留头像裁剪、姓名首字母编号、自动黑叉和旧版存档支持。

## Large maps / 大地图

- Boards with a dimension of 16 or more default to an 8×8 viewport. Window sizes: 6, 8, 10, and 12.
- Mini-map dragging, coordinate jumps, person location, camera history, panning, and fullscreen navigation.
- Global placements, candidates, ink, exclusions, and keyboard coordinates; offscreen occupant badges on axes.
- Independent saved views for each PDF page and JSON export; 3600-pixel rendering for newly imported large PDF boards.
- Searchable people list and an unplaced-person filter.

大题默认使用局部观察窗口，配合小地图拖动、坐标定位、人物定位、历史视野与平移。放置、候选、手绘和排除始终按全图计算。支持全屏导航、逐页视野保存、高清 PDF 与人物筛选。

## Verification / 验证

Syntax checks and the Node.js/Python test suites pass locally. Browser checks cover the partner import/editor flow, a synthetic original 24×24 scene, global coordinates, offscreen exclusions, undo/redo, ink, camera movement, refresh and JSON recovery, multi-page PDF view recovery, portrait editing, desktop fullscreen, and 390px mobile layout. A real original fixture PDF was converted at 3600 pixels.

本地语法检查及 Node.js/Python 测试通过。浏览器已验证搭档的导入/编辑流程、原创 24×24 场景、全局坐标、窗口外排除、撤销重做、手绘、视野移动、刷新及 JSON 恢复、多页 PDF 独立视野、头像编辑、桌面全屏与 390px 手机布局。原创 PDF 样本已实际完成 3600 像素转换。

The optional OCR branch is covered with simulated Tesseract responses; OCR accuracy on real contest scans is not established. Contest-specific treasure objectives are not implemented. GitHub Actions is configured, but a remote run requires uploading the repository.

可选 OCR 分支使用模拟 Tesseract 响应测试，尚未验证真实大赛扫描件的识别准确率。未实现大赛专用宝箱判定。GitHub Actions 已配置，上传仓库后才能运行远程检查。

## Save compatibility / 存档兼容

The puzzle format stays at version 1. A separate optional `view` field records display mode, size, row, and column. Older saves receive a default view. Navigation does not enter the game undo stack. Camera history is session-only. Existing low-resolution page images remain usable and require reimporting the PDF to improve image quality.

棋盘格式仍为 version 1，另用可选的 `view` 字段记录显示模式、大小和起始行列。旧存档自动选择默认视野。浏览操作不进入解谜撤销栈，视野历史仅在本次会话内保留。已有低分辨率图片仍可使用，提升清晰度需重新导入 PDF。
