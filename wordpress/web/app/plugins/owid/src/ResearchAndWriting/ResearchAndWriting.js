import { InnerBlocks, useBlockProps } from "@wordpress/block-editor"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
    // see style.css for additional editor styles
}

const BLOCK_TEMPLATE = [
    [
        "core/group",
        { className: "wp-block-research-and-writing" },
        [
            [
                "core/heading",
                {
                    level: 2,
                    content: "Research & Writing",
                    anchor: "research-and-writing",
                },
            ],
            [
                "core/group",
                { className: "research-and-writing__top" },
                [
                    ["owid/card"],
                    [
                        "core/group",
                        { className: "research-and-writing__top-right" },
                        [
                            ["owid/card"],
                            [
                                "core/group",
                                {},
                                [
                                    [
                                        "core/group",
                                        {
                                            className:
                                                "research-and-writing__shorts",
                                        },
                                        [
                                            [
                                                "core/heading",
                                                { level: 5, content: "shorts" },
                                            ],
                                            [
                                                "core/group",
                                                {},
                                                [
                                                    [
                                                        "core/heading",
                                                        { level: 6 },
                                                    ],
                                                    ["core/paragraph"],
                                                ],
                                            ],
                                            [
                                                "core/group",
                                                {},
                                                [
                                                    [
                                                        "core/heading",
                                                        { level: 6 },
                                                    ],
                                                    ["core/paragraph"],
                                                ],
                                            ],
                                            [
                                                "core/group",
                                                {},
                                                [
                                                    [
                                                        "core/heading",
                                                        { level: 6 },
                                                    ],
                                                    ["core/paragraph"],
                                                ],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ],
            ],
            ["core/heading", { level: 4 }],
            [
                "owid/grid",
                { className: "research-and-writing__sub-category" },
                [["owid/card"], ["owid/card"], ["owid/card"], ["owid/card"]],
            ],
            ["core/heading", { level: 4 }],
            [
                "owid/grid",
                { className: "research-and-writing__sub-category" },
                [["owid/card"], ["owid/card"], ["owid/card"], ["owid/card"]],
            ],
        ],
    ],
]

const ResearchAndWriting = {
    edit: () => {
        const blockProps = useBlockProps({ style: blockStyle })

        return (
            <div {...blockProps}>
                <InnerBlocks template={BLOCK_TEMPLATE} />
            </div>
        )
    },
    save: () => <InnerBlocks.Content />,
}

export const registerResearchAndWriting = () => {
    registerBlockType(block.name, ResearchAndWriting)
}
