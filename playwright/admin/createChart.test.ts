import { expect, test } from "./harness.js"

test("creates a chart draft in the admin", async ({
    openNewChartEditor,
    request,
}) => {
    const editor = await openNewChartEditor()
    await editor.openTab("Text")
    await editor.fill(editor.field("Title"), "A new chart")

    const patch = await editor.save()

    expect(patch).toMatchObject({ title: "A new chart" })
    await expect(editor.page).toHaveURL(/\/admin\/charts\/\d+\/edit$/)
    const chartId = editor.page.url().match(/charts\/(\d+)\/edit/)?.[1]
    const config = await (
        await request.get(`/admin/api/charts/${chartId}.config.json`)
    ).json()
    expect(config).toMatchObject({
        id: Number(chartId),
        isPublished: false,
        title: "A new chart",
    })
})
