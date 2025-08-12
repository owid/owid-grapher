import * as _ from "lodash-es"
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react"
import {
    Button,
    Flex,
    Input,
    Mentions,
    Popconfirm,
    Popover,
    Table,
    TableColumnsType,
    Upload,
    notification,
} from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbEnrichedImageWithUserId, DbPlainUser } from "@ourworldindata/types"
import { downloadImage } from "@ourworldindata/utils"
import { Timeago } from "./Forms.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faClose,
    faDownload,
    faRobot,
    faUpload,
} from "@fortawesome/free-solid-svg-icons"
import {
    type File,
    fileToBase64,
    type ImageUploadResponse,
} from "./imagesHelpers.js"
import { CLOUDFLARE_IMAGES_URL } from "../settings/clientSettings.js"
import { NotificationInstance } from "antd/es/notification/interface.js"
import { EditableTextarea } from "./EditableTextarea.js"

type ImageMap = Record<string, DbEnrichedImageWithUserId>

type UserMap = Record<string, DbPlainUser>

type UsageInfo = {
    title: string
    id: string
}

type ImageEditorApi = {
    getUsage: () => void
    getAltText: (id: number) => Promise<{ altText: string; success: boolean }>
    patchImage: (
        image: DbEnrichedImageWithUserId,
        patch: Partial<DbEnrichedImageWithUserId>
    ) => void
    putImage: (
        id: number,
        payload: {
            filename: string
            content?: string
            type: string
        }
    ) => void
    postImage: (payload: {
        filename: string
        content?: string
        type: string
    }) => void
    deleteImage: (image: DbEnrichedImageWithUserId) => void
    getImages: () => void
    getUsers: () => void
    postUserImage: (user: DbPlainUser, image: DbEnrichedImageWithUserId) => void
    deleteUserImage: (
        user: DbPlainUser,
        image: DbEnrichedImageWithUserId
    ) => void
}

function AltTextEditor({
    image,
    text,
    patchImage,
    getAltText,
}: {
    image: DbEnrichedImageWithUserId
    text: string
    patchImage: ImageEditorApi["patchImage"]
    getAltText: ImageEditorApi["getAltText"]
}) {
    const [value, setValue] = useState(text)

    const saveAltText = useCallback(
        (newValue: string) => {
            patchImage(image, { defaultAlt: newValue })
            setValue(newValue)
        },
        [image, patchImage]
    )

    const handleGetAltText = useCallback(async () => {
        const response = await getAltText(image.id)
        setValue(response.altText)
    }, [image.id, getAltText])

    const altTextButton = (
        <Button onClick={handleGetAltText} type="text">
            <FontAwesomeIcon icon={faRobot} />
        </Button>
    )

    return (
        <EditableTextarea
            value={value}
            onChange={setValue}
            onSave={saveAltText}
            className="ImageIndexPage__alt-text-editor"
            extraActions={altTextButton}
            autoResize
        />
    )
}

function UserSelect({
    usersMap,
    initialValue = "",
    onUserSelect,
}: {
    usersMap: UserMap
    initialValue?: string
    onUserSelect: (user: DbPlainUser) => void
}) {
    const [isSetting, setIsSetting] = useState(false)

    const { admin } = useContext(AdminAppContext)
    const [value, setValue] = useState(initialValue)
    const [filteredOptions, setFilteredOptions] = useState(() =>
        Object.values(usersMap).map((user) => ({
            value: user.fullName,
            label: user.fullName,
        }))
    )

    const handleChange = (value: string) => {
        setValue(value)
        const lowercaseValue = value.toLowerCase()
        setFilteredOptions(
            Object.values(usersMap)
                .filter((user) =>
                    user.fullName.toLowerCase().includes(lowercaseValue)
                )
                .map((user) => ({
                    value: String(user.id),
                    label: user.fullName,
                }))
        )
    }

    const handleSelect = async (option: { value?: string; label?: string }) => {
        // iterating because we only have the label when using the admin context
        const selectedUser = Object.values(usersMap).find(
            (user) => user.fullName === option.label
        )

        if (selectedUser) {
            setValue(selectedUser.fullName)
            await onUserSelect(selectedUser)
        }
    }

    if (isSetting) {
        return (
            <Mentions
                prefix=""
                autoFocus
                allowClear
                value={value}
                onKeyDown={(e) => {
                    if (e.key === "Escape") setIsSetting(false)
                }}
                onChange={handleChange}
                onSelect={handleSelect}
                options={filteredOptions}
            />
        )
    }
    return (
        <div>
            <Button
                type="text"
                onClick={() => handleSelect({ label: admin.username })}
            >
                + {admin.username}
            </Button>
            <Button type="text" onClick={() => setIsSetting(true)}>
                + Someone else
            </Button>
        </div>
    )
}

