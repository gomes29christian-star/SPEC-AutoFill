import fs from 'fs';
import path from 'path';

// Minimal 1x1 Amber/Dark pixel valid PNG base64
const icon16Base64 = "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAZElEQVR4nGP8z8BQDwAE/gP5/4EYB0j0H4kNE2P8j43Nhikg4n+sijFI0fwfkqMvGAqA/0RZhCwA438SBtG1mF3jF+j/f6Ji4gH+80024Q3A5D9M78Kwf8TFAm4W4Q2LhQhD1AIA39B+q1k06j0AAAAASUVORK5CYII=";
const icon48Base64 = "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAXUlEQVR42u3QMQ0AAAgEQcD/084CPgwktAU2N3024ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4ODg4PgGBm9b8Q69cOIAAAAASUVORK5CYII=";
const icon128Base64 = "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAAaElEQVR42u3BAQ0AAADCoPdPbQ8HFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwDca1gABG3xLrwAAAABJRU5ErkJggg==";

const dir = path.resolve('extension/icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon-16.png'), Buffer.from(icon16Base64, 'base64'));
fs.writeFileSync(path.join(dir, 'icon-48.png'), Buffer.from(icon48Base64, 'base64'));
fs.writeFileSync(path.join(dir, 'icon-128.png'), Buffer.from(icon128Base64, 'base64'));

console.log('Icons generated successfully.');
