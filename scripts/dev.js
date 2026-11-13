import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const apiMode = String(process.env.API_MODE || 'mock').trim().toLowerCase();
const mockPort = Number(process.env.MOCK_API_PORT) || 3001;
const env = {
    ...process.env,
    API_MODE: apiMode,
    MOCK_API_PORT: String(mockPort),
    API_TARGET: process.env.API_TARGET || `http://127.0.0.1:${mockPort}`,
};

const children = [];
let isStopping = false;

function stopAll(exitCode = 0) {
    if (isStopping) return;
    isStopping = true;
    process.exitCode = exitCode;
    for (const child of children) {
        if (!child.killed) child.kill();
    }
}

function start(label, script) {
    const child = spawn(process.execPath, [script], {
        cwd: projectRoot,
        env,
        stdio: 'inherit',
    });
    children.push(child);
    child.on('error', (error) => {
        console.error(`[${label}] Не удалось запустить процесс:`, error.message);
        stopAll(1);
    });
    child.on('exit', (code, signal) => {
        if (isStopping) return;
        const failed = code !== 0;
        console.log(`[${label}] Процесс завершился${signal ? ` (${signal})` : ` с кодом ${code ?? 0}`}.`);
        stopAll(failed ? (code || 1) : 0);
    });
}

if (apiMode === 'mock') {
    start('mock API', 'server.dev.js');
}
start('Vite', path.join('node_modules', 'vite', 'bin', 'vite.js'));

process.once('SIGINT', () => stopAll(0));
process.once('SIGTERM', () => stopAll(0));
