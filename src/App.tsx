import React, {useEffect, useMemo, useRef, useState} from 'react'
import ReactSimpleCodeEditor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import LZString from 'lz-string'
// Using custom bright theme styles in src/styles.css
import Footer from './components/Footer'
import Description from './components/Description'
import Playground from './components/Playground'
import type {BaseExample, Example} from './examples/types'
import {fetchAndParseBaseExamples, fetchMarkdown, formatWasmResult, parseBaseExamplesMarkdown} from './utils/parseBaseExamples'
import {CONTENT_PAGES} from './content/pages'

// Some bundlers/dep-optimizers double-wrap this package's CJS default export
// (`{ __esModule: true, default: Component }`); normalize to the component.
const Editor = (ReactSimpleCodeEditor as unknown as { default?: typeof ReactSimpleCodeEditor }).default
    ?? ReactSimpleCodeEditor

export default function App() {
    const [lang] = useState<'javascript'>('javascript')
    const [wasmReady, setWasmReady] = useState(false)
    const [wasmError, setWasmError] = useState<string | null>(null)
    const wasmRef = useRef<EdgeRulesMod | null>(null)
    const [examples, setExamples] = useState<Example[]>([])
    const [activeIndex, setActiveIndex] = useState<number>(0)
    const [playgroundInput, setPlaygroundInput] = useState<string>('')
    const [initialPlaygroundCode, setInitialPlaygroundCode] = useState<string>('')
    const [playgroundOutput, setPlaygroundOutput] = useState<string>('')
    const [playgroundError, setPlaygroundError] = useState<string | null>(null)

    const activeItem = CONTENT_PAGES[activeIndex]
    const isPlayground = activeItem?.type === 'playground'

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        const hParam = params.get('h')
        if (hParam) {
            try {
                const decompressed = LZString.decompressFromEncodedURIComponent(hParam)
                if (decompressed) {
                    setPlaygroundInput(decompressed)
                    setInitialPlaygroundCode(decompressed)
                    const playgroundIndex = CONTENT_PAGES.findIndex(p => p.type === 'playground')
                    if (playgroundIndex !== -1) {
                        setActiveIndex(playgroundIndex)
                    }
                }
            } catch (e) {
                console.error('Failed to decompress URL param', e)
            }
        }
    }, [])

    const highlight = useMemo<((codeStr: string) => string)>(() => (codeStr: string) => {
        try {
            const grammar = Prism.languages['javascript'] as Prism.Grammar
            return Prism.highlight(codeStr, grammar, 'javascript')
        } catch {
            return codeStr
        }
    }, [])

    // Access WASM module exposed via index.html module script as window.__edgeRules
    useEffect(() => {
        let cancelled = false

        const attach = async (mod: EdgeRulesMod) => {
            const ok = await mod.ready
            if (!ok) throw new Error('EdgeRules WASM failed to initialize')
            if (!cancelled) {
                wasmRef.current = mod
                setWasmReady(true)
            }
        }

        const onReady = () => {
            if (!cancelled && window.__edgeRules) {
                attach(window.__edgeRules).catch((e: unknown) => setWasmError((e as Error)?.message || String(e)))
            }
        }
        const onError = (e: CustomEvent<{ error?: Error }>) => {
            if (!cancelled) setWasmError(e?.detail?.error?.message || 'WASM loader error')
        }

        if (window.__edgeRules) {
            attach(window.__edgeRules).catch((e: unknown) => setWasmError((e as Error)?.message || String(e)))
        } else {
            window.addEventListener('edgerules-ready', onReady as EventListener, {once: true})
            window.addEventListener('edgerules-error', onError as EventListener, {once: true})
        }

        return () => {
            cancelled = true
            window.removeEventListener('edgerules-ready', onReady as EventListener)
            window.removeEventListener('edgerules-error', onError as EventListener)
        }
    }, [])

    const evaluateWithMod = (mod: EdgeRulesMod, input: string): { output: string, isError: boolean } => {
        const trimmed = input.trim()
        if (trimmed.length === 0) {
            return { output: '', isError: false }
        }

        try {
            const result = mod.DecisionEngine.evaluate(input)
            return { output: formatWasmResult(result), isError: false }
        } catch (err: unknown) {
            if (typeof err === 'object' && err !== null && !(err instanceof Error)) {
                const anyObj = err as any;
                if (anyObj.stage === 'linking') {
                    // Create a shallow copy to avoid mutating the original error object if it's reused
                    const errorObj = { ...anyObj };
                    delete errorObj.message;
                    return { output: formatWasmResult(errorObj), isError: true }
                }
                return { output: formatWasmResult(anyObj), isError: true }
            }
            return { output: formatWasmResult(err), isError: true }
        }
    }

    // Helper to compute outputs for current examples
    const computeOutputs = (items: Example[]): Example[] => {
        const mod = wasmRef.current
        if (!mod) return items

        return items.map((ex): Example => {
            if (ex.input.trim().length === 0) {
                return { ...ex, output: '', isError: false }
            }
            const { output, isError } = evaluateWithMod(mod, ex.input)
            return { ...ex, output, isError }
        })
    }

    // Recompute outputs when WASM becomes ready
    useEffect(() => {
        if (!wasmReady || !wasmRef.current) return
        setExamples(prev => computeOutputs(prev))
    }, [wasmReady])

    // Load selected page markdown and seed examples; recompute when WASM ready
    useEffect(() => {
        let cancelled = false

        const loadPage = async (): Promise<void> => {
            const item = activeItem
            if (!item) return

            if (!('contentReference' in item)) {
                if (!cancelled) setExamples([])
                return
            }

            const ref = item.contentReference
            try {
                const seed: BaseExample[] = await fetchAndParseBaseExamples(ref)
                const ex: Example[] = seed.map((e: BaseExample): Example => ({
                    ...e,
                    input: e.codeExample,
                    output: '',
                    isError: false,
                }))
                if (!cancelled) {
                    setExamples(() => {
                        const next = ex
                        return wasmRef.current ? computeOutputs(next) : next
                    })
                }
            } catch {
                if (!cancelled) setExamples([])
            }
        }

        void loadPage()
        return () => {
            cancelled = true
        }
    }, [activeItem, wasmReady])

    const onChangeExample = (id: string, value: string) => {
        const mod = wasmRef.current
        if (!mod) {
            setExamples(prev => prev.map(ex => ex.id === id ? {...ex, input: value} : ex))
            return
        }

        setExamples(prev => prev.map(ex => {
            if (ex.id !== id) return ex
            const next: Example = { ...ex, input: value }
            if (value.trim().length === 0) {
                return { ...next, output: '', isError: false }
            }
            const { output, isError } = evaluateWithMod(mod, value)
            return { ...next, output, isError }
        }))
    }

    const evaluatePlaygroundInput = (value: string) => {
        const mod = wasmRef.current
        if (!mod) return

        const { output, isError } = evaluateWithMod(mod, value)
        setPlaygroundOutput(output)
        setPlaygroundError(isError ? output : null)
    }

    const onChangePlayground = (value: string) => {
        setPlaygroundInput(value)
        evaluatePlaygroundInput(value)
    }

    useEffect(() => {
        if (!isPlayground) return

        // If we already have content (from URL or previous edit), don't overwrite with default
        if (playgroundInput.trim().length > 0 || initialPlaygroundCode.length > 0) return

        let cancelled = false

        const loadPlayground = async () => {
            try {
                const markdown = await fetchMarkdown('docs/PLAYGROUND.md')
                if (cancelled) return
                const blocks = parseBaseExamplesMarkdown(markdown)
                const firstBlock = blocks.find((block) => block.codeExample.trim().length > 0)
                if (!firstBlock) {
                    throw new Error('Playground example missing in PLAYGROUND.md')
                }
                const nextValue = firstBlock.codeExample
                setPlaygroundInput(nextValue)
                setInitialPlaygroundCode(nextValue)
                setPlaygroundOutput('')
                if (nextValue.trim() === '') {
                    setPlaygroundError(null)
                    return
                }

                const mod = wasmRef.current
                if (!mod) {
                    setPlaygroundError(null)
                    return
                }

                const { output, isError } = evaluateWithMod(mod, nextValue)
                setPlaygroundOutput(output)
                setPlaygroundError(isError ? output : null)
            } catch (err) {
                if (cancelled) return
                const message = (err as Error)?.message ?? String(err)
                setPlaygroundInput('')
                setPlaygroundOutput('')
                setPlaygroundError(message)
            }
        }

        loadPlayground().catch((err: unknown) => {
            if (cancelled) return
            const message = (err as Error)?.message ?? String(err)
            setPlaygroundError(message)
        })

        return () => {
            cancelled = true
        }
    }, [isPlayground, activeItem])

    useEffect(() => {
        if (!isPlayground || !wasmReady) return
        evaluatePlaygroundInput(playgroundInput)
    }, [isPlayground, wasmReady])

    return (
        <div className="page bright">
            <header className="header bright">
                <h1>EdgeRules Language</h1>
                <p>Reference and Interactive Playground</p>
                <nav className="header__nav" aria-label="Content menu">
                    <ul className="header__menu">
                        {CONTENT_PAGES.map((item, idx) => (
                            <li key={`${item.menuTitle}-${idx}`} className={idx === activeIndex ? 'active' : ''}>
                                <button
                                    type="button"
                                    className={`header__menu-btn${item.type === 'playground' ? ' header__menu-btn--playground' : ''}`}
                                    aria-current={idx === activeIndex ? 'page' : undefined}
                                    onClick={() => setActiveIndex(idx)}
                                >
                                    {item.menuTitle}
                                </button>
                            </li>
                        ))}
                    </ul>
                </nav>
            </header>
            <div className="container">
                {isPlayground && (
                    <div className="playground">
                        <Playground
                            value={playgroundInput}
                            onChange={onChangePlayground}
                            onReset={() => onChangePlayground(initialPlaygroundCode)}
                            output={playgroundOutput}
                            error={playgroundError}
                            wasmReady={wasmReady}
                            wasmError={wasmError}
                        />
                    </div>
                )}
                {!isPlayground && (
                    <div className="container__content">
                        {!wasmReady && !wasmError && <p>Loading WebAssembly…</p>}
                        {wasmError && <p style={{color: '#b91c1c'}}>WASM load error: {wasmError}</p>}
                        {examples.map(ex => {
                            const hasCode = ex.codeExample.trim().length > 0
                            return (
                                <React.Fragment key={ex.id}>
                                    <div className="example-row-header">
                                        <h3 className="example-title"># {ex.title}</h3>
                                    </div>

                                    <section className={`example-row${hasCode ? '' : ' example-row--text-only'}`}>
                                        <Description text={ex.description} id={ex.id}/>

                                        {hasCode && (
                                            <>
                                                <div className="example-col example-editor">
                                                    <Editor
                                                        value={ex.input}
                                                        onValueChange={(v) => onChangeExample(ex.id, v)}
                                                        highlight={highlight}
                                                        padding={16}
                                                        textareaId={`editor-${ex.id}`}
                                                        className="container__editor editor"
                                                        preClassName={`language-${lang} no-wrap`}
                                                        textareaClassName="no-wrap"
                                                        style={{
                                                            fontFamily: '"Fira Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                                            fontSize: 12,
                                                            overflowX: 'auto',
                                                        }}
                                                    />
                                                </div>

                                                <div className="example-col example-arrow" aria-hidden="true">
                                                    <div className="arrow-glyph">↦</div>
                                                </div>

                                                <div className="example-col example-output">
                                                    <Editor
                                                        value={ex.output}
                                                        onValueChange={() => {}}
                                                        highlight={highlight}
                                                        padding={16}
                                                        readOnly
                                                        className="container__editor editor readonly"
                                                        preClassName={`language-${lang} no-wrap`}
                                                        textareaClassName="no-wrap"
                                                        style={{
                                                            fontFamily: '"Fira Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                                                            fontSize: 12,
                                                            overflowX: 'auto',
                                                        }}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </section>
                                </React.Fragment>
                            )
                        })}
                    </div>

                )}
            </div>
            <Footer/>
        </div>
    )
}
