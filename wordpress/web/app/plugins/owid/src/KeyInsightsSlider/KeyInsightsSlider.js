import {
    InnerBlocks,
    InspectorControls,
    useBlockProps,
    RichText,
} from "@wordpress/block-editor"
import { PanelBody } from "@wordpress/components"
import { registerBlockType } from "@wordpress/blocks"
import { useEffect } from "@wordpress/element"
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

const DEFAULT_TITLE = "Key insights"
const DEFAULT_SLUG = "key-insights"

const KeyInsightsSlider = {
    edit: ({ attributes: { slug, title }, setAttributes }) => {
        const blockProps = useBlockProps({ style: blockStyle })

        const onChangeTitle = (newTitle) => {
            setAttributes({ title: newTitle })
        }

        const updateSlug = (newSlug) => {
            setAttributes({ slug: newSlug })
        }

        useEffect(() => {
            if (!title && !slug) {
                setAttributes({ title: DEFAULT_TITLE, slug: DEFAULT_SLUG })
            }
        }, [title, slug])

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
                        tagName="h2"
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
