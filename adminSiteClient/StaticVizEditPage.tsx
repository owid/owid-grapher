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

const hasInputValue = (value: unknown): boolean => {
    if (typeof value === "string") return value.trim().length > 0
    return value !== undefined && value !== null
}

const emptyStringToNull = <T,>(value: T): T | null => {
    if (value === undefined || value === null) return null
    if (typeof value === "string" && value.trim() === "") return null
    return value
}

const requiresGrapherOrSourceRule =
    (otherFieldName: "sourceUrl" | "grapherSlug") =>
    ({
        getFieldValue,
    }: {
        getFieldValue: (name: keyof StaticVizUpdate) => unknown
    }) => ({
        validator(_: unknown, value: unknown) {
            const hasValue = hasInputValue(value)
            const hasOtherValue = hasInputValue(getFieldValue(otherFieldName))

            // Both provided - error
            if (hasValue && hasOtherValue) {
                return Promise.reject(
                    new Error("Cannot provide both Grapher Slug and Source URL")
                )
            }

            // At least one provided - valid
            if (hasValue || hasOtherValue) {
                return Promise.resolve()
            }

            // Neither provided - error
            return Promise.reject(
                new Error("Please provide either a Grapher Slug or Source URL")
            )
        },
    })

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
        name: "",
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
                name: data.name,
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

    const handleSubmit = (values: StaticVizUpdate) => {
        // Transform empty strings to null for optional fields
        // We explicitly check all fields to ensure cleared values are sent as null
        const transformedValues: StaticVizUpdate = {
            name: values.name,
            grapherSlug: emptyStringToNull(values.grapherSlug),
            sourceUrl: emptyStringToNull(values.sourceUrl),
            description: emptyStringToNull(values.description),
            imageId: values.imageId,
            mobileImageId: values.mobileImageId,
        }
        currentMutation.mutate(transformedValues)
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
                <p className="static-viz-edit-form__description">
                    Add additional metadata to our bespoke static
                    visualizations. You can document how the visualization was
                    produced and link back to its source data with a grapher
                    slug or an external URL.
                </p>
                <Form
                    className="static-viz-edit-form"
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={initalValues}
                >
                    <Form.Item
                        label="Name"
                        name="name"
                        rules={[
                            { required: true, message: "Please enter a name" },
                            {
                                pattern: /^[a-z-]+$/,
                                message:
                                    "Name must be lowercase and contain only letters and hyphens",
                            },
                        ]}
                    >
                        <Input placeholder="e.g. ac-adoption-data-insight" />
                        <p className="static-viz-edit-form__description">
                            A unique identifier for the static visualization.
                            Used to refer to it in an ArchieML Gdoc.
                        </p>
                    </Form.Item>

                    <Form.Item label="Description" name="description">
                        <TextArea
                            rows={4}
                            placeholder={`How this data visualization was produced e.g. 
1. Data was downloaded from [source]
2. Data was processed via scripts at https://github.com/owid/notebooks/blah
3. Script output was arranged in Figma`}
                        />
                        <p className="static-viz-edit-form__description">
                            A brief description of how the static visualization
                            was produced, for our readers.
                        </p>
                    </Form.Item>

                    <h3 className="static-viz-edit-form__heading--required">
                        Data
                    </h3>
                    <p>
                        The source of the visualization's data. One of the
                        following two fields must be provided
                    </p>
                    <Form.Item
                        label="Grapher Slug"
                        name="grapherSlug"
                        dependencies={["sourceUrl"]}
                        rules={[requiresGrapherOrSourceRule("sourceUrl")]}
                    >
                        <Select
                            placeholder="e.g. life-expectancy"
                            loading={!grapherSlugs}
                            showSearch
                            allowClear
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
                        dependencies={["grapherSlug"]}
                        rules={[requiresGrapherOrSourceRule("grapherSlug")]}
                    >
                        <Input placeholder="e.g. https://www.mortality.org/Data/ZippedDataFiles" />
                    </Form.Item>

                    <div className="static-viz-edit-form__image-section">
                        <h3 className="static-viz-edit-form__heading--required">
                            Main image
                        </h3>
                        <Form.Item
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
                        <h3>Mobile image</h3>
                        <p className="static-viz-edit-form__description">
                            If you've created a version of the visualization
                            specifically for narrow screens, you can specify it
                            here.
                        </p>
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
                            loading={currentMutation.isPending}
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
