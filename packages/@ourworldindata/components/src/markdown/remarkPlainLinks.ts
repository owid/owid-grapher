import findAndReplace from "mdast-util-find-and-replace"

// This regex matches:
//   "http"
//   an optional "s"
//   two / characters
//   The subdomains and hostname: Any word or numeric character or "-" one or more times followed by a period
//   The TLD: Any word or numeric character or "-" one or more times (the TLD is optional, and URLs like localhost are also valid)
//   The port: A colon followed by one or more digits (optional)
//   The path, query string and fragment: A forward slash followed by any word or numeric character (unicode classes so umlauts like ö match
//       as well as any of the following: .+?:%&=~#) zero or more times. Note that we exclude space even though that is valid in a URL but it tends
//       to make the match too greedy.
//       We match the same subgroup [\p{L}\p{N}_\-.\+/?:%&=~#] twice, once with a * and then excactly once but without interpuncation characters .?:
//       This is to make sure that we don't match trailing punctuation as part of the URL ("This is an http://example.com." - note that the leading
//       period should not be part of the URL)
//       Finally, the very last part is a lone forward slash which would not be matched by the previous subgroup.
export const urlRegex =
    /https?:\/\/([\w-]+\.)*[\w-]+(:\d+)?((\/[\p{L}\p{N}_\-.+/?:%&=~#]*[\p{L}\p{N}_\-+/%&=~#])|\/)?/gu

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
