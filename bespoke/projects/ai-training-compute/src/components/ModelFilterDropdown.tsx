import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"

import { Tippy } from "@ourworldindata/utils"

import { LabeledDropdown } from "../../../../components/LabeledDropdown/LabeledDropdown.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"

import { MAX_RANK_AT_RELEASE, ModelFilter } from "../core/constants.js"

const NOTABLE = "notable"

function optionLabel(rank: number): string {
    if (rank === 1) return "The largest model at its release"
    const label = `The ${rank} largest at their release`
    return rank === 5 ? `${label} (Epoch’s frontier)` : label
}

const OPTIONS = [
    ...Array.from({ length: MAX_RANK_AT_RELEASE }, (_, i) => ({
        value: String(i + 1),
        label: optionLabel(i + 1),
    })),
    { value: NOTABLE, label: "All notable models" },
]

const EXPLANATION = (
    <div className="model-filter__tooltip">
        <p>
            <strong>The largest at their release</strong> keeps each model that
            was among the N largest by training computation of all models
            released up to that day. Epoch AI calls the top 5 &ldquo;frontier
            models&rdquo;.
        </p>
        <p>
            <strong>Notable models</strong> meet Epoch AI&rsquo;s notability
            criteria: state of the art, highly cited, historically important or
            widely used.
        </p>
    </div>
)

/** Which models to plot: the N largest at their release, or all notable ones */
export function ModelFilterDropdown({
    modelFilter,
    onChange,
}: {
    modelFilter: ModelFilter
    onChange: (filter: ModelFilter) => void
}) {
    const { ref, getTippyContainer } = useTippyContainer<HTMLDivElement>()
    return (
        <div ref={ref} className="model-filter">
            <LabeledDropdown
                label="Show"
                className="model-filter__dropdown"
                options={OPTIONS}
                selectedValue={String(modelFilter)}
                onChange={(value) =>
                    onChange(value === NOTABLE ? NOTABLE : Number(value))
                }
            />
            <Tippy
                content={EXPLANATION}
                appendTo={getTippyContainer}
                theme="light"
                placement="bottom-start"
                maxWidth={320}
            >
                <button
                    type="button"
                    className="model-filter__info"
                    aria-label="How are the models picked?"
                >
                    <FontAwesomeIcon icon={faCircleInfo} />
                </button>
            </Tippy>
        </div>
    )
}
