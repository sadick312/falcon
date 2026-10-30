// Counts the `any` type keyword in TypeScript source without the TypeScript API (TypeScript 7 ships
// only the native compiler). Comments, strings, template text and regex literals are blanked first so
// words inside them don't count. Checked against the TypeScript 6 AST count when it was written.

/** Characters after which a "/" starts a regex literal rather than a division. */
const REGEX_PREFIX = "(,=:[!&|?{};+-*%<>~^";
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|case|in|of|delete|void|throw|new)$/;

export function stripNonCode(text) {
    let out = "";
    let i = 0;
    const n = text.length;

    while (i < n) {
        const c = text[i];
        const next = text[i + 1];

        if (c === "/" && next === "/") {
            while (i < n && text[i] !== "\n") i++;
            continue;
        }

        if (c === "/" && next === "*") {
            i += 2;
            while (i < n && !(text[i] === "*" && text[i + 1] === "/")) i++;
            i += 2;
            continue;
        }

        if (c === "\"" || c === "'") {
            i++;
            while (i < n && text[i] !== c && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1;
            i++;
            out += "\"\"";
            continue;
        }

        if (c === "`") {
            // Keep the code inside ${...} (it can hold casts), drop the template text.
            i++;
            let depth = 0;
            while (i < n) {
                const t = text[i];
                if (t === "\\") { i += 2; continue; }
                if (depth === 0 && t === "`") break;
                if (depth === 0 && t === "$" && text[i + 1] === "{") { depth = 1; i += 2; out += " "; continue; }
                if (depth > 0) {
                    if (t === "{") depth++;
                    else if (t === "}" && --depth === 0) { i++; out += " "; continue; }
                    out += t;
                }
                i++;
            }
            i++;
            out += "\"\"";
            continue;
        }

        if (c === "/") {
            const before = out.trimEnd();
            const last = before[before.length - 1];

            if (last === undefined || REGEX_PREFIX.includes(last) || REGEX_KEYWORDS.test(before)) {
                i++;
                let inClass = false;
                while (i < n && text[i] !== "\n") {
                    const t = text[i];
                    if (t === "\\") { i += 2; continue; }
                    if (t === "[") inClass = true;
                    else if (t === "]") inClass = false;
                    else if (t === "/" && !inClass) break;
                    i++;
                }
                i++;
                while (i < n && /[a-z]/i.test(text[i])) i++;
                out += " /r/ ";
                continue;
            }
        }

        out += c;
        i++;
    }

    return out;
}

export function countAny(text) {
    return (stripNonCode(text).match(/(?<![.\w$])any(?![\w$])/g) ?? []).length;
}
