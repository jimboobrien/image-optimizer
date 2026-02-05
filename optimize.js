import sharp from 'sharp';
import { promises as fs } from 'fs';
import { dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob-promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputDir = join(__dirname, 'uploads');
const outputDir = join(__dirname, 'optimized');
const logFile = join(__dirname, 'output.txt');

// WordPress default allowed image formats + HEIC
const IMAGE_EXTENSIONS = '{jpg,jpeg,jpe,png,gif,webp,bmp,tiff,tif,ico,heic,heif}';

async function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - ${message}`;
    console.log(logLine);
    await fs.appendFile(logFile, logLine + '\n');
}

async function logSessionStart() {
    const divider = `
${'='.repeat(80)}
${'='.repeat(80)}
  NEW SESSION: ${new Date().toISOString()}
${'='.repeat(80)}
${'='.repeat(80)}
`;
    console.log(divider);
    await fs.appendFile(logFile, divider + '\n');
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

async function optimizeImage(file, outputPath) {
    const ext = extname(file).toLowerCase();
    const inputBuffer = await fs.readFile(file);
    const inputSize = inputBuffer.length;

    // Handle formats that need special initialization or passthrough
    if (ext === '.ico' || ext === '.bmp') {
        // ICO and BMP - pass through as Sharp doesn't optimize these well
        await fs.writeFile(outputPath, inputBuffer);
        return { inputSize, outputSize: inputSize, skipped: true, outputPath };
    }

    // Use animated option for GIFs to preserve all frames
    const sharpOptions = ext === '.gif' ? { animated: true } : {};
    let pipeline = sharp(inputBuffer, sharpOptions);

    // Apply format-specific optimization
    switch (ext) {
        case '.jpg':
        case '.jpeg':
        case '.jpe':
            pipeline = pipeline.jpeg({ quality: 75, mozjpeg: true });
            break;
        case '.png':
            pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
            break;
        case '.webp':
            pipeline = pipeline.webp({ quality: 75 });
            break;
        case '.gif':
            // Preserve animation with animated: true in sharpOptions above
            pipeline = pipeline.gif();
            break;
        case '.tiff':
        case '.tif':
            pipeline = pipeline.tiff({ quality: 75, compression: 'lzw' });
            break;
        case '.heic':
        case '.heif':
            // Convert HEIC/HEIF to JPEG (Sharp can read but not write HEIC)
            outputPath = outputPath.replace(/\.heic$/i, '.jpg').replace(/\.heif$/i, '.jpg');
            pipeline = pipeline.jpeg({ quality: 75, mozjpeg: true });
            break;
        default:
            await fs.writeFile(outputPath, inputBuffer);
            return { inputSize, outputSize: inputSize, skipped: true, outputPath };
    }

    const outputBuffer = await pipeline.toBuffer();
    const outputSize = outputBuffer.length;

    // Only save if we achieved compression, otherwise keep original
    if (outputSize < inputSize) {
        await fs.writeFile(outputPath, outputBuffer);
        return { inputSize, outputSize, skipped: false, outputPath };
    } else {
        await fs.writeFile(outputPath, inputBuffer);
        return { inputSize, outputSize: inputSize, skipped: true, outputPath };
    }
}

async function optimizeImages() {
    const startTime = Date.now();

    await logSessionStart();
    await logMessage('Starting image optimization...');
    await logMessage(`Input directory: ${inputDir}`);
    await logMessage(`Output directory: ${outputDir}`);

    let totalFiles = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalInputSize = 0;
    let totalOutputSize = 0;

    try {
        const files = await glob(`${inputDir}/**/*.${IMAGE_EXTENSIONS}`, { nocase: true });
        totalFiles = files.length;

        if (totalFiles === 0) {
            await logMessage('No images found to optimize.');
            return;
        }

        await logMessage(`Found ${totalFiles} images to process.`);

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const relativePath = relative(inputDir, file);
            const outputPath = join(outputDir, relativePath);

            try {
                await fs.mkdir(dirname(outputPath), { recursive: true });

                const result = await optimizeImage(file, outputPath);
                totalInputSize += result.inputSize;
                totalOutputSize += result.outputSize;

                const saved = result.inputSize - result.outputSize;
                const percent = result.inputSize > 0 ? ((saved / result.inputSize) * 100).toFixed(1) : 0;

                const status = result.skipped ? 'COPIED' : 'OPTIMIZED';
                const outputRelPath = result.outputPath ? relative(outputDir, result.outputPath) : relativePath;
                const convertedNote = outputRelPath !== relativePath ? ` → ${outputRelPath}` : '';
                await logMessage(
                    `[${i + 1}/${totalFiles}] ${status}: ${relativePath}${convertedNote} ` +
                    `(${formatBytes(result.inputSize)} → ${formatBytes(result.outputSize)}, saved ${percent}%)`
                );

                successCount++;
            } catch (error) {
                errorCount++;
                await logMessage(`[${i + 1}/${totalFiles}] ERROR: ${relativePath} - ${error.message}`);
                await logMessage(`  Stack: ${error.stack}`);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const totalSaved = totalInputSize - totalOutputSize;
        const totalPercent = totalInputSize > 0 ? ((totalSaved / totalInputSize) * 100).toFixed(1) : 0;

        await logMessage('─'.repeat(60));
        await logMessage('OPTIMIZATION COMPLETE');
        await logMessage(`  Files processed: ${successCount}/${totalFiles}`);
        await logMessage(`  Errors: ${errorCount}`);
        await logMessage(`  Total input size: ${formatBytes(totalInputSize)}`);
        await logMessage(`  Total output size: ${formatBytes(totalOutputSize)}`);
        await logMessage(`  Total saved: ${formatBytes(totalSaved)} (${totalPercent}%)`);
        await logMessage(`  Duration: ${duration}s`);
        await logMessage('─'.repeat(60));

    } catch (error) {
        await logMessage(`FATAL ERROR: ${error.message}`);
        await logMessage(`Stack trace: ${error.stack}`);
    }
}

optimizeImages();
