import findAndReplace from "mdast-util-find-and-replace"

export const urlRegex = /https?:\/\/([\w-]+\.)+[\w-]+(\/[\w\- .\+/?:%&=~#]*)?/

export function remarkPlainLinks() {
    const turnIntoLink = (value: any, _match: string) => {
        return [
            {
                type: "link",
                url: value,
                children: [
                    {
                        type: "text",
                        value: value,
                    },
                ],
            },
        ]
    }
    return (tree: any) => {
        findAndReplace(tree, [[urlRegex, turnIntoLink]])
    }
}
