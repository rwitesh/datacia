import { SQL_KEYWORDS } from "./constants";

export interface KeywordInfo {
    keyword: string;
    rest: string;
    colorClass: string;
}

/**
 * Extract the first SQL keyword from a query string.
 * Returns keyword details if found, null otherwise.
 */
export function getFirstKeyword(query: string): KeywordInfo | null {
    const trimmed = query.trimStart();
    const upperQuery = trimmed.toUpperCase();

    for (const keyword of Object.keys(SQL_KEYWORDS)) {
        const isFullKeyword =
            upperQuery.startsWith(keyword) &&
            (upperQuery.length === keyword.length || /\s/.test(upperQuery[keyword.length]));

        if (isFullKeyword) {
            return {
                keyword: trimmed.slice(0, keyword.length),
                rest: trimmed.slice(keyword.length),
                colorClass: SQL_KEYWORDS[keyword],
            };
        }
    }
    return null;
}

/**
 * Highlight all occurrences of a search term within text.
 * Returns React nodes with highlighted matches.
 */
export function highlightSearchMatch(text: string, search: string): React.ReactNode {
    if (!search.trim()) return text;

    const lowerText = text.toLowerCase();
    const lowerSearch = search.toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let index = lowerText.indexOf(lowerSearch);

    while (index !== -1) {
        // Add text before match
        if (index > lastIndex) {
            parts.push(text.slice(lastIndex, index));
        }
        // Add highlighted match
        parts.push(
            <span key={index} className="bg-yellow-400/40 text-yellow-200 rounded px-0.5">
                {text.slice(index, index + search.length)}
            </span>
        );
        lastIndex = index + search.length;
        index = lowerText.indexOf(lowerSearch, lastIndex);
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
}
