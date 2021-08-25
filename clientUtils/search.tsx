import { flatten } from "./Util"
import chunk from "chunk-text"
import { fromString } from "html-to-text"
import { escapeRegExp, sortBy } from "lodash"
import React from "react"

export interface SearchWord {
    regex: RegExp
    word: string
}
export const buildSearchWordsFromSearchString = (
    searchInput: string | undefined
): SearchWord[] => {
    if (!searchInput) return []
    const wordRegexes = searchInput
        .split(" ")
        .filter((item) => item)
        .map((item) => ({
            regex: new RegExp(escapeRegExp(item), "i"),
            word: item,
        }))
    return wordRegexes
}

/** Given a list of SearchWords constructed with buildSearchWordsFromSearchString
    and a search field string extractor function, this function returns a filter function
    that tells you if all search terms occur in any of the fields extracted by the extractor fn.

    E.g. if you have a type Person with firstName and lastName and you want it to search in both fields,
    you would call it like this:

    @example
    const searchWords = buildSearchWordsFromSearchString("peter mary")
    const filterFn = filterFunctionForSearchWords(searchWords, (person: Person) => [person.firstName, person.lastName])
    const filteredPeople = people.filter(filterFn)
*/
export function filterFunctionForSearchWords<TargetObject>(
    searchWords: SearchWord[],
    targetPropertyExtractorFn: (t: TargetObject) => (string | undefined)[]
): (target: TargetObject) => boolean {
    return (target: TargetObject): boolean =>
        searchWords.every((searchWord) =>
            targetPropertyExtractorFn(target).some(
                (searchString) =>
                    searchString !== undefined &&
                    searchWord.regex.test(searchString)
            )
        )
}

export function highlightFunctionForSearchWords(
    searchWords: SearchWord[]
): (text: string) => JSX.Element | string {
    return (text: string): JSX.Element | string => {
        if (searchWords.length > 0) {
            const firstMatches = searchWords
                .map((regex) => [text.search(regex.regex), regex.word] as const)
                .filter(([index, word]) => index >= 0)
            const sortedFirstMatches = sortBy(
                firstMatches,
                ([index, word]) => index
            )
            const fragments: JSX.Element[] = []
            let lastIndex = 0
            for (const [index, word] of sortedFirstMatches) {
                fragments.push(
                    <span key={`${lastIndex}-start`}>
                        {text.substring(lastIndex, index)}
                    </span>
                )
                fragments.push(
                    <span
                        key={`${lastIndex}-content`}
                        style={{ color: "#aa3333" }}
                    >
                        {word}
                    </span>
                )
                lastIndex = index + word.length
            }
            fragments.push(
                <span key={lastIndex}>{text.substring(lastIndex)}</span>
            )
            return <span>{fragments}</span>
        } else return text
    }
}

export const htmlToPlaintext = (html: string): string =>
    fromString(html, {
        tables: true,
        ignoreHref: true,
        wordwrap: false,
        uppercaseHeadings: false,
        ignoreImage: true,
    })

export const chunkWords = (text: string, maxChunkLength: number): string[] =>
    chunk(text, maxChunkLength)

export const chunkSentences = (
    text: string,
    maxChunkLength: number
): string[] => {
    // See https://stackoverflow.com/a/25736082/1983739
    // Not perfect, just works in most cases
    const sentenceRegex = /(?<!\w\.\w.)(?<![A-Z][a-z]\.)(?<=\.|\?|\n)\s/g
    const sentences = flatten(
        text
            .split(sentenceRegex)
            .map((s) =>
                s.length > maxChunkLength ? chunkWords(s, maxChunkLength) : s
            )
    )
        .map((s) => s.trim())
        .filter((s) => s)
        .reverse() as string[]

    const chunks = []
    let chunk = sentences.pop()
    if (!chunk) return []

    while (true) {
        const sentence = sentences.pop()
        if (!sentence) {
            chunks.push(chunk)
            break
        } else {
            const nextChunk: string = chunk + " " + sentence
            if (nextChunk.length > maxChunkLength) {
                chunks.push(chunk)
                chunk = sentence
            } else chunk = nextChunk
        }
    }

    return chunks
}

// Chunks a given bit of text into an array of fragments less than or equal to maxChunkLength in size
// These chunks will honor sentence boundaries where possible
export const chunkParagraphs = (
    text: string,
    maxChunkLength: number
): string[] => {
    const paragraphs = flatten(
        text
            .split("\n\n")
            .map((p) =>
                p.length > maxChunkLength
                    ? chunkSentences(p, maxChunkLength)
                    : p
            )
    )
        .map((p) => p.trim())
        .filter((p) => p)
        .reverse() as string[]

    const chunks = []
    let chunk = paragraphs.pop()
    if (!chunk) return []

    while (true) {
        const p = paragraphs.pop()
        if (!p) {
            chunks.push(chunk)
            break
        } else {
            const nextChunk: string = chunk + "\n\n" + p
            if (nextChunk.length > maxChunkLength) {
                chunks.push(chunk)
                chunk = p
            } else chunk = nextChunk
        }
    }

    return chunks
}
