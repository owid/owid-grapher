import { useMemo } from "react"
import * as React from "react"
import type { MultiDimAllViewsView } from "./MultiDimAllViews.js"

const normalizeForSearch = (str: string): string =>
    str
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")

const Mark = ({ children }: { children: React.ReactNode }) => (
    <mark className="view-search-mark">{children}</mark>
)

// Marks the parts of `text` that contain a search token. Matching happens on
// the normalized text (like the search itself), so each normalized character
// remembers which character of `text` it came from.
export function highlightTokens(
    text: string,
    tokens: string[]
): React.ReactNode {
    if (tokens.length === 0) return text
    let normalized = ""
    const sourceIndex: number[] = []
    for (let i = 0; i < text.length; i++) {
        const normalizedChar = normalizeForSearch(text[i])
        normalized += normalizedChar
        sourceIndex.push(...new Array<number>(normalizedChar.length).fill(i))
    }

    const isMarked = new Array<boolean>(text.length).fill(false)
    for (const token of tokens) {
        let start = normalized.indexOf(token)
        while (start !== -1) {
            for (let j = start; j < start + token.length; j++)
                isMarked[sourceIndex[j]] = true
            start = normalized.indexOf(token, start + 1)
        }
    }
    if (!isMarked.includes(true)) return text

    const parts: React.ReactNode[] = []
    let partStart = 0
    for (let i = 1; i <= text.length; i++) {
        if (i < text.length && isMarked[i] === isMarked[partStart]) continue
        const part = text.slice(partStart, i)
        parts.push(
            isMarked[partStart] ? <Mark key={partStart}>{part}</Mark> : part
        )
        partStart = i
    }
    return parts
}

/**
 * Searching the views of a multi-dim page, shared by the "All charts" list
 * and the command bar: every word of the query has to appear in the view's
 * title, dimension names or choice names.
 */
export function useViewSearch(
    views: MultiDimAllViewsView[],
    query: string
): {
    /** The query's normalized words, for highlightTokens */
    tokens: string[]
    isSearching: boolean
    matches: (view: MultiDimAllViewsView) => boolean
} {
    const haystacks = useMemo(
        () =>
            new Map(
                views.map((view) => [
                    view.queryStr,
                    normalizeForSearch(
                        [
                            view.title,
                            ...view.choices.map(
                                (c) => `${c.dimensionName} ${c.choiceName}`
                            ),
                        ].join(" ")
                    ),
                ])
            ),
        [views]
    )

    const tokens = normalizeForSearch(query).split(/\s+/).filter(Boolean)
    const matches = (view: MultiDimAllViewsView): boolean => {
        const haystack = haystacks.get(view.queryStr) ?? ""
        return tokens.every((token) => haystack.includes(token))
    }

    return { tokens, isSearching: tokens.length > 0, matches }
}
