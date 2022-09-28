import React from "react"
import { Dropdown, Menu, Button, Modal } from "antd"
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons/faEllipsisVertical"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { ExclamationCircleOutlined } from "@ant-design/icons"

export const GdocsMoreMenu = ({
    gdoc,
    onUnpublish,
}: {
    gdoc: OwidArticleType
    onUnpublish: VoidFunction
}) => {
    const confirmUnpublish = () => {
        Modal.confirm({
            title: "Are you sure you want to unpublish?",
            icon: <ExclamationCircleOutlined />,
            content: "The article will no longer be visible to the public.",
            okText: "Unpublish",
            okType: "danger",
            cancelText: "Cancel",
            onOk() {
                onUnpublish()
            },
        })
    }
    return (
        <>
            <Dropdown
                trigger={["click"]}
                overlay={
                    <Menu
                        onClick={({ key }) => {
                            switch (key) {
                                case "unpublish":
                                    confirmUnpublish()
                                default:
                                    break
                            }
                        }}
                        items={[
                            {
                                key: "unpublish",
                                label: "Unpublish",
                                danger: gdoc.published,
                                disabled: !gdoc.published,
                            },
                        ]}
                    />
                }
                placement="bottomRight"
            >
                <Button>
                    <FontAwesomeIcon icon={faEllipsisVertical} />
                </Button>
            </Dropdown>
        </>
    )
}
