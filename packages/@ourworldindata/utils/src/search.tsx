import { drop, escapeRegExp, sortBy } from "./Util.js"
import React from "react"

export interface SearchWord {
    regex: RegExp
    word: string
}

function buildRegexFromSearchWord(str: string): RegExp {
    const escapedString = escapeRegExp(str)
    const moreTolerantMatchReplacements =
        // Match digit or superscript/subscript variant
        [
            { searchTerm: "0", regexTerm: "(0|\u2070|\u2080)" },
            {
                searchTerm: "1",
                regexTerm: "(1|\u00B9|\u2081)", // superscript for 1, 2 and 3 are odd codepoints
            },
            { searchTerm: "2", regexTerm: "(2|\u00B2|\u2082)" },
            { searchTerm: "3", regexTerm: "(3|\u00B3|\u2083)" },
            { searchTerm: "4", regexTerm: "(4|\u2074|\u2084)" },
            { searchTerm: "5", regexTerm: "(5|\u2075|\u2085)" },
            { searchTerm: "6", regexTerm: "(6|\u2076|\u2086)" },
            { searchTerm: "7", regexTerm: "(7|\u2077|\u2087)" },
            { searchTerm: "8", regexTerm: "(8|\u2078|\u2088)" },
            { searchTerm: "9", regexTerm: "(9|\u2079|\u2089)" },
        ]
    let moreTolerantMatch = escapedString
    for (const replacement of moreTolerantMatchReplacements) {
        moreTolerantMatch = moreTolerantMatch.replace(
            replacement.searchTerm,
            replacement.regexTerm
        )
    }
    return new RegExp(moreTolerantMatch, "iu")
}
export const buildSearchWordsFromSearchString = (
    searchInput: string | undefined
): SearchWord[] => {
    if (!searchInput) return []
    const wordRegexes = searchInput
        .split(" ")
        .filter((item) => item)
        .map((item) => ({
            regex: buildRegexFromSearchWord(item),
            word: item,
        }))
    return wordRegexes
}

/** Given a list of SearchWords constructed with buildSearchWordsFromSearchString
    and a search field string extractor function, this function returns a filter function
    that tells you if all search terms occur in any of the fields extracted by the extractor fn (in any order).

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
): (text: string | null | undefined) => JSX.Element | string {
    return function Highlighted(
        text: string | null | undefined
    ): JSX.Element | string {
        if (text === undefined || text === null) return ""
        if (searchWords.length > 0) {
            const firstMatches = searchWords
                .map((regex) => ({
                    matchStart: text.search(regex.regex),
                    matchLength: regex.word.length,
                }))
                .filter(({ matchStart }) => matchStart >= 0)
            const fragments: JSX.Element[] = []
            let lastIndex = 0
            if (firstMatches.length > 0) {
                // sort descending by end position and then length
                const sortedFirstMatches = sortBy(firstMatches, [
                    ({ matchStart, matchLength }): number =>
                        -(matchStart + matchLength),
                    ({ matchLength }): number => -matchLength,
                ])
                // merge overlapping match ranges
                const mergedMatches = [sortedFirstMatches[0]]
                let lastMatch = mergedMatches[0]
                for (const match of drop(sortedFirstMatches, 1)) {
                    if (
                        lastMatch.matchStart <=
                        match.matchStart + match.matchLength
                    ) {
                        lastMatch.matchLength =
                            Math.max(
                                lastMatch.matchStart + lastMatch.matchLength,
                                match.matchStart + match.matchLength
                            ) - match.matchStart
                        lastMatch.matchStart = match.matchStart
                    } else {
                        mergedMatches.push(match)
                        lastMatch = match
                    }
                }
                // sort ascending
                const sortedMergedMatches = sortBy(
                    mergedMatches,
                    (match) => match.matchStart
                )

                // cut and add fragments
                for (const { matchStart, matchLength } of sortedMergedMatches) {
                    fragments.push(
                        <span key={`${lastIndex}-start`}>
                            {text.substring(lastIndex, matchStart)}
                        </span>
                    )
                    fragments.push(
                        <span
                            key={`${lastIndex}-content`}
                            style={{ color: "#aa3333" }}
                        >
                            {text.substring(
                                matchStart,
                                matchStart + matchLength
                            )}
                        </span>
                    )
                    lastIndex = matchStart + matchLength
                }
            }
            fragments.push(
                <span key={lastIndex}>{text.substring(lastIndex)}</span>
            )
            return <span>{fragments}</span>
        } else return text
    }
}
