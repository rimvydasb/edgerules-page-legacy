const defaultBase = 'http://localhost:5173/edgerules-page-legacy/';
const rawBase = process.env["EDGE_RULES_BASE_URL"] ?? defaultBase;
const baseUrl = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

const makeUrl = (path: string): string => new URL(path, baseUrl).toString();

type FetchOptions = Parameters<typeof fetch>[1];
type FetchResponse = Awaited<ReturnType<typeof fetch>>;

async function fetchWithMessage(url: string, options?: FetchOptions): Promise<FetchResponse> {
    try {
        return await fetch(url, options);
    } catch (error) {
        const message = (error as Error)?.message ?? String(error);
        throw new Error(`Failed to fetch ${url}. Ensure the dev server is running at ${baseUrl}. Original error: ${message}`);
    }
}

const requestTimeout = 15_000;

describe('EdgeRules dev server smoke test', () => {
    test(
        'serves index shell with root container',
        async () => {
            const res = await fetchWithMessage(baseUrl, { method: 'GET', redirect: 'manual' });
            expect(res.ok).toBe(true);
            const html = await res.text();
            expect(html).toContain('<div id="root"></div>');
            expect(html).toContain('<script type="module" src="/edgerules-page-legacy/src/main.tsx"></script>');
        },
        requestTimeout,
    );

    test(
        'exposes app source with expected heading text',
        async () => {
            const appUrl = makeUrl('src/App.tsx');
            const res = await fetchWithMessage(appUrl);
            expect(res.ok).toBe(true);
            const body = await res.text();
            expect(body).toContain('EdgeRules Language');
            expect(body).toContain('Reference and Interactive Playground');
        },
        requestTimeout,
    );

    test(
        'makes WASM bundle available for the loader',
        async () => {
            const wasmUrl = makeUrl('pkg-web/edge_rules_bg.wasm');
            const res = await fetchWithMessage(wasmUrl);
            expect(res.ok).toBe(true);
            const bytes = await res.arrayBuffer();
            expect(bytes.byteLength).toBeGreaterThan(0);
        },
        requestTimeout,
    );
});
