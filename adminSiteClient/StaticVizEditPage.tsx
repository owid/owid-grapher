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
                    new Error(
                        "You cannot provide both a Grapher slug and a source URL"
                    )
                )
            }

            // At least one provided - valid
            if (hasValue || hasOtherValue) {
                return Promise.resolve()
            }

            // Neither provided - error
            return Promise.reject(
                new Error(
                    "Please provide either a Grapher slug or a source URL"
                )
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
    const currentTitle = isEditing
        ? "Edit static visualization"
        : "Create static visualization"

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
                    created and link to its data source using either a Grapher
                    slug or an external URL.
                </p>
                <Form
                    className="static-viz-edit-form"
                    form={form}
                    layout="vertical"
                    onFinish={handleSubmit}
                    initialValues={initalValues}
                >
                    <h2>Internal metadata</h2>
                    <p className="static-viz-edit-form__description">
                        This information is used to reference the visualization
                        in our content management system.
                    </p>

                    <h3 className="static-viz-edit-form__heading--required">
                        Name
                    </h3>
                    <Form.Item
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
                            A unique identifier used to reference this
                            visualization in ArchieML documents (use the same{" "}
                            {"{.image}"} tag as for normal images).
                        </p>
                    </Form.Item>

                    <div className="static-viz-edit-form__image-section">
                        <h3 className="static-viz-edit-form__heading--required">
                            Desktop image
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
                                placeholder="Select an image from the library"
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
                            Optional: provide a version optimized for narrow
                            screens.
                        </p>
                        <Form.Item name="mobileImageId">
                            <Select
                                placeholder="Select a mobile image from the library (optional)"
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

                    <h2 style={{ marginTop: 40 }}>Information for readers</h2>
                    <p className="static-viz-edit-form__description">
                        This information will be displayed publicly to help
                        readers understand the visualization.
                    </p>

                    <h3>Description</h3>
                    <Form.Item name="description">
                        <TextArea
                            rows={4}
                            placeholder={`Describe how this visualization was created, e.g.:
1. The data was downloaded from [source]
2. It was then processed using scripts stored at https://github.com/owid/notebooks/blah
3. The output chart was then improved in Figma`}
                        />
                        <p className="static-viz-edit-form__description">
                            Explain how this visualization was created.
                        </p>
                    </Form.Item>

                    <h3 className="static-viz-edit-form__heading--required">
                        Data source
                    </h3>
                    <p>
                        Provide either a Grapher slug, if your visualization was
                        directly derived from a Grapher chart; or an external
                        URL. One of these is required.
                    </p>
                    <h4>Grapher slug</h4>
                    <Form.Item
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

                    <h4>Source URL</h4>
                    <Form.Item
                        name="sourceUrl"
                        dependencies={["grapherSlug"]}
                        rules={[requiresGrapherOrSourceRule("grapherSlug")]}
                    >
                        <Input placeholder="e.g., https://www.mortality.org/Data/ZippedDataFiles" />
                    </Form.Item>

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
