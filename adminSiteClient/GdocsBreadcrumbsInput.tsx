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
}: {
    item: BreadcrumbItem
    setItem: (item: BreadcrumbItem) => void
    removeItem: () => void
}) => {
    return (
        <div className="my-2">
            <Row gutter={8}>
                <Col span={11}>
                    <Input
                        addonBefore="URL"
                        value={item.href}
                        onChange={(e) =>
                            setItem({ ...item, href: e.target.value })
                        }
                    />
                </Col>
                <Col span={11}>
                    <Input
                        addonBefore="Label"
                        value={item.label}
                        onChange={(e) =>
                            setItem({ ...item, label: e.target.value })
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
    const setBreadcrumbs = (breadcrumbs: BreadcrumbItem[]) =>
        setCurrentGdoc({ ...gdoc, breadcrumbs })

    const setItemAtIndex = (item: BreadcrumbItem, i: number) => {
        const breadcrumbs = gdoc.breadcrumbs ?? []
        breadcrumbs[i] = item
        setBreadcrumbs(breadcrumbs)
    }

    const removeItemAtIndex = (i: number) => {
        const breadcrumbs = gdoc.breadcrumbs ?? []
        breadcrumbs.splice(i, 1)
        setBreadcrumbs(breadcrumbs)
    }

    return (
        <>
            Breadcrumbs
            {gdoc.breadcrumbs?.map((item, i) => (
                <BreadcrumbLine
                    item={item}
                    setItem={(item) => setItemAtIndex(item, i)}
                    removeItem={() => removeItemAtIndex(i)}
                    key={i}
                />
            ))}
            <Button
                type="dashed"
                onClick={() =>
                    setBreadcrumbs([...(gdoc.breadcrumbs ?? []), { label: "" }])
                }
            >
                <FontAwesomeIcon icon={faPlus} className="mr-1" /> Add
                breadcrumb
            </Button>
        </>
    )
}
