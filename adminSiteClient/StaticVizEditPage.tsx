import { useContext, useEffect, useState } from "react"
import { useParams, useHistory } from "react-router-dom"
import { Button, Form, Input, Select, Spin } from "antd"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    DbRawImage,
    DbEnrichedStaticViz,
    StaticVizUpdate,
} from "@ourworldindata/types"
import { makeImageSrc } from "./imagesHelpers.js"
import { ChartListItem } from "./ChartList.js"

const { Option } = Select
const { TextArea } = Input

function ImagePreview({
    imageId,
    imagesData,
}: {
    imageId: number | undefined
    imagesData: DbRawImage[] | undefined
}) {
    const image = imagesData?.find((img) => img.id === imageId)
    if (!image) return null
    return (
        <img
            src={makeImageSrc(image.cloudflareId!, 300)}
            alt={image.filename}
            style={{ maxWidth: "300px", maxHeight: "200px" }}
        />
    )
}

function useInitializeForm(
    isEdit: boolean,
    form: any,
    staticVizId?: string
): [StaticVizUpdate, boolean] {
    const { admin } = useContext(AdminAppContext)

    const [formData, setFormData] = useState<StaticVizUpdate>({
        title: "",
        slug: "",
        description: "",
        grapherSlug: "",
        sourceUrl: "",
        imageId: undefined,
        mobileImageId: undefined,
    })

    const { data, isLoading } = useQuery({
        queryKey: ["static-viz", staticVizId],
        queryFn: async () => {
            if (!isEdit) return null
            const response = await admin.getJSON(
                `/api/static-viz/${staticVizId}.json`
            )
            return response.staticViz as DbEnrichedStaticViz
        },
        enabled: isEdit,
    })

    useEffect(() => {
        if (isEdit && data) {
            const initialData: StaticVizUpdate = {
                title: data.title,
                slug: data.slug,
                description: data.description || "",
                grapherSlug: data.grapherSlug || "",
                sourceUrl: data.sourceUrl || "",
                imageId: data.desktop?.id,
                mobileImageId: data.mobile?.id,
            }
            setFormData(initialData)
            form.setFieldsValue(initialData)
        }
    }, [isEdit, data, form])

    return [formData, isLoading]
}

