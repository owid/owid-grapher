import { useMemo, useState, useEffect, useRef, useCallback } from "react"
import cx from "classnames"
import { SearchAsDraft } from "./SearchAsDraft.js"
import { useSearchContext } from "./SearchContext.js"
import {
    SearchResultType,
    SearchTopicType,
    TemplateConfig,
    Filter,
} from "./searchTypes.js"
import { useSelectedTopic, useSelectedCountryNames } from "./searchHooks.js"
import { countriesByName } from "@ourworldindata/utils"
import { useSearchDebugContext } from "./SearchDebugContext.js"
import { createTopicFilter, createCountryFilter } from "./searchUtils.js"

// All possible template configurations based on the CSV data
// prettier-ignore
const ALL_TEMPLATE_CONFIGS: Array<TemplateConfig & { figmaNodeId: string }> = [
    // All templates
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Topic, hasCountry: true, hasQuery: true, figmaNodeId: "302-21526" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Topic, hasCountry: true, hasQuery: false, figmaNodeId: "297-8229" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Topic, hasCountry: false, hasQuery: true, figmaNodeId: "298-11950" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Topic, hasCountry: false, hasQuery: false, figmaNodeId: "302-24427" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Area, hasCountry: true, hasQuery: true, figmaNodeId: "302-19676" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Area, hasCountry: true, hasQuery: false, figmaNodeId: "302-27071" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Area, hasCountry: false, hasQuery: true, figmaNodeId: "302-22059" },
    { resultType: SearchResultType.ALL, topicType: SearchTopicType.Area, hasCountry: false, hasQuery: false, figmaNodeId: "113-8747" },
    { resultType: SearchResultType.ALL, topicType: null, hasCountry: true, hasQuery: true, figmaNodeId: "298-11224" },
    { resultType: SearchResultType.ALL, topicType: null, hasCountry: true, hasQuery: false, figmaNodeId: "302-25073" },
    { resultType: SearchResultType.ALL, topicType: null, hasCountry: false, hasQuery: true, figmaNodeId: "130-5909" },
    { resultType: SearchResultType.ALL, topicType: null, hasCountry: false, hasQuery: false, figmaNodeId: "286-6790" },

    // Data templates
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Topic, hasCountry: true, hasQuery: true, figmaNodeId: "399-25055" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Topic, hasCountry: true, hasQuery: false, figmaNodeId: "394-16183" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Topic, hasCountry: false, hasQuery: true, figmaNodeId: "397-19281" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Topic, hasCountry: false, hasQuery: false, figmaNodeId: "112-6780" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Area, hasCountry: true, hasQuery: true, figmaNodeId: "399-23571" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Area, hasCountry: true, hasQuery: false, figmaNodeId: "302-27755" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Area, hasCountry: false, hasQuery: true, figmaNodeId: "302-29747" },
    { resultType: SearchResultType.DATA, topicType: SearchTopicType.Area, hasCountry: false, hasQuery: false, figmaNodeId: "302-15602" },
    { resultType: SearchResultType.DATA, topicType: null, hasCountry: true, hasQuery: true, figmaNodeId: "399-22146" },
    { resultType: SearchResultType.DATA, topicType: null, hasCountry: true, hasQuery: false, figmaNodeId: "286-9579" },
    { resultType: SearchResultType.DATA, topicType: null, hasCountry: false, hasQuery: true, figmaNodeId: "133-4452" },
    { resultType: SearchResultType.DATA, topicType: null, hasCountry: false, hasQuery: false, figmaNodeId: "211-5904" },

    // Writing templates
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Topic, hasCountry: true, hasQuery: true, figmaNodeId: "399-26366" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Topic, hasCountry: true, hasQuery: false, figmaNodeId: "394-18807" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Topic, hasCountry: false, hasQuery: true, figmaNodeId: "398-19929" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Topic, hasCountry: false, hasQuery: false, figmaNodeId: "302-22929" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Area, hasCountry: true, hasQuery: true, figmaNodeId: "399-24237" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Area, hasCountry: true, hasQuery: false, figmaNodeId: "302-28660" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Area, hasCountry: false, hasQuery: true, figmaNodeId: "302-30293" },
    { resultType: SearchResultType.WRITING, topicType: SearchTopicType.Area, hasCountry: false, hasQuery: false, figmaNodeId: "302-17137" },
    { resultType: SearchResultType.WRITING, topicType: null, hasCountry: true, hasQuery: true, figmaNodeId: "399-22976" },
    { resultType: SearchResultType.WRITING, topicType: null, hasCountry: true, hasQuery: false, figmaNodeId: "302-25682" },
    { resultType: SearchResultType.WRITING, topicType: null, hasCountry: false, hasQuery: true, figmaNodeId: "302-26578" },
    { resultType: SearchResultType.WRITING, topicType: null, hasCountry: false, hasQuery: false, figmaNodeId: "113-7784" },
]

