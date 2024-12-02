// Import necessary libraries and modules
import imagemin from 'imagemin';
import mozjpeg from 'imagemin-mozjpeg';
import pngquant from 'imagemin-pngquant';
import svgo from 'imagemin-svgo';
import giflossy from 'imagemin-giflossy';
import { promises as fs } from 'fs'; // Use fs promises for async operations
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Calculate the directory name from the URL of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));
const inputDir = './uploads'; // Directory containing the images to be optimized
const outputDir = './optimized'; // Directory where optimized images will be saved
const logFile = join(__dirname, 'output.txt'); // Log file path

async function logMessage(message) {
    // Append messages to the log file
    await fs.appendFile(logFile, `${new Date().toISOString()} - ${message}\n`);
}

// Use imagemin to optimize images
imagemin([`${inputDir}/**/*.{jpg,png,svg,gif,ico}`], {
    destination: outputDir,
    plugins: [
        mozjpeg({ quality: 75 }),
        pngquant({ quality: [0.6, 0.8] }),
        svgo({
            plugins: [{ removeViewBox: false }]
        }),
        giflossy({ lossy: 80 })
    ]
}).then(files => {
    files.forEach(file => {
        logMessage(`SUCCESS: Optimized ${file.sourcePath}`).catch(console.error);
    });
}).catch(async error => {
    await logMessage(`ERROR: ${error.message}`);
    console.error('Error optimizing images', error);
});
