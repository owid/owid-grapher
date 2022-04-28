import {
    InnerBlocks,
    InspectorControls,
    useBlockProps,
    RichText,
} from "@wordpress/block-editor"
import { PanelBody } from "@wordpress/components"
import { registerBlockType } from "@wordpress/blocks"
import SyncingAnchorSettings from "../SyncingAnchorSettings/SyncingAnchorSettings"
import block from "./block.json"
import keyInsightBlock from "../KeyInsight/block.json"

const blockStyle = {
    border: "1px dashed lightgrey",
    padding: "0 1rem",
}

const BLOCK_TEMPLATE = [
    [keyInsightBlock.name],
    [keyInsightBlock.name],
    ["core/paragraph"],
]

const KeyInsightsSlider = {
    edit: ({
        attributes: { slug = "key-insights", title = "Key insights" },
        setAttributes,
    }) => {
        const blockProps = useBlockProps({ style: blockStyle })

        const onChangeTitle = (newTitle) => {
            setAttributes({ title: newTitle })
        }

        const updateSlug = (newSlug) => {
            setAttributes({ slug: newSlug })
        }

        return (
            <>
                <InspectorControls>
                    <PanelBody title="Key insights slider" initialOpen={true}>
                        <SyncingAnchorSettings
                            updateSlug={updateSlug}
                            rawTitle={title}
                            slug={slug}
                        />
                    </PanelBody>
                </InspectorControls>
                <div {...blockProps}>
                    <RichText
                        tagName="h3"
                        onChange={onChangeTitle}
                        value={title}
                        // withoutInteractiveFormatting <-- doesn't remove bold and italic formatting
                        allowedFormats={[]} // update SyncAnchorSettings to handle HTML if allowing formatting here
                        placeholder="Enter title of the key insights block..."
                    />
                    <InnerBlocks
                        allowedBlocks={[keyInsightBlock.name]}
                        template={BLOCK_TEMPLATE}
                    />
                </div>
            </>
        )
    },
    save: (props) => <InnerBlocks.Content />,
}

export const registerKeyInsightsSlider = () => {
    registerBlockType(block.name, KeyInsightsSlider)
}