const VOWELS = ["a", "e", "i", "o", "u"]

export const SearchDebugNavigator = ({
    availableAreas,
    availableTopics,
}: {
    availableAreas: string[]
    availableTopics: string[]
}) => {
    const { templateConfig, actions } = useSearchContext()
    const [lockParams, setLockParams] = useState(true)
    const [syncFigmaPopup, setSyncFigmaPopup] = useState(true)
    const [isFigmaDevMode, setFigmaDevMode] = useState(false)
    const { isZenMode, setZenMode } = useSearchDebugContext()
    const selectedTopic = useSelectedTopic()
    const selectedCountryNames = useSelectedCountryNames()
    const figmaPopupRef = useRef<Window | null>(null)

    const availableCountries = useMemo(() => {
        return Object.keys(countriesByName())
    }, [])

    const cycleResultType = () => {
        if (lockParams) return
        const resultTypes = [
            SearchResultType.ALL,
            SearchResultType.DATA,
            SearchResultType.WRITING,
        ]
        const currentIndex = resultTypes.indexOf(templateConfig.resultType)
        const nextIndex = (currentIndex + 1) % resultTypes.length
        actions.setResultType(resultTypes[nextIndex])
    }

    const cycleTopicType = () => {
        if (lockParams) return
        const topicTypes: TemplateConfig["topicType"][] = [
            SearchTopicType.Topic,
            SearchTopicType.Area,
            null,
        ]
        const currentIndex = topicTypes.indexOf(templateConfig.topicType)
        const nextIndex = (currentIndex + 1) % topicTypes.length
        const nextTopicType = topicTypes[nextIndex]

        if (nextTopicType === SearchTopicType.Topic) {
            const randomTopic = getRandomTopic()
            actions.setTopic(randomTopic)
        } else if (nextTopicType === SearchTopicType.Area) {
            const randomArea = getRandomArea()
            actions.setTopic(randomArea)
        } else if (nextTopicType === null) {
            if (selectedTopic) actions.removeTopic(selectedTopic)
        }
    }

    const toggleCountry = () => {
        if (lockParams) return
        if (templateConfig.hasCountry) {
            // Remove all current countries
            for (const countryName of selectedCountryNames) {
                actions.removeCountry(countryName)
            }
        } else {
            const randomCountry = getRandomCountry()
            actions.addCountry(randomCountry)
        }
    }

    const toggleQuery = () => {
        if (lockParams) return
        if (templateConfig.hasQuery) {
            actions.setQuery("")
        } else {
            const randomVowel = getRandomVowel()
            actions.setQuery(randomVowel)
        }
    }

    const getConfigDescription = (config: TemplateConfig) => {
        return (
            <>
                <button
                    className={`search-debug-navigator__config-part ${lockParams ? "search-debug-navigator__config-part--locked" : "search-debug-navigator__config-part--clickable"}`}
                    onClick={cycleResultType}
                    title={
                        lockParams
                            ? "Configuration is locked"
                            : "Click to cycle through result types"
                    }
                    disabled={lockParams}
                >
                    {config.resultType.toUpperCase()}
                </button>
                <span> • </span>
                <button
                    className={cx("search-debug-navigator__config-part", {
                        "search-debug-navigator__config-part--locked":
                            lockParams,
                        "search-debug-navigator__config-part--clickable":
                            !lockParams,
                        "search-debug-navigator__config-part--crossed-out":
                            !config.topicType,
                    })}
                    onClick={cycleTopicType}
                    title={
                        lockParams
                            ? "Configuration is locked"
                            : "Click to cycle through topic types"
                    }
                    disabled={lockParams}
                >
                    {config.topicType
                        ? config.topicType.charAt(0).toUpperCase() +
                          config.topicType.slice(1)
                        : "Topic"}
                </button>
                <span> • </span>
                <button
                    className={cx("search-debug-navigator__config-part", {
                        "search-debug-navigator__config-part--locked":
                            lockParams,
                        "search-debug-navigator__config-part--clickable":
                            !lockParams,
                        "search-debug-navigator__config-part--crossed-out":
                            !config.hasCountry,
                    })}
                    onClick={toggleCountry}
                    title={
                        lockParams
                            ? "Configuration is locked"
                            : "Click to toggle country"
                    }
                    disabled={lockParams}
                >
                    Country
                </button>
                <span> • </span>
                <button
                    className={cx("search-debug-navigator__config-part", {
                        "search-debug-navigator__config-part--locked":
                            lockParams,
                        "search-debug-navigator__config-part--clickable":
                            !lockParams,
                        "search-debug-navigator__config-part--crossed-out":
                            !config.hasQuery,
                    })}
                    onClick={toggleQuery}
                    title={
                        lockParams
                            ? "Configuration is locked"
                            : "Click to toggle query"
                    }
                    disabled={lockParams}
                >
                    Query
                </button>
            </>
        )
    }

    // Find current configuration index
    const currentIndex = useMemo(() => {
        return ALL_TEMPLATE_CONFIGS.findIndex(
            (config) =>
                config.resultType === templateConfig.resultType &&
                config.topicType === templateConfig.topicType &&
                config.hasCountry === templateConfig.hasCountry &&
                config.hasQuery === templateConfig.hasQuery
        )
    }, [templateConfig])

    const currentConfig = useMemo(
        () => (currentIndex >= 0 ? ALL_TEMPLATE_CONFIGS[currentIndex] : null),
        [currentIndex]
    )

    const figmaUrl = currentConfig
        ? `${!isFigmaDevMode ? "https://www.figma.com/embed?embed_host=share&url=" : ""}https://www.figma.com/file/lAIoPy94qgSocFKYO6HBTh/?node-id=${currentConfig.figmaNodeId}`
        : ""

    // Update Figma popup when configuration changes
    useEffect(() => {
        if (syncFigmaPopup && currentConfig && figmaPopupRef.current) {
            // Check if popup is still open
            if (!figmaPopupRef.current.closed) {
                figmaPopupRef.current.location.href = figmaUrl
            }
        }
    }, [currentConfig, syncFigmaPopup, figmaUrl])

    // Get random country, topic, area, and vowel
    const getRandomCountry = useCallback(() => {
        return availableCountries[
            Math.floor(Math.random() * availableCountries.length)
        ]
    }, [availableCountries])

    const getRandomTopic = useCallback(() => {
        return availableTopics[
            Math.floor(Math.random() * availableTopics.length)
        ]
    }, [availableTopics])

    const getRandomArea = useCallback(() => {
        return availableAreas[Math.floor(Math.random() * availableAreas.length)]
    }, [availableAreas])

    const getRandomVowel = useCallback(() => {
        return VOWELS[Math.floor(Math.random() * VOWELS.length)]
    }, [])

    const openFigmaPopup = useCallback(() => {
        if (!currentConfig) return

        // Manually sync popup if needed
        if (figmaPopupRef.current && !figmaPopupRef.current.closed) {
            figmaPopupRef.current.location.href = figmaUrl
            return
        }

        // Open new popup
        figmaPopupRef.current = window.open(
            figmaUrl,
            "figma-popup",
            "width=1200,height=800,scrollbars=yes,resizable=yes"
        )
    }, [currentConfig, figmaUrl])

    const navigateToConfig = useCallback(
        (targetIndex: number) => {
            if (targetIndex < 0 || targetIndex >= ALL_TEMPLATE_CONFIGS.length)
                return

            const targetConfig = ALL_TEMPLATE_CONFIGS[targetIndex]

            // Build the complete new state first
            const newFilters: Filter[] = []
            let newQuery = ""

            // Add topic filter if needed
            if (targetConfig.topicType === SearchTopicType.Topic) {
                const randomTopic = getRandomTopic()
                newFilters.push(createTopicFilter(randomTopic))
            } else if (targetConfig.topicType === SearchTopicType.Area) {
                const randomArea = getRandomArea()
                newFilters.push(createTopicFilter(randomArea))
            }

            // Add country filter if needed
            if (targetConfig.hasCountry) {
                const randomCountry = getRandomCountry()
                newFilters.push(createCountryFilter(randomCountry))
            }

            // Set query if needed
            if (targetConfig.hasQuery) {
                newQuery = getRandomVowel()
            }

            // Apply all changes at once using setState
            actions.setState({
                query: newQuery,
                filters: newFilters,
                requireAllCountries: false,
                resultType: targetConfig.resultType,
            })
        },
        [
            actions,
            getRandomTopic,
            getRandomArea,
            getRandomCountry,
            getRandomVowel,
        ]
    )

    const regenerateCurrentParams = useCallback(() => {
        const currentConfig = templateConfig

        // Build the new filters array atomically
        const newFilters: Filter[] = []

        // Keep existing topic filters if they exist
        const existingTopicFilters = currentConfig.topicType
            ? [
                  createTopicFilter(
                      currentConfig.topicType === SearchTopicType.Topic
                          ? getRandomTopic()
                          : getRandomArea()
                  ),
              ]
            : []

        // Keep existing country filters or add new ones
        const newCountryFilters = currentConfig.hasCountry
            ? [createCountryFilter(getRandomCountry())]
            : []

        newFilters.push(...existingTopicFilters, ...newCountryFilters)

        // Generate new query
        const newQuery = currentConfig.hasQuery ? getRandomVowel() : ""

        // Apply all changes atomically
        actions.setState({
            query: newQuery,
            filters: newFilters,
            requireAllCountries: false,
            resultType: currentConfig.resultType,
        })
    }, [
        templateConfig,
        actions,
        getRandomTopic,
        getRandomArea,
        getRandomCountry,
        getRandomVowel,
    ])

    const goToPrevious = useCallback(() => {
        const prevIndex =
            currentIndex > 0
                ? currentIndex - 1
                : ALL_TEMPLATE_CONFIGS.length - 1
        navigateToConfig(prevIndex)
    }, [currentIndex, navigateToConfig])

    const goToNext = useCallback(() => {
        const nextIndex =
            currentIndex < ALL_TEMPLATE_CONFIGS.length - 1
                ? currentIndex + 1
                : 0
        navigateToConfig(nextIndex)
    }, [currentIndex, navigateToConfig])

    const goToRandom = useCallback(() => {
        if (!lockParams) {
            // Randomize configuration combination
            const randomIndex = Math.floor(
                Math.random() * ALL_TEMPLATE_CONFIGS.length
            )
            navigateToConfig(randomIndex)
        } else {
            // Randomize current config params only
            regenerateCurrentParams()
        }
    }, [lockParams, navigateToConfig, regenerateCurrentParams])

    // Global keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            // Don't trigger shortcuts if user is typing in an input
            if (
                event.target instanceof HTMLInputElement ||
                event.target instanceof HTMLTextAreaElement ||
                event.target instanceof HTMLSelectElement ||
                (event.target instanceof HTMLElement &&
                    event.target.isContentEditable)
            ) {
                return
            }

            // Don't trigger shortcuts if modifier keys are pressed (Cmd, Ctrl, Alt, Shift)
            if (
                event.metaKey ||
                event.ctrlKey ||
                event.altKey ||
                event.shiftKey
            ) {
                return
            }

            switch (event.key) {
                case "ArrowLeft":
                    event.preventDefault()
                    goToPrevious()
                    break
                case "ArrowRight":
                    event.preventDefault()
                    goToNext()
                    break
                case "l":
                case "L":
                    event.preventDefault()
                    setLockParams((prev: boolean) => !prev)
                    break
                case "r":
                case "R":
                    event.preventDefault()
                    goToRandom()
                    break
                case "z":
                case "Z":
                    event.preventDefault()
                    setZenMode(!isZenMode)
                    break
                case "f":
                case "F":
                    event.preventDefault()
                    openFigmaPopup()
                    break
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [
        goToPrevious,
        goToNext,
        goToRandom,
        setLockParams,
        setZenMode,
        isZenMode,
        openFigmaPopup,
    ])

    if (!currentConfig) {
        return (
            <SearchAsDraft
                className="col-start-2 span-cols-12"
                name="Search Debug Navigator"
            >
                <div className="search-debug-navigator search-debug-navigator--error">
                    Configuration not found in template list
                </div>
            </SearchAsDraft>
        )
    }

    return (
        <SearchAsDraft
            className="col-start-2 span-cols-12"
            name="Search Debug Navigator"
        >
            <div
                className="search-debug-navigator"
                role="toolbar"
                aria-label="Search template configuration navigator"
            >
                <div className="search-debug-navigator__left-controls">
                    <button
                        onClick={goToRandom}
                        className="search-debug-navigator__button"
                        aria-label={
                            !lockParams
                                ? "Go to random configuration (R key)"
                                : "Randomize current configuration parameters (R key)"
                        }
                        title={
                            !lockParams
                                ? "Go to random configuration (R key)"
                                : "Randomize current configuration parameters (R key)"
                        }
                    >
                        {!lockParams
                            ? "📊 Random template"
                            : "🔄 Random content"}
                        <span className="search-debug-navigator__shortcut-hint">
                            (R)
                        </span>
                    </button>
                    <label
                        className="search-debug-navigator__checkbox-label"
                        title="Lock configuration to prevent auto-generation (L key)"
                    >
                        <input
                            type="checkbox"
                            checked={lockParams}
                            onChange={(e) => setLockParams(e.target.checked)}
                            className="search-debug-navigator__checkbox"
                            aria-label="Lock configuration to prevent auto-generation (L key)"
                        />
                        🔒 Lock template for random
                        <span className="search-debug-navigator__shortcut-hint">
                            (L)
                        </span>
                    </label>
                    <label
                        className="search-debug-navigator__checkbox-label"
                        title="Toggle zen mode (Z key)"
                    >
                        <input
                            type="checkbox"
                            checked={isZenMode}
                            onChange={(e) => setZenMode(e.target.checked)}
                            className="search-debug-navigator__checkbox"
                            aria-label="Toggle zen mode (Z key)"
                        />
                        🪷 Zen mode
                        <span className="search-debug-navigator__shortcut-hint">
                            (Z)
                        </span>
                    </label>
                </div>

                <div
                    className="search-debug-navigator__info"
                    role="status"
                    aria-live="polite"
                >
                    <div className="search-debug-navigator__info-row">
                        <div className="search-debug-navigator__primary-controls">
                            <button
                                onClick={goToPrevious}
                                className="search-debug-navigator__button search-debug-navigator__button--outline"
                                aria-label={`Previous configuration (currently ${currentIndex + 1} of ${ALL_TEMPLATE_CONFIGS.length})`}
                                title="Previous configuration (← key)"
                            >
                                (←) Prev
                            </button>

                            <button
                                onClick={goToNext}
                                className="search-debug-navigator__button search-debug-navigator__button--outline"
                                aria-label={`Next configuration (currently ${currentIndex + 1} of ${ALL_TEMPLATE_CONFIGS.length})`}
                                title="Next configuration (→ key)"
                            >
                                Next (→)
                            </button>
                        </div>
                        <div className="search-debug-navigator__description-section">
                            <span
                                className="search-debug-navigator__description"
                                aria-label="Current configuration"
                            >
                                {getConfigDescription(templateConfig)}
                            </span>
                            <span
                                className="search-debug-navigator__counter"
                                aria-label="Configuration position"
                            >
                                {currentIndex + 1} of{" "}
                                {ALL_TEMPLATE_CONFIGS.length}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="search-debug-navigator__figma-section">
                    <button
                        onClick={openFigmaPopup}
                        className="search-debug-navigator__figma-link"
                        aria-label="View current configuration design in Figma popup (F key)"
                        title="Open in Figma popup (F key)"
                    >
                        🎨 Open Figma
                        <span className="search-debug-navigator__shortcut-hint">
                            (F)
                        </span>
                    </button>
                    <label className="search-debug-navigator__checkbox-label">
                        <input
                            type="checkbox"
                            checked={syncFigmaPopup}
                            onChange={(e) =>
                                setSyncFigmaPopup(e.target.checked)
                            }
                            className="search-debug-navigator__checkbox"
                            aria-label="Sync Figma popup with configuration changes"
                        />
                        ⚡ Auto-sync popup
                    </label>
                    <label className="search-debug-navigator__checkbox-label">
                        <input
                            type="checkbox"
                            checked={isFigmaDevMode}
                            onChange={(e) => setFigmaDevMode(e.target.checked)}
                            className="search-debug-navigator__checkbox"
                            aria-label="Toggle Figma dev mode"
                        />
                        🔧 Dev mode
                    </label>
                </div>
            </div>
        </SearchAsDraft>
    )
}
