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
    color: "#6e87a2",
}

const BLOCK_TEMPLATE = [["core/paragraph", { placeholder: "Enter content..." }]]

const KeyInsightsSlider = {
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
                    <PanelBody title="Key insights slider" initialOpen={true}>
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
                    />
                    <InnerBlocks template={BLOCK_TEMPLATE} />
                </div>
            </>
        )
    },
    save: (props) => <InnerBlocks.Content />,
}

export const registerKeyInsightsSlider = () => {
    registerBlockType(block.name, KeyInsightsSlider)
}
