import postcss, { type AtRule, type Plugin as PostcssPlugin } from "postcss"
import type { Plugin } from "vite"

/**
 * Scopes whole stylesheets to a container element.
 *
 * Every selector in a listed stylesheet is prefixed with its scope selector
 * (`a` → `.scope a`), and selectors for the document itself (`html`, `body`,
 * `:root`) become the scope element, so a page-level stylesheet applies to
 * one subtree of another page instead — the rich editor renders the site's
 * components inside the admin this way.
 *
 * Runs on the compiled CSS, after Vite has processed Sass and inlined plain
 * CSS `@import`s, so vendor stylesheets get scoped too. Sass nesting can't
 * do that: plain CSS imports can't be nested and would be hoisted out.
 *
 * `files` maps repo-relative stylesheet paths to their scope selector.
 */
export function pluginScopedCss(files: Record<string, string>): Plugin {
    const entries = Object.entries(files)
    return {
        name: "owid:scoped-css",
        async transform(code, id) {
            const path = id.split("?")[0]
            const match = entries.find(([file]) => path.endsWith(`/${file}`))
            if (!match) return null
            const result = await postcss([scopeSelectors(match[1])]).process(
                code,
                { from: path, map: false }
            )
            return { code: result.css, map: null }
        },
    }
}

const DOCUMENT_SELECTOR = /^(html|body|:root)(?![\w-])/

function scopeSelectors(scope: string): PostcssPlugin {
    return {
        postcssPlugin: "owid-scope-selectors",
        Once(root) {
            root.walkRules((rule) => {
                // keyframe selectors (from, to, 50%) are not element selectors
                const parent = rule.parent as AtRule | undefined
                if (parent?.type === "atrule" && /keyframes$/i.test(parent.name))
                    return
                rule.selectors = rule.selectors.map((selector) => {
                    const trimmed = selector.trim()
                    if (DOCUMENT_SELECTOR.test(trimmed)) {
                        // `body`, `html.no-scroll`, `body > .x` → the scope element
                        return trimmed.replace(DOCUMENT_SELECTOR, scope)
                    }
                    return `${scope} ${trimmed}`
                })
            })
        },
    }
}
