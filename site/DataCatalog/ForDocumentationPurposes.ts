let queryWords = ["a", "b", "z", "d", "e"]
let results = [
    {
        title: "Result 1",
        _highlightResult: { title: { matchedWords: ["a", "b"] } },
    },
    {
        title: "Result 2",
        _highlightResult: { title: { matchedWords: ["a", "c"] } },
    },
    {
        title: "Result 3",
        _highlightResult: { title: { matchedWords: ["a", "z", "b"] } },
    },
    {
        title: "Result 4",
        _highlightResult: { title: { matchedWords: ["a", "d"] } },
    },
    {
        title: "Result 5",
        _highlightResult: { title: { matchedWords: ["c", "d", "e"] } },
    },
]

export function getLongestMutuallyExclusiveResults(queryWords, results) {
    console.log("queryWords", queryWords)
    const longestResults = []
    const addedResultTitles = new Set() // Track added result titles to prevent duplicates

    // Deep clone the results to avoid modifying the original data
    const clonedResults = JSON.parse(JSON.stringify(results))

    // Keep track of processed query words
    const processedQueryWords = new Set()

    // Process each query word and find matches
    for (let i = 0; i < queryWords.length; i++) {
        const currentWord = queryWords[i]

        // Skip already processed words
        if (processedQueryWords.has(currentWord)) {
            continue
        }

        // Find results that match this word
        const matchingResults = clonedResults.filter((result) => {
            return result._highlightResult.title.matchedWords.includes(
                currentWord
            )
        })

        if (matchingResults.length === 0) {
            // No matches for this word
            continue
        } else if (matchingResults.length === 1) {
            // Only one match found
            const resultToAdd = results.find(
                (r) => r.title === matchingResults[0].title
            )

            if (resultToAdd && !addedResultTitles.has(resultToAdd.title)) {
                longestResults.push(resultToAdd)
                addedResultTitles.add(resultToAdd.title)
            }

            // Mark this word as processed
            processedQueryWords.add(currentWord)

            // Remove the word from all results
            for (const result of clonedResults) {
                const index =
                    result._highlightResult.title.matchedWords.indexOf(
                        currentWord
                    )
                if (index !== -1) {
                    result._highlightResult.title.matchedWords.splice(index, 1)
                }
            }
        } else {
            // Multiple matches - try to find more specific matches with consecutive words
            let longestSequenceLength = 1
            let bestMatch = null

            // Try to find longest sequence starting with current word
            for (
                let seqLength = 2;
                seqLength <= queryWords.length - i;
                seqLength++
            ) {
                const wordSequence = queryWords.slice(i, i + seqLength)

                // Only consider sequences with unique consecutive words
                if (new Set(wordSequence).size !== wordSequence.length) continue

                // Find results matching this sequence
                const seqMatches = matchingResults.filter((result) => {
                    const resultWords =
                        result._highlightResult.title.matchedWords
                    return (
                        wordSequence.every((word) =>
                            resultWords.includes(word)
                        ) && areWordsContiguous(wordSequence, resultWords)
                    )
                })

                if (seqMatches.length === 1) {
                    // Found a unique sequence match
                    if (seqLength > longestSequenceLength) {
                        longestSequenceLength = seqLength
                        bestMatch = seqMatches[0]
                    }
                }
            }

            // If we found a sequence match, use it
            if (bestMatch) {
                const resultToAdd = results.find(
                    (r) => r.title === bestMatch.title
                )

                if (resultToAdd && !addedResultTitles.has(resultToAdd.title)) {
                    longestResults.push(resultToAdd)
                    addedResultTitles.add(resultToAdd.title)
                }

                // Mark all words in the sequence as processed
                const wordSequence = queryWords.slice(
                    i,
                    i + longestSequenceLength
                )
                wordSequence.forEach((word) => processedQueryWords.add(word))

                // Remove these words from all results
                for (const result of clonedResults) {
                    for (const word of wordSequence) {
                        const index =
                            result._highlightResult.title.matchedWords.indexOf(
                                word
                            )
                        if (index !== -1) {
                            result._highlightResult.title.matchedWords.splice(
                                index,
                                1
                            )
                        }
                    }
                }

                // Skip ahead in the query words array
                i += longestSequenceLength - 1
            } else {
                // No unique sequence - pick the first matching result
                const resultToAdd = results.find(
                    (r) => r.title === matchingResults[0].title
                )

                if (resultToAdd && !addedResultTitles.has(resultToAdd.title)) {
                    longestResults.push(resultToAdd)
                    addedResultTitles.add(resultToAdd.title)
                }

                // Mark this word as processed
                processedQueryWords.add(currentWord)

                // Remove the word from all results
                for (const result of clonedResults) {
                    const index =
                        result._highlightResult.title.matchedWords.indexOf(
                            currentWord
                        )
                    if (index !== -1) {
                        result._highlightResult.title.matchedWords.splice(
                            index,
                            1
                        )
                    }
                }
            }
        }
    }

    // Second pass for duplicate words in the query
    for (let i = 0; i < queryWords.length; i++) {
        const currentWord = queryWords[i]

        // Skip the word if it's the first occurrence or already processed
        if (
            queryWords.indexOf(currentWord) !== i ||
            processedQueryWords.has(`${currentWord}_dup_${i}`)
        ) {
            continue
        }

        // Count occurrences in the query
        const wordOccurrences = queryWords.filter(
            (w) => w === currentWord
        ).length

        // Find results that still have this word with enough occurrences
        const matchingResults = clonedResults.filter((result) => {
            const count = result._highlightResult.title.matchedWords.filter(
                (w) => w === currentWord
            ).length
            return count > 0
        })

        for (const match of matchingResults) {
            // Only add if not already added
            const resultToAdd = results.find((r) => r.title === match.title)
            if (resultToAdd && !addedResultTitles.has(resultToAdd.title)) {
                longestResults.push(resultToAdd)
                addedResultTitles.add(resultToAdd.title)

                // Mark as processed with unique identifier
                processedQueryWords.add(`${currentWord}_dup_${i}`)

                // Remove word from this result
                const index =
                    match._highlightResult.title.matchedWords.indexOf(
                        currentWord
                    )
                if (index !== -1) {
                    match._highlightResult.title.matchedWords.splice(index, 1)
                }

                break // Only take one result for this duplicate word
            }
        }
    }

    return longestResults
}

