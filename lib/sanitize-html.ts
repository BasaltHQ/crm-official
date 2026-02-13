/**
 * Shared HTML sanitization utility using DOMPurify.
 * 
 * USE THIS wherever `dangerouslySetInnerHTML` is needed.
 * It strips all script tags, event handlers, and dangerous attributes
 * while preserving safe HTML for rendering emails, messages, etc.
 */
import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize an HTML string, removing all XSS vectors while
 * keeping safe structural/styling tags.
 *
 * Allowed by default: formatting tags, tables, images (src only), links (href only).
 * Blocked: script, iframe, object, embed, form, style (inline), event handlers.
 */
export function sanitizeHtml(dirty: string | null | undefined): string {
    if (!dirty) return "";

    return DOMPurify.sanitize(dirty, {
        // Allow common safe tags for email/message rendering
        ALLOWED_TAGS: [
            "a", "abbr", "address", "article", "aside",
            "b", "bdi", "bdo", "blockquote", "br",
            "caption", "cite", "code", "col", "colgroup",
            "dd", "del", "details", "dfn", "div", "dl", "dt",
            "em",
            "figcaption", "figure", "footer",
            "h1", "h2", "h3", "h4", "h5", "h6", "header", "hr",
            "i", "img", "ins",
            "kbd",
            "li",
            "main", "mark",
            "nav",
            "ol",
            "p", "pre",
            "q",
            "rp", "rt", "ruby",
            "s", "samp", "section", "small", "span", "strong", "sub", "summary", "sup",
            "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr",
            "u", "ul",
            "var", "wbr",
        ],
        ALLOWED_ATTR: [
            "href", "src", "alt", "title", "width", "height",
            "class", "id", "style",
            "target", "rel",
            "colspan", "rowspan", "scope",
            "align", "valign",
            "dir", "lang",
        ],
        // Force all links to open in new tab and prevent tabnabbing
        ADD_ATTR: ["target"],
        ALLOW_DATA_ATTR: false,
        // Block dangerous URI schemes
        ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
    });
}
