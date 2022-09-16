import { Input, Switch } from "antd"
import React, { useEffect, useState } from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { slugify } from "../clientUtils/Util.js"
import { ErrorMessage } from "./gdocsValidation.js"

export const GdocsSlug = ({
    gdoc,
    setGdoc,
    error,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    error?: ErrorMessage
}) => {
    const [isSlugSyncing, setSlugSyncing] = useState(false)
    const { title, slug } = gdoc
    const slugFromTitle = slugify(title)

    useEffect(() => {
        if (!title || !slug) {
            setSlugSyncing(true)
        }
    }, [title, slug])

    const setSlug = (slug: string) => {
        setGdoc({ ...gdoc, slug })
    }

    useEffect(() => {
        if (!isSlugSyncing) return
        setSlug(slugFromTitle)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slugFromTitle, isSlugSyncing])

    return (
        <Input.Group>
            <Input
                addonBefore="https://ourworldindata.org/"
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                placeholder="much-better-awful-can-be-better"
                required
                status={!!error ? "error" : ""}
                disabled={!isSlugSyncing}
            />
            {`Status: ${
                slug === slugFromTitle
                    ? "in sync with title"
                    : "out of sync with title"
            }`}
            "Sync with title"
            <Switch
                checked={isSlugSyncing}
                onChange={(checked) => {
                    setSlugSyncing(checked)
                    if (checked) setSlug(slugFromTitle)
                }}
            />
            {!isSlugSyncing
                ? "⚠️ Before syncing consider how changing the anchor might break exisiting links (internal or external). Unless the block has been published recently, it is generally advised to keep this turned off."
                : "Updating to the title will update the anchor. Overriding the anchor manually is possible."}
        </Input.Group>
    )
}
