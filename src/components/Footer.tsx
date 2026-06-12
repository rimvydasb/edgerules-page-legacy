import React from 'react'

import { CONTENT_PAGES } from '../content/pages'
import { getBaseUrl, isMarkdownContentMenuItem } from '../utils/parseBaseExamples'

export default function Footer() {
    const baseUrl = "https://github.com/rimvydasb/edgerules-page-legacy/blob/main/public/"

    return (
        <footer className="footer">
            <div className="footer__inner">
                <div className="footer__grid">
                    <div className="footer__col">
                        <div className="footer__title">GitHub</div>
                        <ul className="footer__list">
                            <li>
                                <a
                                    className="footer__link"
                                    href="https://github.com/rimvydasb/edgerules"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    EdgeRules Core
                                </a>
                            </li>
                            <li>
                                <a
                                    className="footer__link"
                                    href="https://github.com/rimvydasb/edgerules-page-legacy"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    EdgeRules Page
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div className="footer__col">
                        <div className="footer__title">Markdown Reference</div>
                        <ul className="footer__list">
                            {CONTENT_PAGES.filter(isMarkdownContentMenuItem).map((item) => {
                                const normalizedReference = item.contentReference.replace(/^\/+/, '')
                                const href = `${baseUrl}${normalizedReference}`
                                const documentName = normalizedReference.substring(
                                    normalizedReference.lastIndexOf('/') + 1,
                                )

                                return (
                                    <li key={item.contentReference}>
                                        <a className="footer__link" href={href} target="_blank" rel="noopener noreferrer">
                                            {documentName}
                                        </a>
                                    </li>
                                )
                            })}
                        </ul>
                    </div>

                    <div className="footer__col">
                        <div className="footer__title">Project</div>
                        <ul className="footer__list">
                            <li>
                                <a
                                    className="footer__link"
                                    href="https://github.com/rimvydasb/edgerules/blob/main/LICENSE"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    License
                                </a>
                            </li>
                            <li>
                                <a
                                    className="footer__link"
                                    href="https://www.linkedin.com/in/rimvydasb/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Contacts
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="footer__bottom">
                    <div>Interactive examples powered by EdgeRules WASM.</div>
                    <div className="footer__copyright">© {new Date().getFullYear()} edgerules-page-legacy</div>
                </div>
            </div>
        </footer>
    )
}
