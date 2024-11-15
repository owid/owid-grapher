import React, {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import { Button, Flex, Input, Space, Table, Upload } from "antd"

import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbEnrichedImage } from "@ourworldindata/types"
import { Timeago } from "./Forms.js"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faUpload } from "@fortawesome/free-solid-svg-icons"
import { Admin } from "./Admin.js"
import { RcFile } from "antd/es/upload/interface.js"
import TextArea from "antd/es/input/TextArea.js"

type ImageEditorApi = {
    patchImage: (
        image: DbEnrichedImage,
        patch: Partial<DbEnrichedImage>
    ) => void
    deleteImage: (image: DbEnrichedImage) => void
    getImages: () => Promise<DbEnrichedImage[]>
}

function AltTextEditor({
    image,
    text,
    patchImage,
}: {
    image: DbEnrichedImage
    text: string
    patchImage: ImageEditorApi["patchImage"]
}) {
    const [value, setValue] = useState(text)

    const handleBlur = useCallback(
        (e: React.FocusEvent<HTMLTextAreaElement>) => {
            const trimmed = e.target.value.trim()
            setValue(trimmed)
            if (trimmed !== text) {
                patchImage(image, { defaultAlt: trimmed })
            }
        },
        [image, text, patchImage]
    )

    return (
        <TextArea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
        />
    )
}

function createColumns({
    api,
}: {
    api: ImageEditorApi
}): ColumnsType<DbEnrichedImage> {
    return [
        {
            title: "Preview",
            dataIndex: "cloudflareId",
            width: 100,
            key: "cloudflareId",
            render: (cloudflareId) => {
                const src = `https://imagedelivery.net/qLq-8BTgXU8yG0N6HnOy8g/${encodeURIComponent(cloudflareId)}/test`
                return (
                    <div style={{ height: 100, width: 100 }}>
                        <a target="_blank" href={src} rel="noopener" key={src}>
                            <img
                                src={src}
                                style={{ maxHeight: 100, maxWidth: 100 }}
                            />
                        </a>
                    </div>
                )
            },
        },
        {
            title: "Filename",
            dataIndex: "filename",
            key: "filename",
            width: 300,
        },
        {
            title: "Alt text",
            dataIndex: "defaultAlt",
            key: "defaultAlt",
            sorter: (a, b) =>
                a.defaultAlt && b.defaultAlt
                    ? a.defaultAlt.localeCompare(b.defaultAlt)
                    : 0,
            render: (text, image) => (
                <AltTextEditor
                    key={image.cloudflareId}
                    text={text}
                    image={image}
                    patchImage={api.patchImage}
                />
            ),
        },
        {
            title: "Width",
            dataIndex: "originalWidth",
            key: "originalWidth",
            sorter: (a, b) =>
                a.originalWidth && b.originalWidth
                    ? a.originalWidth - b.originalWidth
                    : 0,
            width: 100,
            render: (text) => <span>{text}</span>,
        },
        {
            title: "Height",
            dataIndex: "originalHeight",
            key: "originalHeight",
            sorter: (a, b) =>
                a.originalHeight && b.originalHeight
                    ? a.originalHeight - b.originalHeight
                    : 0,
            width: 100,
            render: (text) => <span>{text}</span>,
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 150,
            defaultSortOrder: "descend",
            sorter: (a, b) =>
                a.updatedAt && b.updatedAt ? a.updatedAt - b.updatedAt : 0,
            render: (time) => <Timeago time={time} />,
        },
        {
            title: "Action",
            key: "action",
            width: 100,
            render: (_, image) => (
                <Space size="middle">
                    <Button
                        type="text"
                        danger
                        onClick={() => api.deleteImage(image)}
                    >
                        Delete
                    </Button>
                </Space>
            ),
        },
    ]
}

function ImageUploadButton({
    setImages,
    admin,
}: {
    setImages: (images: DbEnrichedImage[]) => void
    admin: Admin
}) {
    function uploadImage({ file }: { file: string | Blob | RcFile }) {
        if (typeof file === "string") return

        const reader = new FileReader()
        reader.onload = async () => {
            const base64Data = reader.result?.toString()

            const payload = {
                filename: file.name,
                content: base64Data,
                type: file.type,
            }

            const response = await admin.requestJSON(
                "/api/image",
                payload,
                "POST"
            )

            setImages(response.images)
        }
        reader.readAsDataURL(file)
    }
    return (
        <Upload showUploadList={false} customRequest={uploadImage}>
            <Button type="primary" icon={<FontAwesomeIcon icon={faUpload} />}>
                Upload image
            </Button>
        </Upload>
    )
}

export function ImageIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [images, setImages] = useState<DbEnrichedImage[]>([])
    const [filenameSearchValue, setFilenameSearchValue] = useState("")
    const api = useMemo(
        (): ImageEditorApi => ({
            deleteImage: async (image) => {
                const response = await admin.requestJSON(
                    `/api/images/${image.id}`,
                    {},
                    "DELETE"
                )
                setImages(response.images)
            },
            getImages: async () => {
                const json = await admin.getJSON("/api/images.json")
                setImages(json.images)
                return json.images
            },
            patchImage: async (image, patch) => {
                const response = await admin.requestJSON(
                    `/api/images/${image.id}`,
                    patch,
                    "PATCH"
                )
                setImages(response.images)
            },
        }),
        [admin]
    )
    const filteredImages = useMemo(
        () =>
            images.filter((image) =>
                image.filename
                    .toLowerCase()
                    .includes(filenameSearchValue.toLowerCase())
            ),
        [images, filenameSearchValue]
    )
    const columns = useMemo(() => createColumns({ api }), [api])

    useEffect(() => {
        void api.getImages()
    }, [api])

    return (
        <AdminLayout title="Images">
            <main className="ImageIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search by filename"
                        value={filenameSearchValue}
                        onChange={(e) => setFilenameSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                    <ImageUploadButton setImages={setImages} admin={admin} />
                </Flex>
                <Table columns={columns} dataSource={filteredImages} />
            </main>
        </AdminLayout>
    )
}
