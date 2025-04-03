import { useMemo, useEffect, useState } from "react"
import Fuse from "fuse.js"
import {
    countries,
    flattenNonTopicNodes,
    getAllChildrenOfArea,
} from "@ourworldindata/utils"

interface MatchEntity {
    name: string
    type: "country" | "topic"
}

export const DataCatalogFuzzyMatcher = ({
    addCountry,
    addTopic,
    minQueryLength,
}: {
    addCountry: (country: string) => void
    addTopic: (topic: string) => void
    minQueryLength: number
}) => {
    const [query, setQuery] = useState("")
    const [matchedEntities, setMatchedEntities] = useState<MatchEntity[]>([])
    const [topics, setTopics] = useState<string[]>([])

    // Fetch topics from the tag graph using the same approach as TopicsRefinementListWrapper
    useEffect(() => {
        const fetchTopicTagGraph = async () => {
            try {
                console.log("Attempting to fetch topic tag graph...")
                const response = await fetch("/topicTagGraph.json")
                console.log("Response status:", response.status)

                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`)
                }

                const tagGraph = await response.json()
                console.log("Successfully parsed tag graph JSON")

                const topicTagGraph = flattenNonTopicNodes(tagGraph)

                // Get all topics (top-level and children) from the topic graph
                const allTopicsSet = new Set<string>(
                    topicTagGraph.children.flatMap((area) => [
                        area.name,
                        ...getAllChildrenOfArea(area).map((node) => node.name),
                    ])
                )

                const apiTopicsArray = Array.from(allTopicsSet)
                console.log(
                    `Loaded ${apiTopicsArray.length} topics from API:`,
                    apiTopicsArray.slice(0, 10)
                )

                setTopics(apiTopicsArray)
            } catch (err) {
                console.error(`Failed to fetch topic tag graph: ${err}`)
                setTopics([])
            }
        }

        void fetchTopicTagGraph()
    }, [])

    // Prepare data for fuzzy search - add logging to debug entity creation
    const entities = useMemo(() => {
        const countryEntities = countries.map((country) => ({
            name: country.name,
            type: "country" as const,
        }))

        const topicEntities = topics.map((topic) => ({
            name: topic,
            type: "topic" as const,
        }))

        console.log(
            `Created ${countryEntities.length} country entities and ${topicEntities.length} topic entities`
        )

        return [...countryEntities, ...topicEntities]
    }, [topics])

    // Initialize Fuse instance with settings for consecutive character matching
    const fuse = useMemo(() => {
        const options = {
            keys: ["name"],
            threshold: 0.3, // Lower threshold makes matching more strict
            includeScore: true,
            ignoreLocation: false, // Pay attention to where the match occurs
            location: 0, // Start matching from beginning of string (prefix matching)
            distance: 100, // Allow matches anywhere in string but prioritize early matches
            minMatchCharLength: minQueryLength, // Minimum of 2 characters must match
            findAllMatches: false,
            shouldSort: true,
            isCaseSensitive: false,
        }
        return new Fuse(entities, options)
    }, [entities])

    // Add a dedicated prefix matching function for more control
    const findPrefixMatches = (token: string, entityList: MatchEntity[]) => {
        // First try direct prefix matches
        const prefixMatches = entityList.filter((entity) =>
            entity.name.toLowerCase().startsWith(token.toLowerCase())
        )

        // If we have prefix matches, return those
        if (prefixMatches.length > 0) {
            return prefixMatches
        }

        // Otherwise, fallback to Fuse.js
        return fuse.search(token).map((result) => result.item)
    }

    // Extract entities from query with modified matching approach
    useEffect(() => {
        if (query.length < minQueryLength) {
            setMatchedEntities([])
            return
        }

        const tokens = query.split(/\s+/).filter((token) => token.length >= 3)
        console.log("Searching for tokens:", tokens)

        const matches = new Map<string, MatchEntity>()

        // 1. Try prefix matching first for each token
        for (const token of tokens) {
            // Try direct prefix matching first
            const prefixResults = findPrefixMatches(token, entities)
            for (const entity of prefixResults.slice(0, 10)) {
                matches.set(entity.name, entity)
                if (matches.size >= 10) break
            }

            // If still not enough matches, use Fuse with strict settings
            // if (matches.size < 5) {
            //     const results = fuse.search(token)
            //     for (const result of results) {
            //         if (result.score !== undefined && result.score < 0.3) {
            //             const entity = result.item
            //             matches.set(entity.name, entity)
            //             if (matches.size >= 10) break
            //         }
            //     }
            // }
        }

        // 2. Try combinations of adjacent tokens (sliding window)
        if (matches.size < 5 && tokens.length > 1) {
            for (
                let windowSize = 2;
                windowSize <= tokens.length;
                windowSize++
            ) {
                for (let i = 0; i <= tokens.length - windowSize; i++) {
                    const combination = tokens
                        .slice(i, i + windowSize)
                        .join(" ")
                    if (combination.length >= 3) {
                        // Try direct prefix matching first for combinations
                        const prefixResults = findPrefixMatches(
                            combination,
                            entities
                        )
                        for (const entity of prefixResults.slice(0, 5)) {
                            matches.set(entity.name, entity)
                        }

                        // Then fall back to fuzzy
                        // if (matches.size < 5) {
                        //     const results = fuse.search(combination)
                        //     for (const result of results) {
                        //         if (
                        //             result.score !== undefined &&
                        //             result.score < 0.3
                        //         ) {
                        //             const entity = result.item
                        //             matches.set(entity.name, entity)
                        //         }
                        //     }
                        // }
                    }
                }
            }
        }

        const matchesArray = Array.from(matches.values())
        console.log(
            `Final matches count: ${matchesArray.length}`,
            matchesArray.map((m) => ({ name: m.name, type: m.type }))
        )
        setMatchedEntities(matchesArray)
    }, [query, fuse, entities])

    return (
        <div className="data-catalog-fuzzy-matcher-test span-cols-12 col-start-2">
            <div className="test-input-container">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Test fuzzy search..."
                    className="fuzzy-matcher-test-input"
                />
                <div className="fuzzy-matcher-test-info">
                    {`Type at least ${minQueryLength} characters to see matches`}
                </div>
            </div>

            {matchedEntities.length > 0 && (
                <div className="data-catalog-fuzzy-matches">
                    <div className="fuzzy-match-title">Did you mean:</div>
                    <div className="fuzzy-match-suggestions">
                        {matchedEntities.map((entity) => (
                            <button
                                key={`${entity.type}-${entity.name}`}
                                className={`fuzzy-match-tag fuzzy-match-${entity.type}`}
                                onClick={() => {
                                    if (entity.type === "country") {
                                        addCountry(entity.name)
                                    } else {
                                        addTopic(entity.name)
                                    }
                                }}
                            >
                                {entity.name} ({entity.type})
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
