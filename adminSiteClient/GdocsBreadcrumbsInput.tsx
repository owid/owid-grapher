import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    BreadcrumbItem,
    OwidGdocErrorMessage,
    OwidGdocInterface,
} from "@ourworldindata/utils"
import { Button, Col, Input, Row } from "antd"
import React from "react"

export const BreadcrumbLine = ({
    item,
    setItem,
    removeItem,
    isLastBreadcrumbItem,
}: {
    item: BreadcrumbItem
    setItem: (item: BreadcrumbItem) => void
    removeItem: () => void
    isLastBreadcrumbItem?: boolean
}) => {
    return (
        <div className="my-2">
            <Row gutter={8}>
                <Col span={11}>
                    <Input
                        addonBefore="URL"
                        value={
                            isLastBreadcrumbItem
                                ? "The last breadcrumb isn't clickable"
                                : item.href
                        }
                        onChange={(e) =>
                            setItem({ ...item, href: e.target.value })
                        }
                        disabled={isLastBreadcrumbItem}
                    />
                </Col>
                <Col span={11}>
                    <Input
                        addonBefore="Label"
                        value={item.label}
                        onChange={(e) =>
                            setItem({ ...item, label: e.target.value })
                        }
                        placeholder={
                            isLastBreadcrumbItem
                                ? "Concise version of the article's title"
                                : undefined
                        }
                    />
                </Col>
                <Col span={2}>
                    <Button danger onClick={removeItem}>
                        <FontAwesomeIcon icon={faTrash} />
                    </Button>
                </Col>
            </Row>
        </div>
    )
}

export const GdocsBreadcrumbsInput = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocInterface
    setCurrentGdoc: (gdoc: OwidGdocInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    const setBreadcrumbs = (breadcrumbs: BreadcrumbItem[] | undefined) => {
        if (breadcrumbs?.length) {
            // The last breadcrumb is not clickable, so we don't need a URL
            breadcrumbs[breadcrumbs.length - 1].href = undefined
        } else breadcrumbs = undefined

        setCurrentGdoc({ ...gdoc, breadcrumbs })
    }

    const setItemAtIndex = (item: BreadcrumbItem, i: number) => {
        const breadcrumbs = [...(gdoc.breadcrumbs ?? [])]
        breadcrumbs[i] = item
        setBreadcrumbs(breadcrumbs)
    }

    const removeItemAtIndex = (i: number) => {
        const breadcrumbs = [...(gdoc.breadcrumbs ?? [])]
        breadcrumbs.splice(i, 1)
        setBreadcrumbs(breadcrumbs)
    }

    return (
        <div className="form-group">
            <div className="d-flex justify-content-between">
                Breadcrumbs
                <Button
                    type="dashed"
                    onClick={() =>
                        setBreadcrumbs([
                            { label: "" },
                            ...(gdoc.breadcrumbs ?? []),
                        ])
                    }
                >
                    <FontAwesomeIcon icon={faPlus} className="mr-1" /> Add
                    breadcrumb
                </Button>
            </div>
            {gdoc.breadcrumbs?.map((item, i) => (
                <BreadcrumbLine
                    item={item}
                    setItem={(item) => setItemAtIndex(item, i)}
                    removeItem={() => removeItemAtIndex(i)}
                    key={i}
                    isLastBreadcrumbItem={i === gdoc.breadcrumbs!.length - 1}
                />
            ))}
            {!gdoc.breadcrumbs?.length && <i>No breadcrumbs</i>}
        </div>
    )
}
