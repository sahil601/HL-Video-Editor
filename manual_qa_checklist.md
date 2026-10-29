# VNest Video Editor — Quality Assurance Checklist & Verification Guide

**Project:** VNest — Professional Desktop Video Editor for Windows  
**Status:** Tested & Fully Verified (21 Automated Tests Passing, Production Bundle Built)  
**Technology Stack:** React 19, TypeScript, Vite, Electron, Bundled FFmpeg & FFprobe (Win32 x64), JSZip, Lucide Icons  

---

## 1. Quick Launch Commands

| Command | Purpose |
| :--- | :--- |
| `npm run desktop` | Launches the Windows native desktop application in Electron with native file dialogs and bundled FFmpeg |
| `npm run desktop:dev` | Launches Vite development server and auto-connects the Electron desktop shell |
| `npm run dev` | Runs the Vite development server on `http://localhost:5173` |
| `npm run preview` | Runs the production preview server on `http://localhost:4173` |
| `npm test` | Runs the complete 21-test automated unit and integration suite in Vitest |
| `npm run build` | Compiles TypeScript and builds the production web bundle |

---

## 2. Automated Test Verification Summary

The automated test suite (`npx vitest run`) executes 21 comprehensive tests covering:

```
 RUN  v5.0.5 C:/Users/sahil/OneDrive/Desktop/vnn

 ✓ src/tests/core.test.ts (12 tests)
   - formats timecode correctly at 30 fps
   - steps frames forward and backward
   - snaps within threshold and ignores points outside threshold
   - returns base values when keyframes are empty
   - interpolates linearly between two keyframes
   - evaluates speed curve presets cleanly (Hero, Bullet, Montage)
   - creates a default valid project
   - splits a clip cleanly at playhead position
   - trims clip boundaries (left in-point, right out-point)
   - moves and duplicates clips
   - creates and extracts a portable .vnest package cleanly
   - constructs valid export arguments and progress parser

 ✓ src/tests/integration.test.ts (9 tests)
   - simulates Creator -> Friend -> Creator collaborative editing transfer (.vnest roundtrip)
   - detects missing media when unbundled assets cannot be located
   - rejects zip files containing path traversal attempts
   - validates schema version compatibility
   - handles a sequence of 10 distinct operations with full undo and redo fidelity
   - rejects splitting at or near clip boundaries (within 50ms)
   - prevents trimming below minimum duration (100ms)
   - prevents moving audio clips onto video tracks
   - generates correct filtergraph for vertical 9:16 Shorts export

 Test Files  2 passed (2)
      Tests  21 passed (21)
```

---

## 3. Manual QA Verification Checklist

### Feature 1: Home Screen & Project Lifecycle
- [x] **New Project Dialog:** Clicking "New Project" opens aspect ratio selection (16:9 Landscape, 9:16 Vertical Shorts/Reels, 1:1 Square, 4:5 Portrait).
- [x] **Project Creation:** Generates a clean 4-track timeline (Text, PIP Overlays, Main Video Track, Audio Track).
- [x] **Recent Projects:** Saves last 10 modified projects to local storage with duration, clip count, and timestamp.
- [x] **Autosave & Crash Recovery:** Autosaves project state every 2 seconds when modifications are detected; "Recover Unsaved Project" restores work after unexpected exit.
- [x] **Demo Project:** Clicking "Quick Demo Project" immediately loads a fully populated multi-track timeline with sample text, keyframes, and video clips for instant testing.

### Feature 2: Media Management & Library
- [x] **Multi-format Support:** Accepts MP4, MOV, MKV, AVI, WebM, MP3, WAV, AAC, PNG, JPG, and WebP files.
- [x] **Drag-and-Drop:** Dragging files onto the library instantly imports and analyzes them.
- [x] **Metadata Badging:** Displays clip resolution, frame rate, and duration on asset cards.
- [x] **Search & Category Filters:** Filters media by All, Video, Audio, Image, and real-time search query.
- [x] **Missing Media & Relinking:** Shows amber alert badge on clips whose source files have moved, with a 1-click "Relink" action.

### Feature 3: Video Preview & Transport Controls
- [x] **Aspect Ratio Fitting:** Centers canvas with letterboxing/pillarboxing corresponding to project aspect ratio.
- [x] **Multi-layer Rendering:** Composites text titles, PIP overlays, and main video according to track order.
- [x] **Real-time Keyframe Interpolation:** Smoothly calculates spatial translation ($X, Y$), scale, rotation, and opacity during playback.
- [x] **Color Adjustments:** Applies real-time brightness, contrast, and saturation filters.
- [x] **Transport Controls:** Play/Pause (Spacebar), Step Backward 1 Frame, Step Forward 1 Frame, Jump to Start, Jump to End.
- [x] **Monospace Timecode:** Displays active position and total project duration (`HH:MM:SS:FF / HH:MM:SS:FF`).

### Feature 4: Multi-Track Timeline & Editing Tools
- [x] **Clip Dragging:** Moving clips updates `startMs` with real-time feedback.
- [x] **Magnetic Snapping:** Snaps to clip boundaries, project start (00:00:00), and current playhead position within threshold.
- [x] **Split Tool (Scissors):** Cuts the selected clip at the exact playhead position, dividing duration and source boundaries accurately while preserving effects.
- [x] **Trim Handles:** Left and right edge handles adjust in/out boundaries with minimum clip duration safeguards (100ms).
- [x] **Duplicate & Delete:** Quick keyboard shortcuts (`Ctrl+D` to duplicate adjacent, `Delete` to remove).
- [x] **Track Controls:** Individual Mute and Lock buttons for each track.
- [x] **Timeline Zoom:** Smooth horizontal scaling from 20 px/sec to 200 px/sec.

### Feature 5: Speed Curves & Keyframe Animation
- [x] **Uniform Speed Slider:** $0.2\times$ to $4.0\times$ playback rate adjustment.
- [x] **Speed Curves:** Preset curve ramps (*Hero, Bullet, Montage, Jump Out*) for cinematic speed ramping.
- [x] **Keyframe Diamonds:** Add keyframe at playhead position, visualize diamond markers directly on clip blocks in timeline.

### Feature 6: Portable `.vnest` Project Sharing (Collaboration)
- [x] **Packaging Action:** Generates a standalone ZIP container containing `manifest.json` and bundled media in `assets/`.
- [x] **Size Estimation:** Calculates total uncompressed media footprint before packaging.
- [x] **Security Scanner:** Blocks path traversal (`../`) and unauthorized root paths during extraction.
- [x] **Round-Trip Collaboration Tested:** Project created on Machine A, edited on Machine B (trimmed, split, text added), and reopened on Machine A with all changes preserved and zero broken links.

### Feature 7: FFmpeg Render & Export Engine
- [x] **Bundled Binaries:** Uses standalone static `ffmpeg.exe` and `ffprobe.exe` (no global installation required).
- [x] **Presets:** 1080p Full HD (16:9), 1080p Vertical (9:16 Shorts), 1:1 Square, 720p Fast Draft, 4K Ultra HD.
- [x] **Filtergraph Synthesis:** Compiles multi-track overlay composition, timing trims, speed adjustment (`setpts`), and audio mixing (`amix`).
- [x] **Progress Tracking:** Parses FFmpeg stderr lines (`time=HH:MM:SS.ms`) into a live percentage progress bar (0% to 100%).
- [x] **Cancellation:** Cleanly terminates the background FFmpeg child process on user cancel.
