import { excludeUndefined, sum } from "../../clientUtils/Util.js"
import {
    IRToken,
    IRLineBreak,
    IRWhitespace,
    IRElement,
    IRBreakpoint,
} from "./TextTokens.js"

function splitAllOnNewline(tokens: IRToken[]): IRToken[][] {
    let currentLine: IRToken[] = []
    const lines: IRToken[][] = [currentLine]
    const unproccessed: IRToken[] = [...tokens]
    while (unproccessed.length > 0) {
        const token = unproccessed.shift()!
        if (token instanceof IRElement) {
            const { before, after } = token.splitOnNextLineBreak()
            if (before) currentLine.push(before)
            if (after) {
                currentLine = []
                lines.push(currentLine)
                // move to unprocessed stack, it might contain futher newlines
                unproccessed.unshift(after)
            }
        } else if (token instanceof IRLineBreak) {
            currentLine = []
            lines.push(currentLine)
        } else {
            currentLine.push(token)
        }
    }
    return lines
}

export function splitLineAtBreakpoint(
    tokens: IRToken[],
    breakWidth: number
): { before: IRToken[]; after: IRToken[] } {
    let i = 0
    let offset = 0
    // finding the token where the split should be
    // NOTE: the token may not be splittable, which is why we need an exact
    // `breakWidth` provided, not the line width.
    while (i < tokens.length - 1 && offset + tokens[i].width < breakWidth) {
        offset += tokens[i].width
        i++
    }
    const token = tokens[i]
    if (token instanceof IRElement) {
        const { before, after } = token.splitBefore(breakWidth - offset)
        return {
            before: excludeUndefined([...tokens.slice(0, i), before]),
            after: excludeUndefined([after, ...tokens.slice(i + 1)]),
        }
    } else {
        return { before: tokens.slice(0, i), after: trimLeft(tokens.slice(i)) }
    }
}

function trimLeft(tokens: IRToken[]): IRToken[] {
    let i = 0
    while (i < tokens.length && tokens[i] instanceof IRWhitespace) {
        i++
    }
    return tokens.slice(i)
}

// Even though it says "before", it may return a breakpoint after, because
// there is no earlier breakpoint in the line.
export function getBreakpointBefore(
    tokens: IRToken[],
    maxWidth: number
): IRBreakpoint | undefined {
    let tokenStartOffset = 0
    let prevBreakpoint: IRBreakpoint | undefined = undefined
    for (let index = 0; index < tokens.length; index++) {
        const token = tokens[index]
        const candidate = token.getBreakpointBefore(maxWidth - tokenStartOffset)
        if (candidate !== undefined) {
            if (
                prevBreakpoint &&
                candidate.breakOffset + tokenStartOffset > maxWidth
            ) {
                break
            }
            prevBreakpoint = {
                tokenStartOffset,
                tokenIndex: index,
                breakOffset: candidate.breakOffset + tokenStartOffset,
            }
        }
        tokenStartOffset += token.width
    }
    return prevBreakpoint
}

export function getLineWidth(tokens: IRToken[]): number {
    return sum(tokens.map((token) => token.width))
}

// useful for debugging
export function lineToPlaintext(tokens: IRToken[]): string {
    return tokens.map((t) => t.toPlaintext()).join("")
}

export function splitIntoLines(
    tokens: IRToken[],
    maxWidth: number
): IRToken[][] {
    const processedLines: IRToken[][] = []
    const unprocessedLines: IRToken[][] = splitAllOnNewline(tokens)
    while (unprocessedLines.length) {
        const currentLine = unprocessedLines.shift()!
        if (getLineWidth(currentLine) <= maxWidth) {
            processedLines.push(currentLine)
        } else {
            const breakpoint = getBreakpointBefore(currentLine, maxWidth)
            if (!breakpoint) {
                processedLines.push(currentLine)
            } else {
                const { before, after } = splitLineAtBreakpoint(
                    currentLine,
                    breakpoint.breakOffset
                )
                processedLines.push(before)
                unprocessedLines.unshift(after)
            }
        }
    }
    return processedLines
}
