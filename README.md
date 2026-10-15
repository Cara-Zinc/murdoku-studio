# Murdoku Studio

**English** | [简体中文](README.zh-CN.md)

Turn PDF logic puzzles into an interactive Murdoku board. Import a page, align its grid, and solve with large letter markers, small candidate letters, and automatic row/column exclusions. Portraits remain on the character cards.

**v1.1.0 · Web UI edition.** Run a small local Python server and use the app in your browser. The current interface is in Simplified Chinese; the documentation is available in English and Chinese. This release provides source code, with no desktop or mobile application package.

![Murdoku Studio Web UI showing the original practice puzzle](docs/images/web-ui.png)

An independent fan project, not affiliated with Murdoku. The included practice case and character illustrations are original. Official puzzle PDFs are not bundled.

## Features

- Import multi-page PDFs, PNG/JPEG/WebP images, official PDF links, or exported JSON saves.
- Explore large maps through a 6×6, 8×8, 10×10, or 12×12 viewport with a draggable mini-map, global coordinates, and per-page lens position and size.
- Review and edit names and clues before import; compare the original page while editing, and recalibrate the board crop later.
- Detect a candidate grid and adjust it by dragging, resizing, or entering exact coordinates.
- Choose a map page and one or more separate roster pages; merge names, clues, and portraits with IDs based on initials.
- Match or manually crop portraits from their own source pages, or upload a separate PNG/JPEG/WebP portrait.
- Place or drag people onto the board. Show automatic black crosses across occupied rows and columns, with adjustable thickness.
- Record sorted candidate letters, exclusions, cell colors, freehand marks, completed clues, and case notes. Placing a person removes their candidate letters across the board; undo restores them.
- Undo/redo, zoom, fullscreen, timer, and pause controls. Collapse the clues panel to make more room for the board.
- Edit rooms, objects, blocked cells, people, and structured rules. Check conflicts, request a unique-solution hint, and identify a suspect using verified rules.
- Fork the current case to explore another hypothesis with independent progress and a fresh undo history.
- Save cases and per-page progress in the browser. Export and restore the current page as JSON, including portraits and source artwork.

## Install and run

### 1. Get the source

Download **Code → Download ZIP** from the repository and extract it, or clone this repository with Git. Open a terminal in the repository root—the directory containing this README and the `murdoku-studio/` folder.

### 2. Install the prerequisites

| Requirement | Purpose |
| --- | --- |
| Python 3.10+ | Local HTTP server; standard library only |
| Poppler: `pdfinfo`, `pdftoppm`, `pdftotext` | PDF rendering and text extraction |
| A modern browser with JavaScript and IndexedDB enabled | Web UI and local saves |
| Node.js 20+ with npm, optional | Development checks and tests only |

There are no pip or npm runtime dependencies and no frontend build step.

**Ubuntu / Debian**

```bash
sudo apt-get update
sudo apt-get install python3 poppler-utils
```

