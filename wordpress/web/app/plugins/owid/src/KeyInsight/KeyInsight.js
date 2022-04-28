import {
    InnerBlocks,
    InspectorControls,
    useBlockProps,
    RichText,
} from "@wordpress/block-editor"
import {
    PanelBody,
    PanelRow,
    ToggleControl,
    TextControl,
} from "@wordpress/components"
import { useState, useEffect } from "@wordpress/element"
import { registerBlockType } from "@wordpress/blocks"
import block from "./block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
    marginBottom: "1rem",
}

const BLOCK_TEMPLATE = [
    ["core/paragraph", { placeholder: "Enter key insight content..." }],
]

const KeyInsight = {
    edit: ({ attributes: { anchor = "", title }, setAttributes }) => {
        const [isAnchorLocked, setAnchorLocked] = useState(true)
        const blockProps = useBlockProps({ style: blockStyle })

        const onChangeTitle = (newTitle) => {
            setAttributes({ title: newTitle })
            if (isAnchorLocked) return
            setAttributes({ anchor: newTitle })
        }

        useEffect(() => {
            if (!title || !anchor) {
                setAnchorLocked(false)
            }
        }, [])

        return (
            <>
                <InspectorControls>
                    <PanelBody title="Key insight" initialOpen={true}>
                        <PanelRow>
                            <TextControl
                                label="Anchor"
                                value={anchor}
                                onChange={(newAnchor) =>
                                    setAttributes({ anchor: newAnchor })
                                }
                                disabled={isAnchorLocked}
                            />
                        </PanelRow>
                        <PanelRow>
                            <ToggleControl
                                label={`Anchor ${
                                    !isAnchorLocked ? "un" : ""
                                }locked`}
                                help={
                                    !isAnchorLocked &&
                                    "Updating to the title will update the anchor"
                                }
                                checked={!isAnchorLocked}
                                onChange={(state) => {
                                    setAnchorLocked(!state)
                                }}
                            />
                        </PanelRow>
                    </PanelBody>
                </InspectorControls>
                <div {...blockProps}>
                    <RichText
                        tagName="h4"
                        onChange={onChangeTitle}
                        value={title}
                        // withoutInteractiveFormatting <-- doesn't remove bold and italic formatting
                        allowedFormats={[]}
                        placeholder="Enter key insight title..."
                    />
                    <InnerBlocks template={BLOCK_TEMPLATE} />
                </div>
            </>
        )
    },
    save: (props) => <InnerBlocks.Content />,
}

export const registerKeyInsight = () => {
    registerBlockType(block.name, KeyInsight)
}
