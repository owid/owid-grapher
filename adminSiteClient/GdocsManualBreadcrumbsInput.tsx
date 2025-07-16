import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
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
    labelError,
    hrefError,
}: {
    item: BreadcrumbItem
    setItem: (item: BreadcrumbItem) => void
    removeItem: () => void
    labelError?: OwidGdocErrorMessage
    hrefError?: OwidGdocErrorMessage
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
                        placeholder={"A topic name"}
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

export const GdocsManualBreadcrumbsInput = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocPostInterface
    setCurrentGdoc: (gdoc: OwidGdocPostInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    const setBreadcrumbs = (breadcrumbs: BreadcrumbItem[] | null) => {
        setCurrentGdoc({ ...gdoc, manualBreadcrumbs: breadcrumbs })
    }

    const setItemAtIndex = (item: BreadcrumbItem, i: number) => {
        if (!gdoc.manualBreadcrumbs) return

        const breadcrumbs = [...gdoc.manualBreadcrumbs]
        breadcrumbs[i] = item
        setBreadcrumbs(breadcrumbs)
    }

    const removeItemAtIndex = (i: number) => {
        if (!gdoc.manualBreadcrumbs) return

        const breadcrumbs = [...gdoc.manualBreadcrumbs]
        breadcrumbs.splice(i, 1)

        setBreadcrumbs(breadcrumbs.length ? breadcrumbs : null)
    }

    return (
        <div className="form-group">
            <div className="d-flex justify-content-between">Breadcrumbs</div>
            {!!gdoc.breadcrumbs?.length && !gdoc.manualBreadcrumbs?.length ? (
                <div>
                    <p>
                        The breadcrumbs for this article will be automatically
                        generated, based on this article's tags and the tag
                        graph.
                    </p>
                    <p>
                        If you want to override these breadcrumbs, you can do so
                        here:
                    </p>
                </div>
            ) : (
                <strong>
                    Unless you are editing an SDG page, each breadcrumb should
                    have a URL and label.
                </strong>
            )}
            <Button
                type="dashed"
                onClick={() =>
                    setBreadcrumbs([
                        { href: "", label: "" },
                        ...(gdoc.manualBreadcrumbs || []),
                    ])
                }
            >
                <FontAwesomeIcon icon={faPlus} className="mr-1" /> Add
                breadcrumb
            </Button>
            {gdoc.manualBreadcrumbs?.map((item, i) => (
                <BreadcrumbLine
                    item={item}
                    setItem={(item) => setItemAtIndex(item, i)}
                    removeItem={() => removeItemAtIndex(i)}
                    key={i}
                    labelError={getPropertyMostCriticalError(
                        `manualBreadcrumbs[${i}].label`,
                        errors
                    )}
                    hrefError={getPropertyMostCriticalError(
                        `manualBreadcrumbs[${i}].href`,
                        errors
                    )}
                />
            ))}
        </div>
    )
}
