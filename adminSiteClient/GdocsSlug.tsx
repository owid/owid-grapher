import { faLink } from "@fortawesome/free-solid-svg-icons/faLink"
import { faUnlink } from "@fortawesome/free-solid-svg-icons/faUnlink"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { Col, Input, Row, Space, Switch, Tooltip } from "antd"
import React, { useEffect, useState } from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { slugify } from "../clientUtils/Util.js"
import { Help } from "./Forms.js"
import { ErrorMessage, getValidationStatus } from "./gdocsValidation.js"

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
        <>
            <label htmlFor="slug">Slug</label>
            <Row gutter={24}>
                <Col span={12}>
                    <Input
                        addonBefore="https://ourworldindata.org/"
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value))}
                        placeholder={slugFromTitle}
                        required
                        status={getValidationStatus("slug", errors)}
                        disabled={!isSlugSyncing}
                        id="slug"
                        suffix={
                            <>
                                <SlugTitleLink
                                    slug={slug}
                                    setSlug={setSlug}
                                    slugFromTitle={slugFromTitle}
                                    isSlugSyncing={isSlugSyncing}
                                />
                            </>
                        }
                    />
                </Col>
                <Col span={12}>
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
                            {isSlugSyncing ? "Updates from title" : "Locked"}
                        </label>
                    </Space>
                    <Help>
                        {isSlugSyncing ? (
                            "Updating the title updates the slug. Manual overrides are possible."
                        ) : (
                            <>
                                Unlock to update the slug from the title <br />
                                ⚠️ Before unlocking, consider how this might
                                break exisiting links. Unless the article hasn't
                                been published yet, it is generally advised to
                                keep this turned off.
                            </>
                        )}
                    </Help>
                </Col>
            </Row>
        </>
    )
}

const SlugTitleLink = ({
    slug,
    slugFromTitle,
    isSlugSyncing,
    setSlug,
}: {
    slug: string
    slugFromTitle: string
    isSlugSyncing: boolean
    setSlug: (slug: string) => void
}) => {
    return slug === slugFromTitle ? (
        <Tooltip title="In sync with title">
            <span>
                <FontAwesomeIcon icon={faLink} />
            </span>
        </Tooltip>
    ) : isSlugSyncing ? (
        <Tooltip title="Click to sync with title">
            <span
                onClick={() => setSlug(slugFromTitle)}
                style={{ cursor: "pointer" }}
            >
                <FontAwesomeIcon icon={faUnlink} />
            </span>
        </Tooltip>
    ) : (
        <FontAwesomeIcon icon={faUnlink} />
    )
}
