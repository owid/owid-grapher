import { PanelRow, ToggleControl, TextControl } from "@wordpress/components"
import { useState, useEffect } from "@wordpress/element"
import { deburr } from "lodash"

const SyncingAnchorSettings = ({ rawTitle, slug, updateSlug }) => {
    const [isAnchorSyncing, setAnchorSyncing] = useState(false)
    const slugFromTitle = getSlug(rawTitle)

    useEffect(() => {
        if (!rawTitle || !slug) {
            setAnchorSyncing(true)
        }
    }, [])

    useEffect(() => {
        if (!isAnchorSyncing) return
        updateSlug(slugFromTitle)
    }, [rawTitle])

    return (
        <>
            <PanelRow>
                <TextControl
                    label="Anchor"
                    value={slug}
                    onChange={updateSlug}
                    disabled={!isAnchorSyncing}
                    help={`Status: ${
                        slug === slugFromTitle
                            ? "in sync with title"
                            : "out of sync with title"
                    }`}
                />
            </PanelRow>
            <PanelRow>
                <ToggleControl
                    label={"Sync with title"}
                    help={
                        !isAnchorSyncing
                            ? "⚠️ Before syncing consider how changing the anchor might break exisiting links (internal or external). Unless the block has been published recently, it is generally advised to keep this turned off."
                            : "Updating to the title will update the anchor. Overriding the anchor manually is possible."
                    }
                    checked={isAnchorSyncing}
                    onChange={(newState) => {
                        setAnchorSyncing(newState)
                        if (newState) updateSlug(slugFromTitle)
                    }}
                />
            </PanelRow>
        </>
    )
}

/**
 * Get the slug from raw text (no HTML)
 *
 * Inspired by https://github.com/WordPress/gutenberg/blob/trunk/packages/block-library/src/heading/autogenerate-anchors.js
 *
 * @param {string} rawText
 *
 * @return {string} Returns the slug.
 */
const getSlug = (rawText) => {
    return deburr(rawText)
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .toLowerCase()
}

export default SyncingAnchorSettings