// Helper function to check if words appear contiguously in the result
function areWordsContiguous(sequence, resultWords) {
    // For a sequence of length 1, it's always contiguous
    if (sequence.length === 1) return true

    let startIndex = -1

    // Try to find the first word from sequence in resultWords
    for (let i = 0; i < resultWords.length; i++) {
        if (resultWords[i] === sequence[0]) {
            startIndex = i
            break
        }
    }

    if (startIndex === -1) return false

    // Check if the following words match the sequence
    for (let i = 1; i < sequence.length; i++) {
        if (
            startIndex + i >= resultWords.length ||
            resultWords[startIndex + i] !== sequence[i]
        ) {
            return false
        }
    }

    return true
}

console.log(
    getLongestMutuallyExclusiveResults(queryWords, results).map((r) => r.title)
)
queryWords = ["pop", "fr", "g"]
results = [
    {
        title: "French Guiana",
        _highlightResult: {
            title: {
                matchedWords: ["fr", "g"],
            },
        },
    },
    {
        title: "Germany",
        _highlightResult: {
            title: {
                matchedWords: ["g"],
            },
        },
    },
    {
        title: "France",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "Population Growth",
        _highlightResult: {
            title: {
                matchedWords: ["pop", "g"],
            },
        },
    },
    {
        title: "CO₂ and Greenhouse Gas Emissions",
        _highlightResult: {
            title: {
                matchedWords: ["g"],
            },
        },
    },
    {
        title: "Economic Growth",
        _highlightResult: {
            title: {
                matchedWords: ["g"],
            },
        },
    },
]
console.log(
    getLongestMutuallyExclusiveResults(queryWords, results).map((r) => r.title)
)

queryWords = ["pop", "fr"]
results = [
    {
        title: "France",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "French Guiana",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "French Polynesia",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "Population Growth",
        _highlightResult: {
            title: {
                matchedWords: ["pop"],
            },
        },
    },
]

console.log(
    getLongestMutuallyExclusiveResults(queryWords, results).map((r) => r.title)
)

queryWords = ["agr", "fr", "agr"]
results = [
    {
        title: "France",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "French Guiana",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "French Polynesia",
        _highlightResult: {
            title: {
                matchedWords: ["fr"],
            },
        },
    },
    {
        title: "Agricultural Production",
        _highlightResult: {
            title: {
                matchedWords: ["agr", "agr"],
            },
        },
    },
    {
        title: "Employment in Agriculture",
        _highlightResult: {
            title: {
                matchedWords: ["agr", "agr"],
            },
        },
    },
]

console.log(
    getLongestMutuallyExclusiveResults(queryWords, results).map((r) => r.title)
)

queryWords = ["france", "united", "states", "unit"]
results = [
    {
        title: "United States",
        _highlightResult: {
            title: {
                matchedWords: ["united", "states", "unit"],
            },
        },
    },
    {
        title: "United States Virgin Islands",
        _highlightResult: {
            title: {
                matchedWords: ["united", "states", "unit"],
            },
        },
    },
    {
        title: "France",
        _highlightResult: {
            title: {
                matchedWords: ["france"],
            },
        },
    },
    {
        title: "United Kingdom",
        _highlightResult: {
            title: {
                matchedWords: ["united", "unit"],
            },
        },
    },
    {
        title: "United Arab Emirates",
        _highlightResult: {
            title: {
                matchedWords: ["united", "unit"],
            },
        },
    },
    {
        title: "State Capacity",
        _highlightResult: {
            title: {
                matchedWords: ["states"],
            },
        },
    },
]
console.log(
    getLongestMutuallyExclusiveResults(queryWords, results).map((r) => r.title)
)