function UsageViewer({ usage }: { usage: UsageInfo[] | undefined }) {
    const content = (
        <div>
            {usage ? (
                <ul className="ImageIndexPage__usage-list">
                    {usage.map((use) => (
                        <li key={use.id}>
                            <a href={`/admin/gdocs/${use.id}/preview`}>
                                {use.title}
                            </a>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )

    return (
        <Popover
            content={content}
            title="Published posts that reference this image"
            trigger="click"
        >
            <Button type="text" disabled={!usage || !usage.length}>
                See usage
                {usage ? (
                    <span className="ImageIndexPage__usage-chip">
                        {usage.length}
                    </span>
                ) : null}
            </Button>
        </Popover>
    )
}

function makeImageSrc(cloudflareId: string, width: number) {
    return `${CLOUDFLARE_IMAGES_URL}/${encodeURIComponent(cloudflareId)}/w=${width}`
}

function Filename({
    filename,
    cloudflareId,
    originalWidth,
}: {
    filename: string
    cloudflareId: string | null
    originalWidth: number | null
}) {
    return (
        <>
            {filename}
            {cloudflareId && originalWidth && (
                <Button
                    type="link"
                    size="small"
                    icon={<FontAwesomeIcon icon={faDownload} />}
                    aria-label="Download"
                    onClick={() => {
                        void downloadImage(
                            makeImageSrc(cloudflareId, originalWidth),
                            filename
                        )
                    }}
                />
            )}
        </>
    )
}

function createColumns({
    api,
    users,
    usage,
    notificationApi,
}: {
    api: ImageEditorApi
    users: UserMap
    usage: Record<string, UsageInfo[]>
    notificationApi: NotificationInstance
}): TableColumnsType<DbEnrichedImageWithUserId> {
    return [
        {
            title: "Preview",
            dataIndex: "cloudflareId",
            width: 100,
            key: "cloudflareId",
            render: (cloudflareId, { originalWidth, originalHeight }) => {
                return (
                    <div style={{ height: 100, width: 100 }} key={cloudflareId}>
                        <a
                            target="_blank"
                            href={makeImageSrc(cloudflareId, originalWidth)}
                            rel="noopener"
                        >
                            <img
                                src={makeImageSrc(cloudflareId, 200)}
                                width="100"
                                height={(originalHeight / originalWidth) * 100}
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
            width: 200,
            render: (filename, { cloudflareId, originalWidth }) => (
                <Filename
                    filename={filename}
                    cloudflareId={cloudflareId}
                    originalWidth={originalWidth}
                />
            ),
        },
        {
            title: "Alt text",
            dataIndex: "defaultAlt",
            key: "defaultAlt",
            width: "auto",
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
                    getAltText={api.getAltText}
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
            width: 50,
        },
        {
            title: "Height",
            dataIndex: "originalHeight",
            key: "originalHeight",
            sorter: (a, b) =>
                a.originalHeight && b.originalHeight
                    ? a.originalHeight - b.originalHeight
                    : 0,
            width: 50,
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 50,
            defaultSortOrder: "descend",
            sorter: (a, b) =>
                a.updatedAt && b.updatedAt ? a.updatedAt - b.updatedAt : 0,
            render: (time) => <Timeago time={time} />,
        },
        {
            title: "Owner",
            key: "userId",
            width: 100,
            filters: [
                {
                    text: "Unassigned",
                    value: null as any,
                },
                ...Object.values(users)
                    .map((user) => ({
                        text: user.fullName,
                        value: user.id,
                    }))
                    .sort((a, b) => a.text.localeCompare(b.text)),
            ],
            onFilter: (value, record) => record.userId === value,
            render: (_, image) => {
                const user = users[image.userId]
                if (!user)
                    return (
                        <UserSelect
                            usersMap={users}
                            onUserSelect={(user) =>
                                api.postUserImage(user, image)
                            }
                        />
                    )
                return (
                    <div>
                        {user.fullName}
                        <button
                            className="ImageIndexPage__delete-user-button"
                            onClick={() => api.deleteUserImage(user, image)}
                        >
                            <FontAwesomeIcon icon={faClose} />
                        </button>
                    </div>
                )
            },
        },
        {
            title: "Action",
            key: "action",
            width: 50,
            render: (_, image) => {
                const isDeleteDisabled = !!(usage && usage[image.id]?.length)
                return (
                    <Flex vertical>
                        <UsageViewer usage={usage && usage[image.id]} />
                        <PutImageButton
                            putImage={api.putImage}
                            notificationApi={notificationApi}
                            id={image.id}
                        />
                        <Popconfirm
                            title="Are you sure?"
                            description="This will delete the image being used in production."
                            onConfirm={() => api.deleteImage(image)}
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                type="text"
                                danger
                                disabled={isDeleteDisabled}
                                title={
                                    isDeleteDisabled
                                        ? "This image is being used in production"
                                        : undefined
                                }
                            >
                                Delete
                            </Button>
                        </Popconfirm>
                    </Flex>
                )
            },
        },
    ]
}

function PostImageButton({
    postImage,
}: {
    postImage: ImageEditorApi["postImage"]
}) {
    async function uploadImage({ file }: { file: File }) {
        const result = await fileToBase64(file)
        if (result) {
            postImage(result)
        }
    }
    return (
        <Upload
            accept="image/*"
            showUploadList={false}
            customRequest={uploadImage}
        >
            <Button type="primary">
                <FontAwesomeIcon icon={faUpload} /> Upload
            </Button>
        </Upload>
    )
}

function PutImageButton({
    putImage,
    id,
    notificationApi,
}: {
    putImage: ImageEditorApi["putImage"]
    id: number
    notificationApi: NotificationInstance
}) {
    async function uploadImage({ file }: { file: File }) {
        const result = await fileToBase64(file)
        if (result) {
            await putImage(id, result)
            notificationApi.info({
                message: "Image replaced!",
                description:
                    "Make sure you update the alt text if your revision has substantive changes",
                placement: "bottomRight",
            })
        }
    }
    return (
        <>
            <Upload
                accept="image/*"
                showUploadList={false}
                customRequest={uploadImage}
            >
                <Button
                    className="ImageIndexPage__update-image-button"
                    type="text"
                >
                    Upload new version
                </Button>
            </Upload>
        </>
    )
}

const NotificationContext = createContext(null)

export function ImageIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [notificationApi, notificationContextHolder] =
        notification.useNotification()
    const [images, setImages] = useState<ImageMap>({})
    const [users, setUsers] = useState<UserMap>({})
    const [usage, setUsage] = useState<Record<string, UsageInfo[]>>({})
    const [filenameSearchValue, setFilenameSearchValue] = useState("")

    const api = useMemo(
        (): ImageEditorApi => ({
            getUsage: async () => {
                const usage = await admin.requestJSON<{
                    success: true
                    usage: Record<string, UsageInfo[]>
                }>(`/api/images/usage`, {}, "GET")
                setUsage(usage.usage)
            },
            getAltText: (id) => {
                return admin.requestJSON<{
                    success: true
                    altText: string
                }>(`/api/gpt/suggest-alt-text/${id}`, {}, "GET")
            },
            deleteImage: async (image) => {
                await admin.requestJSON(`/api/images/${image.id}`, {}, "DELETE")
                setImages((prevMap) => {
                    const newMap = { ...prevMap }
                    delete newMap[image.id]
                    return newMap
                })
            },
            getImages: async () => {
                const json = await admin.getJSON<{
                    images: DbEnrichedImageWithUserId[]
                }>("/api/images.json")
                setImages(_.keyBy(json.images, "id"))
            },
            getUsers: async () => {
                const json = await admin.getJSON<{ users: DbPlainUser[] }>(
                    "/api/users.json"
                )
                setUsers(_.keyBy(json.users, "id"))
            },
            patchImage: async (image, patch) => {
                const response = await admin.requestJSON<ImageUploadResponse>(
                    `/api/images/${image.id}`,
                    patch,
                    "PATCH"
                )
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: response.image,
                    }))
                } else {
                    notificationApi.error({
                        message: "Failed to update image",
                        description: response.errorMessage,
                        placement: "bottomRight",
                    })
                }
            },
            postImage: async (image) => {
                const response = await admin.requestJSON<ImageUploadResponse>(
                    `/api/images`,
                    image,
                    "POST"
                )
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [response.image.id]: response.image,
                    }))
                } else {
                    notificationApi.error({
                        message: "Image upload failed",
                        description: response.errorMessage,
                        placement: "bottomRight",
                    })
                }
            },
            putImage: async (id, payload) => {
                const response = await admin.requestJSON<ImageUploadResponse>(
                    `/api/images/${id}`,
                    payload,
                    "PUT"
                )
                if (response.success) {
                    setImages((prevMap) => {
                        const nextMap = { ...prevMap }
                        delete nextMap[id]
                        return {
                            ...nextMap,
                            [response.image.id]: response.image,
                        }
                    })
                } else {
                    notificationApi.error({
                        message: "Image update failed",
                        description: response.errorMessage,
                        placement: "bottomRight",
                    })
                }
            },
            postUserImage: async (user, image) => {
                const response = await admin.requestJSON(
                    `/api/users/${user.id}/images/${image.id}`,
                    {},
                    "POST"
                )
                if (response.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: { ...prevMap[image.id], userId: user.id },
                    }))
                }
            },
            deleteUserImage: async (user, image) => {
                const result = await admin.requestJSON(
                    `/api/users/${user.id}/images/${image.id}`,
                    {},
                    "DELETE"
                )
                if (result.success) {
                    setImages((prevMap) => ({
                        ...prevMap,
                        [image.id]: { ...prevMap[image.id], userId: null },
                    }))
                }
            },
        }),
        [admin, notificationApi]
    )

    const filteredImages = useMemo(
        () =>
            Object.values(images).filter((image) =>
                image.filename
                    .toLowerCase()
                    .includes(filenameSearchValue.toLowerCase())
            ),
        [images, filenameSearchValue]
    )

    const columns = useMemo(
        () => createColumns({ api, users, usage, notificationApi }),
        [api, users, usage, notificationApi]
    )

    useEffect(() => {
        void api.getImages()
        void api.getUsers()
        void api.getUsage()
    }, [api])

    return (
        <AdminLayout title="Images">
            <NotificationContext.Provider value={null}>
                {notificationContextHolder}
                <main className="ImageIndexPage">
                    <Flex justify="space-between">
                        <Input
                            placeholder="Search by filename"
                            value={filenameSearchValue}
                            onChange={(e) =>
                                setFilenameSearchValue(e.target.value)
                            }
                            style={{ width: 500, marginBottom: 20 }}
                        />
                        <PostImageButton postImage={api.postImage} />
                    </Flex>
                    <Table
                        size="small"
                        columns={columns}
                        dataSource={filteredImages}
                        rowKey={(x) => x.id}
                    />
                </main>
            </NotificationContext.Provider>
        </AdminLayout>
    )
}