**macOS**, with [Homebrew](https://brew.sh/) installed:

```bash
brew install python poppler
```

Poppler is distributed through the [Homebrew formula](https://formulae.brew.sh/formula/poppler).

**Windows:** use Ubuntu in [WSL](https://learn.microsoft.com/en-us/windows/wsl/install). If WSL is not installed, run this in an administrator PowerShell terminal, restart if prompted, and complete Ubuntu setup:

```powershell
wsl --install -d Ubuntu
```

Then run the Ubuntu commands and the server command below inside the Ubuntu terminal. Open the UI in your Windows browser. Native Windows installation is not covered in this release.

**Optional English OCR:** install Tesseract and its English language data to attempt text extraction from image-only PDFs. On Ubuntu/Debian/WSL use `sudo apt-get install tesseract-ocr tesseract-ocr-eng`; on macOS use `brew install tesseract`. See the [Tesseract installation guide](https://tesseract-ocr.github.io/tessdoc/Installation.html). OCR is a fallback when a PDF has no extracted text, not a guarantee of accurate names or clues; standalone image imports still require manual text entry.

### 3. Start the Web UI

Run from the repository root:

```bash
python3 murdoku-studio/server.py --port 8000
```

Open **http://127.0.0.1:8000**. Keep the terminal running; press `Ctrl+C` to stop the server. The original practice case is available immediately.

Verify PDF support at **http://127.0.0.1:8000/api/health**: the `pdf` field should be `true`. If it is `false`, install Poppler and ensure all three commands are on the server's `PATH`.

To use a different port, pass `--port 8001` and open the matching URL. Browser saves belong to each origin, so changing the host or port starts a separate save library; export your progress before switching.

## First puzzle

1. Click **导入谜题** (Import puzzle) and choose a PDF or image. Each file can be up to 32 MiB; PDFs can have up to 300 pages.
2. Select **地图页** (Map page). Align the selection with the outermost grid lines, then correct the row, column, and person counts. Each count accepts integers from 1 to 64.
3. Under **人物与头像来源页** (People and portrait source pages), select every relevant roster page, up to 64. These may differ from the map page. PDFs with up to 8 pages initially select all pages; longer PDFs initially select only the map page. Remove unrelated pages and review the names and clues before clicking **转换为可玩棋盘** (Convert to playable board).
4. Open **编辑案件 → 人物与规则** (Edit case → People and rules). Choose a portrait source page and **调整头像框** (Adjust portrait), or use **上传头像** (Upload portrait; PNG/JPEG/WebP, up to 8 MiB). Adjust the crop, click **应用头像** (Apply portrait), then **保存案件** (Save case).
5. Select a person and click a cell, or drag their card onto it. Use the other tools to record deductions. Saving happens automatically; use **导出存档** (Export save) for a backup.

Set the counts and source pages before editing the extracted names and clues. Changing the person count rebuilds the roster from cached suggestions; changing source pages or clicking **重新提取文字** (Extract text again) also rebuilds it. Review the roster again after these actions. Use **查看完整 OCR 提取内容** (View full extracted text) to compare with the source.

While the imported PDF remains in the browser save, the portrait source selector can load any page of that PDF, including pages not selected during import. A JSON restore provides only the source images included in the export. For incorrect IDs, use **按姓名修正编号** (Update IDs from names) in the person editor, then save. Latin initials determine IDs; duplicate initials receive extra letters.

For rule-aware checking and hints, first define rooms, objects, and each person's rules in the case editor. Mark a person's clues as fully configured only after reviewing them. You can solve manually without configuring rules.

## Markers and undo

Confirmed placements use large letters on the board and mini-map. Candidates use small letters in a sorted, three-column layout on the board.

| Action | Result |
| --- | --- |
| Place A | Remove candidate A from every cell; retain other candidates. With **行列黑叉** enabled, other empty cells in A's row and column show black crosses. |
| Move A | Recalculate row/column crosses at the new position. Deleted candidate letters do not return. |
| Select A, then click A's occupied cell in placement mode | Remove A's placement without restoring deleted candidates. |
| Erase a cell | Remove its placement, candidates, manual exclusion, and cell color. |
| Undo / redo | Restore / reapply the move, including candidate changes. Elapsed time does not rewind. |

Manual exclusions remain until removed, except that placing a person clears the exclusion at the destination. Automatic row/column crosses only hide remaining notes; those notes reappear when the cross no longer applies. Adjust **黑叉粗细** (Cross thickness) below the board. Older saves with candidates for already-placed people can still show crossed-out candidates.

Use the undo/redo buttons, or press `Ctrl/⌘+Z` to undo and add `Shift` to redo. Saving edits in the case editor clears undo/redo history. JSON exports contain progress but no undo/redo history.

## Try a hypothesis with a case fork

1. Click **复制分支** (Fork case) above the board. The app creates and opens a case named `Original title · 分支 1`, then increments the number for later branches.
2. Continue solving in the branch. It copies the current board, rules, portraits, progress, notes, elapsed time, and lens position and size. It opens in the full-map view. Changes in the branch do not change the original case.
3. Open **案件库** (Case library) to return to the original or another branch. Export each branch separately if you need backups.

Each new branch starts with empty undo/redo history; subsequent moves can be undone normally. For PDF cases, the branch retains the PDF for reading other pages, but does not copy saved progress for other boards in that PDF. Branches are independent local cases: there is no merge or cloud-sharing operation.

## Large maps

Every map opens in the full-map view, including saved cases and page changes. Select **侦探放大镜** (Detective magnifier) to enter the local view, initially 8×8. The circular frame and handle surround a clear, interactive grid; peripheral map imagery has radial distortion and blurred glass edges. Choose a window size, click or drag the blue frame on the mini-map, or enter a global coordinate such as `M13`. Use **✥ 平移** (Pan) or the middle mouse button to drag the board. On the mini-map, arrow keys move one cell; Shift moves by the window size minus two cells.

Global row/column exclusions include people outside the viewport. Letter badges on the coordinate axes identify those people and jump to their location. **定位人物** locates the selected person; **返回上一视野** returns to an earlier view in the current session. Switching views does not create a game undo step. On large boards, clicking the full-board overview opens a local view; it does not place a person.

Placements, candidates, and ink remain attached to global coordinates. Lens position and window size are saved per PDF page and included in JSON exports. Reopening a map or refreshing starts in the full-map view; switching to the magnifier restores its saved position and size. Large PDF imports are rendered again with a 3600-pixel maximum page dimension for clearer artwork. Existing imports retain their original resolution until reimported. People can be searched or filtered to show only unplaced characters. Use **收起 / 展开** (Collapse / Expand) beside **人物与线索** to hide or show the clues panel; the browser remembers this preference.

![Original 24×24 navigation test scene](docs/images/large-map.png)

## Scope and limitations

- Text extraction, grid detection, and portrait matching produce suggestions. For **Preppers**, manually align the **9×9** main board; the current grid detector can choose the wrong region.
- Portrait matching targets rectangular frames above extractable name labels. Scans, unframed artwork, and other layouts may require manual cropping. English OCR is optional for image-only PDFs; there is no automatic gender inference.
- Natural-language clues, room boundaries, and furniture are not automatically converted into verified rules. Hints and accusations use the rules you configured, not an official answer database. Search limits can prevent a conclusive result.
- JSON exports include the current board, linked roster pages, uploaded portrait sources, and progress, not the entire PDF book. Export other boards separately. Editing a case clears its undo history.
- The magnifier applies to the playing board. The room/object editor still shows the whole board for annotation.
- Cases without a designated victim can be saved and solved manually, but murder completion and solver hints remain unavailable. Large-map support does not implement a contest-specific treasure-chest objective.
- This is a local Web UI, not a hosted service. PDF import needs the Python backend; GitHub Pages alone cannot run the complete app. Feature parity with the official online game has not been established.

## Storage and troubleshooting

The server listens on `127.0.0.1` by default. Files are processed by your local Python service; temporary conversion files are removed after processing. Browser saves use IndexedDB. Clearing browser data removes those saves. The app does not upload cases to a cloud service.

| Problem | Action |
| --- | --- |
| Blank page after opening `index.html` | Start the Python server and open its HTTP URL. |
| PDF conversion unavailable | Check `/api/health` and install Poppler. |
| Official PDF link fails | Use a direct `https://murdoku.com/pdf/name.pdf` link (also accepts `www.murdoku.com`), without query parameters or a fragment. For other links, download the file and import it locally. |
| Old cases appear missing | Use the same browser, hostname, and port as before. |
| Port already in use | Choose another `--port`, keeping the separate-save-library behavior in mind. |
| Server runs on a remote machine | Use an SSH tunnel: `ssh -L 8000:127.0.0.1:8000 user@server`, then open the local URL. |

## Development

From the repository root, with Node.js and Poppler installed:

```bash
npm --prefix murdoku-studio run check
npm --prefix murdoku-studio test
python3 murdoku-studio/tests/pdf_fixture.py
```

`check` validates JavaScript syntax and compiles the Python server. `test` runs the Node.js rule, import, navigation, and case-fork tests, plus Python PDF/HTTP tests. The fixture command regenerates the original two-page test PDF. No `npm install` is required.

```text
.github/workflows/        GitHub Actions checks
AGENTS.md                Contributor guidelines
README.md                English introduction and installation
README.zh-CN.md           Chinese introduction and installation
docs/                    User guide and curated screenshots
murdoku-studio/
  server.py              HTTP server and Poppler integration
  public/                Native ES modules, styles, and local assets
  tests/                 Node.js and Python tests; original PDF fixture
```

The CI workflow runs checks and tests on pushes and pull requests. See [Repository Guidelines](AGENTS.md) before contributing. For UI changes, include screenshots and describe your browser checks. Keep personal puzzle files, exported saves, credentials, and generated output out of commits; `.gitignore` excludes these while retaining the original fixture and project assets.

For the prepared source package, see [Upload to GitHub](docs/PUBLISH.md).

See [v1.1.0 merge notes](docs/RELEASE_NOTES.md) for the initial merge checks and save compatibility. This README also covers subsequent updates on `main`.

## Credits

Inspired by [Murdoku](https://murdoku.com/play/) and the [Murdoku Fans Assistant](https://murdoku.fans/zh/murdoku-assistant/). See [third-party notices](THIRD_PARTY_NOTICES.md) and [asset provenance](murdoku-studio/public/assets/README.md) for the bundled font, original illustrations, and their source information.
