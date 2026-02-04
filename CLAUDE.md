# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Batch image optimization tool for WordPress media libraries. Processes images from `uploads/` directory and outputs optimized versions to `optimized/` while preserving directory structure.

## Commands

```bash
npm install          # Install dependencies
npm run start        # Run image optimization (executes optimize.js)
```

No test or lint commands are configured.

## Architecture

Single-file Node.js application using ES Modules.

**optimize.js** - Main entry point containing:
- `logMessage(message)` - Async function that appends timestamped logs to `output.txt`
- `optimizeImages()` - Main function that finds images via glob, processes each through imagemin plugins, and preserves directory structure in output

**Image Processing Pipeline:**
- JPEGs: mozjpeg at 75% quality
- PNGs: pngquant at 60-80% quality range
- SVGs: svgo (preserves viewBox)
- GIFs: giflossy at 80% lossy compression

**Directory Structure:**
- `uploads/` - Input: place source images here (e.g., from wp-content/uploads)
- `optimized/` - Output: optimized images with preserved directory structure
- `output.txt` - Execution log with timestamps
