import type { CheerioAPI } from "cheerio";

export type TextTarget = {
  id: string;
  tag: string;
  className: string;
  text: string;
};

export type ImageTarget = {
  id: string;
  path: string;
  alt: string;
  className: string;
};

const SKIP_SUBTREE_TAGS = new Set(["script", "style", "noscript", "nav", "svg", "title"]);
const MIN_TEXT_LENGTH = 2;
const MAX_TEXT_LENGTH = 500;
const MAX_TEXT_TARGETS = 220;

/** Sentinel the copy-generation prompt is instructed to return when a slot's correct content
 * can't be determined from the hearing sheet — the element is hidden rather than filled with a guess. */
export const HIDDEN_TEXT_VALUE = "Hidden";

type ApplyFn = (value: string) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hideElement($node: any): void {
  const existing = $node.attr("style");
  $node.attr("style", existing ? `${existing};display:none` : "display:none");
  $node.text("");
}

/** Walks the whole document collecting every meaningful piece of visible text — both text-only
 * leaf elements (`<h1>text</h1>`) and loose text nodes mixed with icons/line-breaks
 * (`<a><i/> book now<br/><span>03-0000-0000</span></a>`) — so both can be rewritten independently. */
export function collectTextTargets($: CheerioAPI): { targets: TextTarget[]; apply: (id: string, value: string) => void } {
  const targets: TextTarget[] = [];
  const appliers = new Map<string, ApplyFn>();
  let counter = 0;

  function addTarget(tag: string, className: string, text: string, apply: ApplyFn) {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed.length < MIN_TEXT_LENGTH || trimmed.length > MAX_TEXT_LENGTH) return;
    const id = `t${counter++}`;
    targets.push({ id, tag, className, text: trimmed });
    appliers.set(id, apply);
  }

  function walk(node: import("domhandler").Element) {
    if (targets.length >= MAX_TEXT_TARGETS) return;
    const tag = (node.name || "").toLowerCase();
    if (SKIP_SUBTREE_TAGS.has(tag)) return;

    const $node = $(node);
    const className = $node.attr("class") ?? "";
    const contents = $node.contents().toArray();
    const elementChildren = contents.filter((c) => c.type === "tag") as import("domhandler").Element[];

    if (elementChildren.length === 0) {
      addTarget(tag, className, $node.text(), (value) => {
        if (value.trim() === HIDDEN_TEXT_VALUE) {
          hideElement($node);
        } else {
          $node.text(value);
        }
      });
      return;
    }

    for (const child of contents) {
      if (child.type === "text") {
        const textNode = child as unknown as { data: string };
        addTarget(tag, className, textNode.data, (value) => {
          textNode.data = value.trim() === HIDDEN_TEXT_VALUE ? "" : value;
        });
      }
    }

    for (const child of elementChildren) {
      walk(child);
    }
  }

  const titleNode = $("title").get(0);
  if (titleNode) {
    addTarget("title", "", $(titleNode).text(), (value) => {
      if (value.trim() !== HIDDEN_TEXT_VALUE) $(titleNode).text(value);
    });
  }
  const bodyNode = $("body").get(0);
  if (bodyNode) walk(bodyNode as import("domhandler").Element);

  return {
    targets,
    apply(id, value) {
      if (!value.trim()) return;
      appliers.get(id)?.(value);
    },
  };
}

/** Every distinct local image referenced on the page (external URLs and data URIs are left alone). */
export function collectImageTargets($: CheerioAPI): ImageTarget[] {
  const seen = new Set<string>();
  const targets: ImageTarget[] = [];
  let counter = 0;

  $("img").each((_, el) => {
    const $el = $(el);
    const src = ($el.attr("src") ?? "").trim();
    if (!src || seen.has(src)) return;
    if (/^([a-z]+:)?\/\//i.test(src) || src.startsWith("data:") || src.startsWith("/") || src.includes("..")) {
      return;
    }
    seen.add(src);
    targets.push({
      id: `img${counter++}`,
      path: src,
      alt: $el.attr("alt") ?? "",
      className: $el.attr("class") ?? "",
    });
  });

  return targets;
}

const PHONE_PATTERN = /^[0-9０-９()（）+\-ー\s]+$/;

/** Original template phone-number placeholders (e.g. "0120-000-000") among already-collected targets. */
export function isPhoneLikeText(text: string): boolean {
  return PHONE_PATTERN.test(text) && text.replace(/\D/g, "").length >= 8;
}
