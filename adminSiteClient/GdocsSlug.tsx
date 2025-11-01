import { Col, Input, Row, Space, Switch } from "antd"
import { useEffect, useState } from "react"
import { slugify, OwidGdocErrorMessage, OwidGdoc } from "@ourworldindata/utils"
import { Help } from "./Forms.js"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"

export const GdocsSlug = <T extends OwidGdoc>({
    gdoc,
    setCurrentGdoc,
    errors,
    subdirectory,
}: {
    gdoc: T
    setCurrentGdoc: (gdoc: T) => void
    errors?: OwidGdocErrorMessage[]
    subdirectory?: string
}) => {
    const [isSlugSyncing, setSlugSyncing] = useState(false)
    const {
        content: { title = "" },
        slug,
    } = gdoc
    const slugFromTitle = slugify(title, true)

    useEffect(() => {
        if (!slug || slugFromTitle === slug) {
            setSlugSyncing(true)
        }
    }, [slug, slugFromTitle])

    const setSlug = (slug: string) => {
        setCurrentGdoc({ ...gdoc, slug })
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
                        addonBefore={`ourworldindata.org/${subdirectory ? subdirectory : ""}`}
                        value={slug}
                        onChange={(e) => setSlug(slugify(e.target.value, true))}
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
                    </Help>
                </Col>
            </Row>
        </>
    )
}
