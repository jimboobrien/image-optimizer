import sharp from 'sharp';
import { promises as fs } from 'fs';
import { dirname, join, relative, extname } from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob-promise';

const __dirname = dirname(fileURLToPath(import.meta.url));
const inputDir = join(__dirname, 'uploads');
const outputDir = join(__dirname, 'optimized');
const logFile = join(__dirname, 'output.txt');

// WordPress default allowed image formats
const IMAGE_EXTENSIONS = '{jpg,jpeg,jpe,png,gif,webp,bmp,tiff,tif,ico}';

async function logMessage(message) {
    const timestamp = new Date().toISOString();
    const logLine = `${timestamp} - ${message}`;
    console.log(logLine);
    await fs.appendFile(logFile, logLine + '\n');
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

    let pipeline = sharp(inputBuffer);

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
            // Sharp has limited GIF support - converts to single frame
            // For animated GIFs, consider keeping original or using gifsicle
            pipeline = pipeline.gif();
            break;
        case '.tiff':
        case '.tif':
            pipeline = pipeline.tiff({ quality: 75, compression: 'lzw' });
            break;
        case '.bmp':
            // Convert BMP to PNG for better compression
            pipeline = pipeline.png({ quality: 80, compressionLevel: 9 });
            break;
        case '.ico':
            // ICO files - pass through as Sharp doesn't optimize these well
            await fs.writeFile(outputPath, inputBuffer);
            return { inputSize, outputSize: inputSize, skipped: true };
        default:
            await fs.writeFile(outputPath, inputBuffer);
            return { inputSize, outputSize: inputSize, skipped: true };
    }

    const outputBuffer = await pipeline.toBuffer();
    const outputSize = outputBuffer.length;

    // Only save if we achieved compression, otherwise keep original
    if (outputSize < inputSize) {
        await fs.writeFile(outputPath, outputBuffer);
        return { inputSize, outputSize, skipped: false };
    } else {
        await fs.writeFile(outputPath, inputBuffer);
        return { inputSize, outputSize: inputSize, skipped: true };
    }
}

async function optimizeImages() {
    const startTime = Date.now();

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
                await logMessage(
                    `[${i + 1}/${totalFiles}] ${status}: ${relativePath} ` +
                    `(${formatBytes(result.inputSize)} → ${formatBytes(result.outputSize)}, saved ${percent}%)`
                );

                successCount++;
            } catch (error) {
                errorCount++;
                await logMessage(`[${i + 1}/${totalFiles}] ERROR: ${relativePath} - ${error.message}`);
            }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        const totalSaved = totalInputSize - totalOutputSize;
        const totalPercent = totalInputSize > 0 ? ((totalSaved / totalInputSize) * 100).toFixed(1) : 0;

        await logMessage('─'.repeat(60));
        await logMessage('Optimization complete!');
        await logMessage(`  Files processed: ${successCount}/${totalFiles}`);
        await logMessage(`  Errors: ${errorCount}`);
        await logMessage(`  Total input size: ${formatBytes(totalInputSize)}`);
        await logMessage(`  Total output size: ${formatBytes(totalOutputSize)}`);
        await logMessage(`  Total saved: ${formatBytes(totalSaved)} (${totalPercent}%)`);
        await logMessage(`  Duration: ${duration}s`);

    } catch (error) {
        await logMessage(`FATAL ERROR: ${error.message}`);
        console.error('Error optimizing images:', error);
    }
}

optimizeImages();
