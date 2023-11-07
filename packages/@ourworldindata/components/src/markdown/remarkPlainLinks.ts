import findAndReplace from "mdast-util-find-and-replace"

// This regex matches:
//   "http"
//   an optional "s"
//   two / characters
//   The subdomains and hostname: Any word or numeric character or "_" or "-" one or more times followed by a period
//   The TLD: Any word or numeric character or "_" or "-" one or more times
//   The path, query string and fragment: A forward slash followed by any word or numeric character (unicode classes so umlauts like ö match
//       as well as any of the following: .+?:%&=~#) zero or more times. Note that we exclude space even though that is valid in a URL but it tends
//       to make the match too greedy.
//   Note that this URL will tend to match too much at the end - if there is a URL at the end of a sentence, the period will
//   be matched by the regex. We accept this and handle it below when we create the link.
//   This URL could be made to not match trailing characters like .?: but AFAIK this requires a negative lookbehind which are not supported in
//   Safari before 16.4 which came out in Spring 2023
export const urlRegex =
    /https?:\/\/([\w-]+\.)+[\w-]+(\/[\p{L}\p{N}_\-.\+/?:%&=~#]*)?/gu

export function remarkPlainLinks() {
    const turnIntoLink = (value: any, _match: string) => {
        // Split off any trailing .?: characters and add them back after the link
        const isSentenceInterpunctation = (c: string) =>
            c === "." || c === "?" || c === ":"
        let i
        for (
            i = value.length - 1;
            i >= 0 && isSentenceInterpunctation(value[i]);
            i--
        ) {}
        const link = value.slice(0, i + 1)
        const rest = value.slice(i + 1)
        const restText =
            rest.length > 0
                ? [
                      {
                          type: "text",
                          value: rest,
                      },
                  ]
                : []
        return [
            {
                type: "link",
                url: link,
                children: [
                    {
                        type: "text",
                        value: link,
                    },
                ],
            },
            ...restText,
        ]
    }
    return (tree: any) => {
        findAndReplace(tree, [[urlRegex, turnIntoLink]])
    }
}
