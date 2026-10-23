import { useState } from "react"
import { faGear } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    AI_SEARCH_POOL_SIZES,
    AiSearchEffort,
    AiSearchModel,
    AiSearchPoolSize,
    getAiSearchPagePoolSize,
} from "@ourworldindata/types"
import { AiSearchPageSettings, useAiSearchSettings } from "./aiSearchClient.js"

const MODEL_LABELS: Record<AiSearchModel, string> = {
    "claude-haiku-5-5": "Haiku 5.5: fastest",
    "claude-sonnet-5-5": "Sonnet 5.5: balanced",
    "claude-opus-5-5": "Opus 5.5: most capable, slowest",
}

const EFFORT_LABELS: Record<AiSearchEffort, string> = {
    low: "Low: faster",
    medium: "Medium",
    high: "High: slower",
}

type FlagSetting = keyof {
    [
        K in keyof AiSearchPageSettings as AiSearchPageSettings[K] extends boolean
            ? K
            : never
    ]: true
}

const FLAG_LABELS: [FlagSetting, string][] = [
    [
        "expand",
        "Query expansion: a quick Haiku call suggests extra keyword searches (breakdowns, correlates) before grouping. Adds about 2 seconds.",
    ],
    [
        "cache",
        "Reuse answers for repeated searches (5 minutes). Turn off to see a fresh answer each time.",
    ],
    ["debug", "Show timings and raw model output under the AI results"],
    [
        "teaser",
        "Also offer AI search above the standard results (as well as in the dropdown)",
    ],
]

/**
 * Settings for comparing versions of the AI search prototype. Not part of the
 * design being tested, hence the deliberately different look.
 */
export const SearchAiSettingsPanel = () => {
    const [isOpen, setIsOpen] = useState(false)
    const [settings, update] = useAiSearchSettings()

    return (
        <>
            <button
                type="button"
                className="search-ai-settings-toggle"
                aria-expanded={isOpen}
                aria-controls="search-ai-settings"
                onClick={() => setIsOpen(!isOpen)}
            >
                <FontAwesomeIcon icon={faGear} />
                Prototype settings
            </button>
            {isOpen && (
                <aside
                    id="search-ai-settings"
                    className="search-ai-settings"
                    aria-label="Prototype settings"
                >
                    <h2 className="search-ai-settings__title">
                        Prototype settings
                    </h2>
                    <p className="search-ai-settings__note">
                        Not part of the design being tested. Use these to
                        compare versions of the AI search.
                    </p>
                    <label className="search-ai-settings__field">
                        <span>Model that groups the results</span>
                        <select
                            value={settings.model}
                            onChange={(e) =>
                                update({
                                    model: e.target.value as AiSearchModel,
                                })
                            }
                        >
                            {Object.entries(MODEL_LABELS).map(
                                ([model, label]) => (
                                    <option key={model} value={model}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                    </label>
                    <label className="search-ai-settings__field">
                        <span>Thinking effort</span>
                        <select
                            value={settings.effort}
                            onChange={(e) =>
                                update({
                                    effort: e.target.value as AiSearchEffort,
                                })
                            }
                        >
                            {Object.entries(EFFORT_LABELS).map(
                                ([effort, label]) => (
                                    <option key={effort} value={effort}>
                                        {label}
                                    </option>
                                )
                            )}
                        </select>
                        <small>
                            Haiku answers without thinking, so effort only
                            affects Sonnet and Opus.
                        </small>
                    </label>
                    <label className="search-ai-settings__field">
                        <span>Candidate pool sent to the model</span>
                        <select
                            value={settings.pool}
                            onChange={(e) =>
                                update({
                                    pool: Number(
                                        e.target.value
                                    ) as AiSearchPoolSize,
                                })
                            }
                        >
                            {AI_SEARCH_POOL_SIZES.map((pool) => (
                                <option key={pool} value={pool}>
                                    {pool} charts,{" "}
                                    {getAiSearchPagePoolSize(pool)} articles
                                </option>
                            ))}
                        </select>
                    </label>
                    {FLAG_LABELS.map(([key, label]) => (
                        <label key={key} className="search-ai-settings__check">
                            <input
                                type="checkbox"
                                checked={settings[key]}
                                onChange={(e) =>
                                    update({ [key]: e.target.checked })
                                }
                            />
                            <span>{label}</span>
                        </label>
                    ))}
                </aside>
            )}
        </>
    )
}
