module.exports = {
    core: {
        builder: "webpack5",
    },
    stories: ["../**/*.stories.js"],
    addons: [
        "@storybook/addon-measure",
        "@storybook/addon-outline",
        "@storybook/addon-viewport",
    ],
}
