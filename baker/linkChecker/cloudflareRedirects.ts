// A small emulation of Cloudflare Pages `_redirects` matching, enough to
// resolve the rules we bake in baker/redirects.ts:
// https://developers.cloudflare.com/pages/configuration/redirects/
//
// - `*` in a source is a splat matching any characters (including `/`) and is
//   referenced as `:splat` in the target.
// - `:name` in a source is a placeholder matching a single path segment and is
//   referenced as `:name` in the target.
// - Static rules (no splat or placeholder) take precedence over dynamic ones;
//   within each group the first matching rule in file order wins.

export interface RedirectRule {
    source: string
    target: string
    status: number
    isDynamic: boolean
}

interface CompiledRule extends RedirectRule {
    regex: RegExp
    paramNames: string[]
}

export function parseRedirectsFile(contents: string): RedirectRule[] {
    const rules: RedirectRule[] = []
    for (const rawLine of contents.split("\n")) {
        const line = rawLine.trim()
        if (!line || line.startsWith("#")) continue
        const [source, target, statusStr] = line.split(/\s+/)
        if (!source || !target) continue
        const status = statusStr ? parseInt(statusStr, 10) : 302
        rules.push({
            source,
            target,
            status: Number.isNaN(status) ? 302 : status,
            isDynamic: source.includes("*") || source.includes(":"),
        })
    }
    return rules
}

function compileRule(rule: RedirectRule): CompiledRule {
    const paramNames: string[] = []
    let pattern = ""
    const tokens = rule.source.match(/\*|:[A-Za-z0-9_]+|[^*:]+/g) ?? []
    for (const token of tokens) {
        if (token === "*") {
            paramNames.push("splat")
            pattern += "(.*)"
        } else if (token.startsWith(":")) {
            paramNames.push(token.slice(1))
            pattern += "([^/]+)"
        } else {
            pattern += token.replace(/[.+?^${}()|[\]\\]/g, "\\$&")
        }
    }
    return { ...rule, regex: new RegExp(`^${pattern}$`), paramNames }
}

export class RedirectMatcher {
    private readonly staticRules: Map<string, RedirectRule>
    private readonly dynamicRules: CompiledRule[]

    constructor(rules: RedirectRule[]) {
        this.staticRules = new Map()
        for (const rule of rules) {
            if (!rule.isDynamic && !this.staticRules.has(rule.source)) {
                this.staticRules.set(rule.source, rule)
            }
        }
        this.dynamicRules = rules.filter((r) => r.isDynamic).map(compileRule)
    }

    static fromFileContents(contents: string): RedirectMatcher {
        return new RedirectMatcher(parseRedirectsFile(contents))
    }

    /** Returns the redirect target for a pathname, or undefined if no rule matches. */
    match(
        pathname: string
    ): { target: string; rule: RedirectRule } | undefined {
        const staticRule = this.staticRules.get(pathname)
        if (staticRule) return { target: staticRule.target, rule: staticRule }

        for (const rule of this.dynamicRules) {
            const match = pathname.match(rule.regex)
            if (!match) continue
            let target = rule.target
            rule.paramNames.forEach((name, i) => {
                target = target.replaceAll(`:${name}`, match[i + 1] ?? "")
            })
            return { target, rule }
        }
        return undefined
    }
}
