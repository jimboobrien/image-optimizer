// Import necessary libraries and modules
import imagemin from 'imagemin';
import mozjpeg from 'imagemin-mozjpeg';
import pngquant from 'imagemin-pngquant';
import svgo from 'imagemin-svgo';
import giflossy from 'imagemin-giflossy';
import { promises as fs } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';
import glob from 'glob-promise'; // Use glob-promise for async glob handling

// Calculate the directory name from the URL of the current module
const __dirname = dirname(fileURLToPath(import.meta.url));
const inputDir = join(__dirname, 'uploads'); // Full path to the directory containing the images to be optimized
const outputDir = join(__dirname, 'optimized'); // Full path to the directory where optimized images will be saved
const logFile = join(__dirname, 'output.txt'); // Log file path

async function logMessage(message) {
    // Append messages to the log file
    await fs.appendFile(logFile, `${new Date().toISOString()} - ${message}\n`);
}

async function optimizeImages() {
    try {
        const files = await glob(`${inputDir}/**/*.{jpg,png,svg,gif}`);
        for (const file of files) {
            const outputPath = join(outputDir, relative(inputDir, file));
            await fs.mkdir(dirname(outputPath), { recursive: true }); // Ensure the directory exists
            await imagemin([file], {
                destination: dirname(outputPath),
                plugins: [
                    mozjpeg({ quality: 75 }),
                    pngquant({ quality: [0.6, 0.8] }),
                    svgo({
                        plugins: [{ removeViewBox: false }]
                    }),
                    giflossy({ lossy: 80 })
                ]
            });
            await logMessage(`SUCCESS: Optimized ${file}`);
        }
    } catch (error) {
        await logMessage(`ERROR: ${error.message}`);
        console.error('Error optimizing images', error);
    }
}

// Run the optimization function
optimizeImages();
