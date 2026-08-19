// Puts the workspace readme into the manifest yarn sends to the npm registry.
//
// `yarn npm publish` attaches the readme to the packument root (`readme`), while
// `npm publish` attaches it to the version manifest (`versions[x].readme`, plus
// `readmeFilename`). Our custom packages.owid.io requires the latter to be
// present, so we ensure that it's part of the version manifest via this plugin.
//
// Side effect: the same hook feeds the tarball, so the `package.json` inside it
// also carries the readme (~18kB). Nothing reads it there, and keeping the two
// manifests in sync is worth more than the bytes.
module.exports = {
    name: `plugin-readme-in-version`,
    factory: (require) => {
        const { xfs, ppath } = require(`@yarnpkg/fslib`)
        return {
            hooks: {
                async beforeWorkspacePacking(workspace, rawManifest) {
                    const entries = await xfs.readdirPromise(workspace.cwd)
                    const readmeFilename = entries.find((entry) =>
                        /^readme(\.md|\.markdown|\.txt)?$/i.test(entry)
                    )
                    if (!readmeFilename) return

                    rawManifest.readme = await xfs.readFilePromise(
                        ppath.join(workspace.cwd, readmeFilename),
                        `utf8`
                    )
                    rawManifest.readmeFilename = readmeFilename
                },
            },
        }
    },
}
