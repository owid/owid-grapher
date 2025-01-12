import type { Meta, StoryObj } from "@storybook/react"

import { Header } from "./Header"

const meta: Meta<typeof Header> = {
    component: Header,
    title: "Header",
}

export default meta
type Story = StoryObj<typeof Header>

export const Primary: Story = {
    args: {
        manager: { currentTitle: "hi" },
    },
}
