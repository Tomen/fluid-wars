// Setup environment for TensorFlow.js native bindings on Windows
// This must run before importing @tensorflow/tfjs-node
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const tfjsDepsLib = path.join(projectRoot, 'node_modules', '@tensorflow', 'tfjs-node', 'deps', 'lib');
// Add TensorFlow DLL path to PATH on Windows
if (process.platform === 'win32') {
    process.env.PATH = `${tfjsDepsLib};${process.env.PATH}`;
}
//# sourceMappingURL=setup-env.js.map