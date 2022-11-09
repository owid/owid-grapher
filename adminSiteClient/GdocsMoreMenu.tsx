import React from "react"
import { Dropdown, Menu, Button, Modal } from "antd"
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons/faEllipsisVertical"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidArticleType } from "@ourworldindata/utils"
import { faTrash } from "@fortawesome/free-solid-svg-icons/faTrash"
import { faXmark } from "@fortawesome/free-solid-svg-icons/faXmark"
import { faBug } from "@fortawesome/free-solid-svg-icons/faBug"

enum GdocsMoreMenuAction {
    Debug = "debug",
    Unpublish = "unpublish",
    Delete = "delete",
}

export const GdocsMoreMenu = ({
    gdoc,
    onDebug,
    onUnpublish,
    onDelete,
}: {
    gdoc: OwidArticleType
    onDebug: VoidFunction
    onUnpublish: VoidFunction
    onDelete: VoidFunction
}) => {
    const confirmUnpublish = () => {
        Modal.confirm({
            title: "Are you sure you want to unpublish this article?",
            content: "The article will no longer be visible to the public.",
            okText: "Unpublish",
            okType: "danger",
            cancelText: "Cancel",
            onOk() {
                onUnpublish()
            },
            maskClosable: true,
        })
    }
    const confirmDelete = () => {
        Modal.confirm({
            title: "Are you sure you want to delete this article?",
            content:
                "The article will be removed from the admin list and unpublished. The original Google Doc will be preserved.",
            okText: "Delete",
            okType: "danger",
            cancelText: "Cancel",
            onOk() {
                onDelete()
            },
            maskClosable: true,
        })
    }
    return (
        <Dropdown
            trigger={["click"]}
            overlay={
                <Menu
                    onClick={({ key }) => {
                        switch (key) {
                            case GdocsMoreMenuAction.Debug:
                                onDebug()
                                break
                            case GdocsMoreMenuAction.Unpublish:
                                confirmUnpublish()
                                break
                            case GdocsMoreMenuAction.Delete:
                                confirmDelete()
                                break
                        }
                    }}
                    items={[
                        {
                            key: GdocsMoreMenuAction.Debug,
                            label: "Debug",
                            icon: <FontAwesomeIcon icon={faBug} />,
                        },
                        {
                            key: GdocsMoreMenuAction.Unpublish,
                            label: "Unpublish",
                            danger: gdoc.published,
                            disabled: !gdoc.published,
                            icon: <FontAwesomeIcon icon={faXmark} />,
                        },
                        {
                            key: GdocsMoreMenuAction.Delete,
                            label: "Delete",
                            danger: true,
                            icon: <FontAwesomeIcon icon={faTrash} />,
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
    )
}
