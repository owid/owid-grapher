import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    BreadcrumbItem,
    OwidGdocErrorMessage,
    OwidGdocPostInterface,
} from "@ourworldindata/utils"
import { Button, Col, Input, Row } from "antd"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"

export const BreadcrumbLine = ({
    item,
    setItem,
    removeItem,
    isLastBreadcrumbItem,
    labelError,
    hrefError,
}: {
    item: BreadcrumbItem
    setItem: (item: BreadcrumbItem) => void
    removeItem: () => void
    isLastBreadcrumbItem?: boolean
    labelError?: OwidGdocErrorMessage
    hrefError?: OwidGdocErrorMessage
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
                        status={hrefError?.type}
                        placeholder="e.g. /poverty"
                    />
                    {hrefError && <GdocsErrorHelp error={hrefError} />}
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
                        status={labelError?.type}
                    />
                    {labelError && <GdocsErrorHelp error={labelError} />}
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
    gdoc: OwidGdocPostInterface
    setCurrentGdoc: (gdoc: OwidGdocPostInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    const setBreadcrumbs = (breadcrumbs: BreadcrumbItem[] | undefined) => {
        if (breadcrumbs?.length) {
            // The last breadcrumb is not clickable, so we don't need a URL
            breadcrumbs[breadcrumbs.length - 1].href = undefined
        } else breadcrumbs = undefined

        setCurrentGdoc({ ...gdoc, breadcrumbs: breadcrumbs ?? null })
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
                    labelError={getPropertyMostCriticalError(
                        `breadcrumbs[${i}].label`,
                        errors
                    )}
                    hrefError={getPropertyMostCriticalError(
                        `breadcrumbs[${i}].href`,
                        errors
                    )}
                    isLastBreadcrumbItem={i === gdoc.breadcrumbs!.length - 1}
                />
            ))}
            {!gdoc.breadcrumbs?.length && <i>No breadcrumbs</i>}
        </div>
    )
}
