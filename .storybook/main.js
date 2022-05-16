module.exports = {
    core: {
        builder: "webpack5",
    },
    stories: ["../**/*.stories.js"],
    addons: [
        {
            name: "@storybook/addon-essentials",
            options: {
                backgrounds: false,
            },
        },
    ],
}
