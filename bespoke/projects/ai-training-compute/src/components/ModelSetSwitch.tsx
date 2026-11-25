import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"

import { Tippy } from "@ourworldindata/utils"

import { Switcher } from "../../../../components/Switcher/Switcher.js"
import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"

import { MODEL_SETS, ModelSet } from "../core/constants.js"

const LABELS: Record<ModelSet, string> = {
    frontier: "Frontier models",
    notable: "Notable models",
}

const EXPLANATION = (
    <div className="model-set-switch__tooltip">
        <p>
            <strong>Frontier models</strong> were among the top 5 by training
            computation when they were released.
        </p>
        <p>
            <strong>Notable models</strong> meet Epoch AI&rsquo;s notability
            criteria: state of the art, highly cited, historically important or
            widely used.
        </p>
    </div>
)

/** Epoch's two views of the data, with what each means in a tooltip */
export function ModelSetSwitch({
    modelSet,
    onChange,
}: {
    modelSet: ModelSet
    onChange: (set: ModelSet) => void
}) {
    const { ref, getTippyContainer } = useTippyContainer<HTMLDivElement>()
    return (
        <div ref={ref} className="model-set-switch">
            <Switcher
                ariaLabel="Which models to show"
                items={MODEL_SETS.map((set) => ({
                    key: set,
                    element: LABELS[set],
                }))}
                selectedKey={modelSet}
                onChange={onChange}
            />
            <Tippy
                content={EXPLANATION}
                appendTo={getTippyContainer}
                theme="light"
                placement="bottom-start"
                maxWidth={300}
            >
                <button
                    type="button"
                    className="model-set-switch__info"
                    aria-label="What are frontier and notable models?"
                >
                    <FontAwesomeIcon icon={faCircleInfo} />
                </button>
            </Tippy>
        </div>
    )
}
