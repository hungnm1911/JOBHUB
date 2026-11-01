import { compile } from "html-to-text";
import sanitizeHtml from "sanitize-html";

const SHARED_TAGS = ["p", "br", "strong", "em", "u", "ul", "ol", "li", "a"];
const FULL_TAGS = [...SHARED_TAGS, "h1", "h2", "h3", "span", "mark"];
const FONT_FAMILIES = new Set(["Arial", "Georgia", "Times New Roman"]);
const FONT_SIZES = new Set(["12px", "14px", "16px", "18px", "24px"]);
const ALIGNMENTS = new Set(["left", "center", "right", "justify"]);
const BLOCK_CONTAINERS = ["div", "section", "article", "header", "footer", "blockquote", "pre"];
const NON_TEXT_TAGS = ["script", "style", "textarea", "option", "xmp", "iframe", "object", "svg", "math", "template", "noscript"];

const toBlock = () => ({ tagName: "p" });
const BLOCK_TRANSFORMS = Object.fromEntries(BLOCK_CONTAINERS.map((tag) => [tag, toBlock]));

function safeHref(href) {
  if (!href || /[\s\\]/u.test(href)) return false;
  for (const character of href) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) return false;
  }
  if (href.startsWith("#") || /^(?:\/(?!\/)|\.\.?\/)/.test(href)) return true;
  if (/^(?:mailto|tel):[^:]+$/i.test(href)) return true;
  if (!/^https?:\/\//i.test(href)) return false;
  try {
    return ["http:", "https:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

function validColor(value) {
  if (/^#[0-9a-f]{6}$/i.test(value)) return true;
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value);
  return Boolean(rgb) && rgb.slice(1).every((channel) => Number(channel) <= 255);
}

function allowedStyle(tag, style) {
  const declarations = new Map();
  for (const declaration of style.split(";")) {
    const parts = declaration.split(":");
    if (parts.length !== 2) continue;
    const property = parts[0].trim().toLowerCase();
    const value = parts[1].trim();
    if (
      (property === "text-align" && ["p", "h1", "h2", "h3"].includes(tag) && ALIGNMENTS.has(value)) ||
      (tag === "span" && property === "font-family" && FONT_FAMILIES.has(value.replace(/^(?:"(.*)"|'(.*)')$/, "$1$2"))) ||
      (tag === "span" && property === "font-size" && FONT_SIZES.has(value)) ||
      (tag === "span" && property === "color" && validColor(value))
    ) declarations.set(property, value);
  }
  return [...declarations].map(([property, value]) => `${property}: ${value}`).join("; ");
}

function sanitizeLink(tagName, attributes) {
  const href = safeHref(attributes.href) ? attributes.href : undefined;
  const target = href && attributes.target === "_blank" ? "_blank" : undefined;
  return {
    tagName,
    attribs: {
      ...(href && { href }),
      ...(target && { target, rel: "noopener noreferrer" }),
    },
  };
}

function styleTransform(tagName, attributes) {
  const style = allowedStyle(tagName, attributes.style ?? "");
  return { tagName, attribs: style ? { style } : {} };
}

function orderedListTransform(tagName, attributes) {
  const start = /^[+-]?\d+$/.test(attributes.start ?? "") ? attributes.start : undefined;
  const type = ["1", "a", "A", "i", "I"].includes(attributes.type) ? attributes.type : undefined;
  return { tagName, attribs: { ...(start && { start }), ...(type && { type }) } };
}

const FULL_TRANSFORMS = {
  ...BLOCK_TRANSFORMS,
  h4: toBlock,
  h5: toBlock,
  h6: toBlock,
  a: sanitizeLink,
  ol: orderedListTransform,
  p: styleTransform,
  h1: styleTransform,
  h2: styleTransform,
  h3: styleTransform,
  span: styleTransform,
};
const MINIMAL_TRANSFORMS = {
  ...BLOCK_TRANSFORMS,
  h1: toBlock,
  h2: toBlock,
  h3: toBlock,
  h4: toBlock,
  h5: toBlock,
  h6: toBlock,
  a: sanitizeLink,
  ol: orderedListTransform,
};

const SANITIZE_OPTIONS = {
  full: {
    allowedTags: FULL_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"], ol: ["start", "type"], p: ["style"], h1: ["style"], h2: ["style"], h3: ["style"], span: ["style"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    nonTextTags: NON_TEXT_TAGS,
    transformTags: FULL_TRANSFORMS,
  },
  minimal: {
    allowedTags: SHARED_TAGS,
    allowedAttributes: { a: ["href", "target", "rel"], ol: ["start", "type"] },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    nonTextTags: NON_TEXT_TAGS,
    transformTags: MINIMAL_TRANSFORMS,
  },
};

const toPlainText = compile({
  wordwrap: false,
  whitespaceCharacters: " \t\r\n\f\u200b\u00a0",
  selectors: [
    { selector: "a", format: "inline" },
    ...["h1", "h2", "h3", "ol", "ul"].map((selector) => ({ selector, format: "block" })),
    { selector: "li", format: "block", options: { leadingLineBreaks: 1, trailingLineBreaks: 1 } },
  ],
});

// The caller applies each resource's existing required-content and length validation to text.
function normalizeRichText(html, preset = "full") {
  if (preset !== "full" && preset !== "minimal") throw new Error("Unknown rich text preset");
  const sanitized = sanitizeHtml(html ?? "", SANITIZE_OPTIONS[preset]);
  const text = toPlainText(sanitized).replace(/\n{3,}/g, "\n\n").trim();
  return { html: text ? sanitized : "", text };
}

export { normalizeRichText };
