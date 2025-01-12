import type { StorybookConfig } from "@storybook/react-vite"

import { nxViteTsPaths } from "@nx/vite/plugins/nx-tsconfig-paths.plugin"
import { mergeConfig } from "vite"

const config: StorybookConfig = {
    stories: ["../**/*.stories.@(js|jsx|ts|tsx|mdx)"],
    addons: ["@storybook/addon-essentials"],
    framework: {
        name: "@storybook/react-vite",
        options: {},
    },
    core: {
        builder: {
            name: "@storybook/builder-vite",
            options: {
                viteConfigPath: "vite.config-site.mts",
            },
        },
    },

    viteFinal: async (config) =>
        mergeConfig(config, {
            plugins: [nxViteTsPaths()],
        }),
}

export default config

// To customize your Vite configuration you can use the viteFinal field.
// Check https://storybook.js.org/docs/react/builders/vite#configuration
// and https://nx.dev/recipes/storybook/custom-builder-configs
