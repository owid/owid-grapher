import React, { useState } from "react"
import { Dropdown, Menu, Button, Modal } from "antd"
import { faEllipsisVertical } from "@fortawesome/free-solid-svg-icons/faEllipsisVertical"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"

export const GdocsMoreMenu = ({
    gdoc,
    onUnpublish,
}: {
    gdoc: OwidArticleType
    onUnpublish: VoidFunction
}) => {
    const [isModalOpen, setModalOpen] = useState(false)

    const closeModal = () => {
        setModalOpen(false)
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
                                    setModalOpen(true)
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
            <Modal
                title="Are you sure you want to unpublish?"
                open={isModalOpen}
                okText="Unpublish"
                okButtonProps={{ danger: true }}
                onCancel={closeModal}
                onOk={() => {
                    onUnpublish()
                    closeModal()
                }}
            >
                By confirming, the article will no longer be visible to the
                public.
            </Modal>
        </>
    )
}
