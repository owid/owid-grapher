import React from "react"
import { render } from "react-dom"
import { createTagsPlugin } from "@algolia/autocomplete-plugin-tags"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark"
import { flag } from "country-emoji"
import { faChartLine } from "@fortawesome/free-solid-svg-icons/faChartLine"

export const createShowTagsPlugin = () =>
    createTagsPlugin({
        getTagsSubscribers() {
            return [
                {
                    sourceId: "tags",
                    getTag({ item }: any) {
                        return item
                    },
                },
                {
                    sourceId: "countryTags",
                    getTag({ item }: any) {
                        return {
                            ...item,
                            label: `${flag(item.title)} ${item.title}`,
                        }
                    },
                },
                {
                    sourceId: "chartTags",
                    getTag({ item }: any) {
                        return {
                            ...item,
                            label: (
                                <>
                                    <FontAwesomeIcon icon={faChartLine} />{" "}
                                    {item.title}
                                </>
                            ),
                        }
                    },
                },
            ]
        },
        onChange({ tags, setIsOpen }) {
            requestAnimationFrame(() => {
                setIsOpen(false)
                const container = document.querySelector(
                    ".aa-InputWrapperPrefix"
                )
                const oldTagsContainer = document.querySelector(".aa-Tags")

                const tagsContainer = document.createElement("div")
                tagsContainer.classList.add("aa-Tags")
                tagsContainer.dataset["autocompleteSourceId"] = "tagsPlugin"

                render(
                    <ul className="aa-List">
                        {tags.map(({ label, remove }) => (
                            <TagItem
                                key={label}
                                label={label}
                                onRemove={() => {
                                    remove()
                                    // requestAnimationFrame(() => setIsOpen(true))
                                }}
                            />
                        ))}
                    </ul>,
                    tagsContainer
                )

                if (oldTagsContainer) {
                    container?.removeChild(oldTagsContainer)
                }

                container?.appendChild(tagsContainer)
            })
        },
        transformSource() {
            return undefined
        },
    })

function TagItem({
    label,
    onRemove,
}: {
    label: string
    onRemove: VoidFunction
}) {
    const [selected, setSelected] = React.useState(false)

    return (
        <li
            className="aa-Item"
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setSelected(true)}
            onMouseLeave={() => setSelected(false)}
        >
            <div className="aa-TagsPlugin-Tag">
                <span className="aa-TagsPlugin-TagLabel" onClick={onRemove}>
                    {label}
                </span>
                <button
                    className="aa-TagsPlugin-RemoveButton"
                    title="Remove this tag"
                    onClick={onRemove}
                    style={{ border: "none", background: "none" }}
                >
                    <FontAwesomeIcon icon={faXmark} />
                </button>
            </div>
        </li>
    )
}
