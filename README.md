# VNest — Professional Desktop Video Editor for Windows

**VNest** is a modern, high-performance Windows desktop video editor built with **React 19, TypeScript, Electron, bundled FFmpeg/FFprobe, and JSZip**. Designed around seamless turn-based collaboration and portable projects, VNest allows you and your friends to edit projects on separate Windows computers without missing media files or broken timelines.

---

## 🌟 Key Features

- **Multi-Track Magnetic Timeline:**
  - Dedicated Text, PIP Overlays, Main Video (Magnetic), and Audio tracks.
  - Frame-accurate trimming handles, playhead splitting (scissors), clip duplication, and ripple deletion.
  - Magnetic edge snapping to clip boundaries and playhead.
  - Smooth horizontal zoom from overview to frame-level precision.
- **Portable `.vnest` Project Format:**
  - Open, versioned ZIP container containing canonical `manifest.json`, bundled media assets, and thumbnails.
  - Guaranteed round-trip transfer between separate computers without path dependency.
  - Automated security scanning preventing path traversal attacks (`../`).
  - Missing media detection and one-click relinking.
- **Cinematic Retiming & Speed Curves:**
  - Constant speed multiplier ($0.1\times$ to $8.0\times$).
  - Smooth speed curve ramping presets: *Hero, Bullet, Montage, Jump Out*.
- **Keyframe Animation Engine:**
  - Diamond keyframe markers directly on timeline clips.
  - Dynamic interpolation for Position ($X, Y$), Scale, Rotation, Opacity, and Volume with linear and cubic easing.
- **Real FFmpeg Rendering & Export:**
  - Bundled standalone Windows x64 `ffmpeg.exe` and `ffprobe.exe` (zero global installation required).
  - Presets: 1080p Widescreen (16:9), 1080p Vertical (9:16 Shorts/Reels), 1:1 Square, 720p Fast Draft, 4K Ultra HD.
  - Live progress parsing (0%–100%) and instant process cancellation.
- **Desktop & Offline-First:**
  - Built-in autosave every 2 seconds to local storage.
  - "Recover Unsaved Project" protection against unexpected exits.
  - Zero cloud account or internet connection required for editing.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v20+ (tested on Node v24.11.1 with npm 11.6.2)
- Windows 10 or 11 (x64)

### Running the Application

1. **Launch Native Desktop App (Electron):**
   ```bash
   npm run desktop
   ```
   Or in development mode with live reload:
   ```bash
   npm run desktop:dev
   ```

2. **Run in Web Browser Preview:**
   ```bash
   npm run dev
   ```
   Navigate to `http://localhost:5173`.

3. **Run Automated Test Suite:**
   ```bash
   npm test
   ```
   Executes 21 unit and integration tests verifying timeline boundary safety, keyframes, `.vnest` packaging roundtrips, and FFmpeg filtergraphs.

4. **Build Production Bundle:**
   ```bash
   npm run build
   ```

---

## 📂 Project Architecture

```
vnn/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── manual_qa_checklist.md
├── electron/
│   ├── main.cjs            # Electron native process, file dialogs, FFmpeg child process
│   ├── preload.cjs         # Context-isolated window.vnestNative bridge
│   └── dev.cjs             # Desktop dev launcher
├── src/
│   ├── main.tsx            # React root mount
│   ├── App.tsx             # Main view orchestrator & keyboard shortcuts
│   ├── index.css           # Custom dark theme, timeline handles & custom scrollbars
│   ├── types/
│   │   ├── project.ts      # Project, Track, Clip, Asset, Keyframe definitions
│   │   ├── timeline.ts     # Selection, Snapping, Export presets
│   │   └── native.d.ts     # Electron bridge TypeScript declarations
│   ├── core/
│   │   ├── time.ts         # High-precision integer millisecond engine & timecode
│   │   ├── keyframes.ts    # Multi-property keyframe interpolation & easing
│   │   ├── speedCurves.ts  # Speed curve evaluation & retiming presets
│   │   ├── commands.ts     # Command pattern Undo / Redo history manager
│   │   ├── project.ts      # ProjectManager: split, trim, move, delete, duplicate
│   │   ├── package.ts      # .vnest ZIP packaging, extraction, and security checks
│   │   └── ffmpeg.ts       # FFmpeg export argument builder & progress parser
│   ├── components/
│   │   ├── home/           # HomeScreen with New, Open, Recents, and Demo Project
│   │   ├── header/         # Top Header with project title, aspect ratio, undo/redo
│   │   ├── library/        # Media Library with drag-and-drop, search, and text/FX tabs
│   │   ├── preview/        # Video canvas preview player with transport controls
│   │   ├── properties/     # Properties inspector for transform, speed, keyframes
│   │   ├── timeline/       # Multi-track timeline with clip dragging & trim handles
│   │   └── modals/         # Export, Share .vnest, and Open Shared Project modals
│   └── tests/
│       ├── core.test.ts    # Core mathematical and algorithmic unit tests
│       └── integration.test.ts # Roundtrip collaboration, security, and timing tests
```

---

## 🤝 Portable Project (.vnest) Specification

A `.vnest` project file is an open standard ZIP archive containing:
- `manifest.json`: Canonical JSON describing the timeline tracks, clip timings, keyframes, transitions, and relative asset paths.
- `assets/`: Embedded media files (when packaged with media enabled) guaranteeing 100% portable opening across separate computers.
- `vnest_meta.json`: Checksum and package metadata for integrity verification.

### Security Guarantees:
- Rejects any entries containing `..` or absolute drive roots (`C:\`) to eliminate path traversal vulnerabilities.
- Safe extraction quotas preventing decompression bombs.
- Zero execution of arbitrary code or commands from imported projects.

---

## 📜 License
MIT License. Bundled FFmpeg static binaries are distributed in accordance with FFmpeg LGPL/GPL licensing terms.
