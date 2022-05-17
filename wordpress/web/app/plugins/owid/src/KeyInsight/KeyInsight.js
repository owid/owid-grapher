import {
    InnerBlocks,
    InspectorControls,
    useBlockProps,
    RichText,
} from "@wordpress/block-editor"
import { PanelBody, PanelRow, ToggleControl } from "@wordpress/components"
import SyncingAnchorSettings from "../SyncingAnchorSettings/SyncingAnchorSettings"
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
    edit: ({
        attributes: { slug = "", title, isTitleHidden = false },
        setAttributes,
    }) => {
        const blockProps = useBlockProps({ style: blockStyle })

        const onChangeTitle = (newTitle) => {
            setAttributes({ title: newTitle })
        }

        const updateSlug = (newSlug) => {
            setAttributes({ slug: newSlug })
        }

        const updateTitleHidden = (newState) => {
            setAttributes({ isTitleHidden: newState })
        }

        return (
            <>
                <InspectorControls>
                    <PanelBody title="Key insight" initialOpen={true}>
                        <SyncingAnchorSettings
                            updateSlug={updateSlug}
                            rawTitle={title}
                            slug={slug}
                        />
                        <PanelRow>
                            <ToggleControl
                                label={"Hide title"}
                                help="Hide title in slide content"
                                checked={isTitleHidden}
                                onChange={updateTitleHidden}
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
                        allowedFormats={[]} // update SyncAnchorSettings to handle HTML if allowing formatting here
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
