import { useMemo, useState } from "react"
import cx from "classnames"
import { AsDraft } from "../AsDraft/AsDraft.js"
import { useSearchContext } from "./SearchContext.js"
import {
    SearchResultType,
    SearchTopicType,
    TemplateConfig,
} from "./searchTypes.js"
import { useSelectedTopic, useSelectedCountryNames } from "./searchHooks.js"
import { countriesByName } from "@ourworldindata/utils"

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
    const [lockParams, setLockParams] = useState(false)
    const selectedTopic = useSelectedTopic()
    const selectedCountryNames = useSelectedCountryNames()

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

    const currentConfig =
        currentIndex >= 0 ? ALL_TEMPLATE_CONFIGS[currentIndex] : null

    // Get random country, topic, area, and vowel
    const getRandomCountry = () => {
        return availableCountries[
            Math.floor(Math.random() * availableCountries.length)
        ]
    }

    const getRandomTopic = () => {
        return availableTopics[
            Math.floor(Math.random() * availableTopics.length)
        ]
    }

    const getRandomArea = () => {
        return availableAreas[Math.floor(Math.random() * availableAreas.length)]
    }

    const getRandomVowel = () => {
        return VOWELS[Math.floor(Math.random() * VOWELS.length)]
    }

    const navigateToConfig = (targetIndex: number) => {
        if (targetIndex < 0 || targetIndex >= ALL_TEMPLATE_CONFIGS.length)
            return

        const targetConfig = ALL_TEMPLATE_CONFIGS[targetIndex]

        // Reset the state first
        actions.reset()

        // Set result type
        actions.setResultType(targetConfig.resultType)

        // Set topic if needed (only generate if params are not locked)
        if (targetConfig.topicType === SearchTopicType.Topic && !lockParams) {
            const randomTopic = getRandomTopic()
            actions.setTopic(randomTopic)
        } else if (
            targetConfig.topicType === SearchTopicType.Area &&
            !lockParams
        ) {
            const randomArea = getRandomArea()
            actions.setTopic(randomArea)
        }

        // Set country if needed (only generate if params are not locked)
        if (targetConfig.hasCountry && !lockParams) {
            const randomCountry = getRandomCountry()
            actions.addCountry(randomCountry)
        }

        // Set query if needed (only generate if params are not locked)
        if (targetConfig.hasQuery && !lockParams) {
            const randomVowel = getRandomVowel()
            actions.setQuery(randomVowel)
        }
    }

    const goToPrevious = () => {
        const prevIndex =
            currentIndex > 0
                ? currentIndex - 1
                : ALL_TEMPLATE_CONFIGS.length - 1
        navigateToConfig(prevIndex)
    }

    const goToNext = () => {
        const nextIndex =
            currentIndex < ALL_TEMPLATE_CONFIGS.length - 1
                ? currentIndex + 1
                : 0
        navigateToConfig(nextIndex)
    }

    const goToRandom = () => {
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
    }

    const regenerateCurrentParams = () => {
        const currentConfig = templateConfig

        // Regenerate topic if needed
        if (currentConfig.topicType === SearchTopicType.Topic) {
            const randomTopic = getRandomTopic()
            actions.setTopic(randomTopic)
        } else if (currentConfig.topicType === SearchTopicType.Area) {
            const randomArea = getRandomArea()
            actions.setTopic(randomArea)
        }

            // Don't trigger shortcuts if modifier keys are pressed (Cmd, Ctrl, Alt, Shift)
            if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
                return
            }

        // Regenerate country if needed
        if (currentConfig.hasCountry) {
            // Remove all current countries
            for (const countryName of selectedCountryNames) {
                actions.removeCountry(countryName)
            }
            const randomCountry = getRandomCountry()
            actions.addCountry(randomCountry)
        }

        // Regenerate query if needed
        if (currentConfig.hasQuery) {
            const randomVowel = getRandomVowel()
            actions.setQuery(randomVowel)
        }
    }

    if (!currentConfig) {
        return (
            <AsDraft
                className="col-start-2 span-cols-12"
                name="Search Debug Navigator"
            >
                <div className="search-debug-navigator search-debug-navigator--error">
                    Configuration not found in template list
                </div>
            </AsDraft>
        )
    }

    return (
        <AsDraft
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
                                ? "Go to random configuration"
                                : "Randomize current configuration parameters"
                        }
                        title={
                            !lockParams
                                ? "Random configuration"
                                : "Randomize params"
                        }
                    >
                        🔄 Random
                    </button>
                    <label className="search-debug-navigator__checkbox-label">
                        <input
                            type="checkbox"
                            checked={lockParams}
                            onChange={(e) => setLockParams(e.target.checked)}
                            className="search-debug-navigator__checkbox"
                            aria-label="Lock configuration to prevent auto-generation"
                        />
                        🔒 Lock configuration
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
                                title="Previous configuration"
                            >
                                ← Prev
                            </button>

                            <button
                                onClick={goToNext}
                                className="search-debug-navigator__button search-debug-navigator__button--outline"
                                aria-label={`Next configuration (currently ${currentIndex + 1} of ${ALL_TEMPLATE_CONFIGS.length})`}
                                title="Next configuration"
                            >
                                Next →
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

                <a
                    href={`https://www.figma.com/file/lAIoPy94qgSocFKYO6HBTh/?node-id=${currentConfig.figmaNodeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="search-debug-navigator__figma-link"
                    aria-label="View current configuration design in Figma (opens in new tab)"
                    title="View in Figma"
                >
                    🎨 Figma
                </a>
            </div>
        </AsDraft>
    )
}
