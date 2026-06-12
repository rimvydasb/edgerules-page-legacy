import {defineConfig} from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import react from '@vitejs/plugin-react-swc'

// Update base if your repo name differs
export default defineConfig(() => {
    // Compute simple cache-busting tokens for public WASM/JS at startup
    const root = process.cwd()
    const wasmPath = path.join(root, 'public', 'pkg-web', 'edge_rules_bg.wasm')
    const jsPath = path.join(root, 'public', 'pkg-web', 'edge_rules.js')

    let wasmBust = ''
    let jsBust = ''
    try {
        const s = fs.statSync(wasmPath)
        // Use size and mtime to change when file changes
        wasmBust = `${s.size}-${Number(s.mtimeMs) | 0}`
    } catch {}
    try {
        const s = fs.statSync(jsPath)
        jsBust = `${s.size}-${Number(s.mtimeMs) | 0}`
    } catch {}

    return {
        plugins: [react()],
        base: '/edgerules-page-legacy/',
        define: {
            __ER_WASM_BUST__: JSON.stringify(wasmBust),
            __ER_JS_BUST__: JSON.stringify(jsBust),
        },
    }
})
