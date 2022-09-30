import { Col, Input, Row, Space, Switch } from "antd"
import React, { useEffect, useState } from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { slugify } from "../clientUtils/Util.js"
import { Help } from "./Forms.js"
import {
    ErrorMessage,
    getPropertyMostCriticalError,
} from "./gdocsValidation.js"

export const GdocsSlug = ({
    gdoc,
    setGdoc,
    errors,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    errors?: ErrorMessage[]
}) => {
    const [isSlugSyncing, setSlugSyncing] = useState(false)
    const {
        content: { title },
        slug,
    } = gdoc
    const slugFromTitle = slugify(title)

    useEffect(() => {
        if (gdoc.published) {
            setSlugSyncing(false)
        }
    }, [gdoc.published])

    useEffect(() => {
        if (!slug) {
            setSlugSyncing(true)
        }
    }, [slug])

    const setSlug = (slug: string) => {
        setGdoc({ ...gdoc, slug })
    }

    useEffect(() => {
        if (!isSlugSyncing) return
        setSlug(slugFromTitle)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [slugFromTitle, isSlugSyncing])

    return (
        <>
            <label htmlFor="slug">Slug</label>
            <Row gutter={24}>
                <Col span={16}>
                    <Input
                        addonBefore="ourworldindata.org/"
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        placeholder={slugFromTitle}
                        required
                        status={
                            getPropertyMostCriticalError("slug", errors)?.type
                        }
                        disabled={isSlugSyncing}
                        id="slug"
                    />
                </Col>
                <Col span={8}>
                    <Space>
                        <Switch
                            checked={isSlugSyncing}
                            onChange={(checked) => {
                                setSlugSyncing(checked)
                                if (checked) setSlug(slugFromTitle)
                            }}
                            id="slug-sync"
                        />
                        <label htmlFor="slug-sync" style={{ marginBottom: 0 }}>
                            Sync with title
                        </label>
                    </Space>
                    <Help>
                        {isSlugSyncing
                            ? "Updating the title updates the slug."
                            : "Unlock to update the slug from the title."}
                        {gdoc.published && (
                            <>
                                <br />ⓘ This setting is not saved to prevent the
                                creation of unncessary redirects.
                            </>
                        )}
                    </Help>
                </Col>
            </Row>
        </>
    )
}
