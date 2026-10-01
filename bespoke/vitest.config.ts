import { defineConfig } from "vitest/config"
import pluginReact from "@vitejs/plugin-react"
import { pluginSwcDecorators } from "../rolldown.config-common.mts"

export default defineConfig({
    plugins: [pluginSwcDecorators(), pluginReact()],
    test: {
        root: ".",
    },
})