export function StaticVizEditPage() {
    const { staticVizId } = useParams<{ staticVizId?: string }>()
    const isEditing = !!(staticVizId && staticVizId !== "new")
    const history = useHistory()
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()

    const [form] = Form.useForm<StaticVizUpdate>()
    const [initalValues, isInitializing] = useInitializeForm(
        isEditing,
        form,
        staticVizId
    )

    const values = Form.useWatch([], form)
    const [isValid, setIsValid] = useState(false)
    useEffect(() => {
        form.validateFields({ validateOnly: true })
            .then(() => setIsValid(true))
            .catch(() => setIsValid(false))
    }, [form, values])

    const { data: imagesData, isLoading: isLoadingImages } = useQuery<
        DbRawImage[]
    >({
        queryKey: ["images"],
        queryFn: async () => {
            const response = await admin.getJSON("/api/images.json")
            return response.images.sort((a: DbRawImage, b: DbRawImage) =>
                a.filename.localeCompare(b.filename)
            )
        },
    })

    const { data: grapherSlugs } = useQuery({
        queryKey: ["grapherSlugs"],
        queryFn: async () => {
            const response = await admin.getJSON<{
                charts: ChartListItem[]
            }>("/api/charts.json")
            return [
                ...response.charts.reduce((slugs, chart) => {
                    if (chart.slug && chart.isPublished) {
                        slugs.add(chart.slug)
                    }
                    return slugs
                }, new Set<string>()),
            ].sort()
        },
    })

    const createMutation = useMutation({
        mutationFn: async (data: StaticVizUpdate) => {
            return admin.requestJSON("/api/static-viz", data, "POST")
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["static-viz"] })
            history.push("/static-viz")
        },
    })

    const updateMutation = useMutation({
        mutationFn: async (data: StaticVizUpdate) => {
            return admin.requestJSON(
                `/api/static-viz/${staticVizId}`,
                data,
                "PUT"
            )
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["static-viz"] })
            history.push("/static-viz")
        },
    })

    const currentMutation = isEditing ? updateMutation : createMutation
    const currentTitle = isEditing ? "Edit Static Viz" : "Create Static Viz"

    const handleCancel = () => {
        history.push("/static-viz")
    }

    if (isEditing && isInitializing) {
        return (
            <AdminLayout title={currentTitle}>
                <Spin size="large" />
            </AdminLayout>
        )
    }

    return (
        <AdminLayout title={currentTitle}>
            <div className="StaticVizEditPage">
                <h1>{currentTitle}</h1>
                <Form
                    className="static-viz-edit-form"
                    form={form}
                    layout="vertical"
                    onFinish={currentMutation.mutate}
                    initialValues={initalValues}
                >
                    <Form.Item
                        label="Title"
                        name="title"
                        rules={[
                            { required: true, message: "Please enter a title" },
                        ]}
                    >
                        <Input placeholder="Enter title" />
                    </Form.Item>

                    <Form.Item
                        label="Slug"
                        name="slug"
                        rules={[
                            { required: true, message: "Please enter a slug" },
                            {
                                pattern: /^[a-z0-9-]+$/,
                                message:
                                    "Slug must be lowercase and contain only letters, numbers, and hyphens",
                            },
                        ]}
                    >
                        <Input placeholder="Enter slug" />
                    </Form.Item>

                    <Form.Item label="Description" name="description">
                        <TextArea
                            rows={4}
                            placeholder={`How this data visualization was produced e.g. 
1. Data was downloaded from [source]
2. Data was processed via scripts at https://github.com/owid/notebooks/blah
3. Script output was arranged in Figma`}
                        />
                    </Form.Item>

                    <Form.Item
                        label="Grapher Slug"
                        name="grapherSlug"
                        help="Reference to an existing grapher chart"
                    >
                        <Select
                            placeholder="Select a grapher slug"
                            loading={!grapherSlugs}
                            showSearch
                            filterOption={(input, option) =>
                                option?.children
                                    ?.toString()
                                    .toLowerCase()
                                    .includes(input.toLowerCase()) ?? false
                            }
                        >
                            {grapherSlugs?.map((slug: string) => (
                                <Option key={slug} value={slug}>
                                    {slug}
                                </Option>
                            ))}
                        </Select>
                    </Form.Item>

                    <Form.Item
                        label="Source URL"
                        name="sourceUrl"
                        help="Dataset URL (alternative to grapher slug)"
                    >
                        <Input placeholder="Enter source URL" />
                    </Form.Item>

                    <div className="static-viz-edit-form__image-section">
                        <h3>Main image</h3>
                        <Form.Item
                            label="Image"
                            name="imageId"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select an image",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select an image"
                                loading={isLoadingImages}
                                showSearch
                                filterOption={(input, option) =>
                                    option?.children
                                        ?.toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase()) ?? false
                                }
                            >
                                {imagesData?.map((image: any) => (
                                    <Option key={image.id} value={image.id}>
                                        {image.filename}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item>
                            <ImagePreview
                                imagesData={imagesData}
                                imageId={form.getFieldValue("imageId")}
                            />
                        </Form.Item>
                    </div>
                    <div className="static-viz-edit-form__image-section">
                        <h3>
                            Mobile image{" "}
                            <span style={{ opacity: 0.5, fontSize: 16 }}>
                                (optional)
                            </span>
                        </h3>
                        <Form.Item name="mobileImageId">
                            <Select
                                placeholder="Select a mobile image (optional)"
                                loading={isLoadingImages}
                                allowClear
                                showSearch
                                filterOption={(input, option) =>
                                    option?.children
                                        ?.toString()
                                        .toLowerCase()
                                        .includes(input.toLowerCase()) ?? false
                                }
                            >
                                {imagesData?.map((image: any) => (
                                    <Option key={image.id} value={image.id}>
                                        {image.filename}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>

                        <Form.Item>
                            <ImagePreview
                                imagesData={imagesData}
                                imageId={form.getFieldValue("mobileImageId")}
                            />
                        </Form.Item>
                    </div>

                    <Form.Item style={{ paddingBottom: 24 }}>
                        <Button
                            type="primary"
                            htmlType="submit"
                            disabled={!isValid}
                            loading={currentMutation.isLoading}
                            style={{ marginRight: 8 }}
                        >
                            {isEditing ? "Update" : "Create"}
                        </Button>
                        <Button onClick={handleCancel}>Cancel</Button>
                    </Form.Item>
                </Form>
            </div>
        </AdminLayout>
    )
}
