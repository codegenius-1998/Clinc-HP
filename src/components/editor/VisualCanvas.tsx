"use client";

import { useCallback, useEffect, useRef } from "react";
import { blockSupportsPadding, resolveFieldDefinition } from "@/lib/site/blocks";
import { getFieldValue } from "@/lib/site/fieldPath";
import type { SiteDocument } from "@/lib/site/document";
import { resolveImageSrc } from "./fields";
import type { Selection } from "./Inspector";

/** The center preview pane: owns the iframe and, since it's always same-origin with the editor
 * (`/generated/<slug>/index.html` is served by this same Next.js app), reaches directly into
 * `iframe.contentDocument` — no postMessage needed. Turns every `[data-field]` element (see
 * components.tsx) into a click target: click selects it (reported via `onSelect`) and, for text
 * fields, makes it directly editable in place; click elsewhere deselects.
 *
 * The iframe fully remounts (`key={previewVersion}`) after every Save, which destroys the previous
 * `contentDocument` — so all of this setup happens in `onLoad` and re-runs on every load, not just
 * the first, including re-applying whichever selection was active before the reload. */

type FieldEdit = Selection & { value: string };

const OUTLINE_STYLE = `
  [data-field] { cursor: text; }
  [data-field]:hover { outline: 2px dashed #2563eb; outline-offset: 2px; }
  [data-field].clinc-selected { outline: 2px solid #2563eb; outline-offset: 2px; }
`;

/** Deliberately typed on `Element`, not `HTMLElement`, and never does an `instanceof` check: the nodes
 * this walks belong to the IFRAME's document, a different JS realm than this component's own code. A
 * realm has its own global constructors, so `node instanceof HTMLElement` — where `HTMLElement` here
 * resolves to the PARENT frame's constructor — is `false` for every iframe element, even though
 * they're "real" HTMLElements in their own document. `Element.hasAttribute`/`.id` don't need the
 * narrower type, so there's nothing an instanceof check would have bought here anyway. */
function findAncestor(el: Element | null, root: Element, predicate: (el: Element) => boolean): Element | null {
  let node: Element | null = el;
  while (node && node !== root.parentElement) {
    if (predicate(node)) return node;
    node = node.parentElement;
  }
  return null;
}

export function VisualCanvas({
  doc,
  previewUrl,
  previewVersion,
  assetBase,
  selection,
  onSelect,
  onTextEdit,
}: {
  doc: SiteDocument;
  previewUrl: string;
  previewVersion: string;
  assetBase: string;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onTextEdit: (edit: FieldEdit) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentFieldRef = useRef<HTMLElement | null>(null);
  const cleanupRef = useRef<() => void>(() => {});

  // "Latest ref" pattern: onLoad only fires on (re)mount, but it needs the CURRENT doc/selection/
  // callbacks, not whatever they were when the iframe last loaded — refs sidestep re-registering
  // listeners (and their attendant risk of double-attachment under Strict Mode) on every render.
  // Assigned from an effect, not during render, per this project's react-hooks/refs rule.
  const docRef = useRef(doc);
  const selectionRef = useRef(selection);
  const assetBaseRef = useRef(assetBase);
  const onSelectRef = useRef(onSelect);
  const onTextEditRef = useRef(onTextEdit);
  useEffect(() => {
    docRef.current = doc;
    selectionRef.current = selection;
    assetBaseRef.current = assetBase;
    onSelectRef.current = onSelect;
    onTextEditRef.current = onTextEdit;
  });

  const handleLoad = useCallback(() => {
    cleanupRef.current();

    const cdoc = iframeRef.current?.contentDocument;
    if (!cdoc || !cdoc.body) return;

    // handleLoad can legitimately run twice for the same document — the mount-time readyState check
    // below and a native `load` event can both fire for one load — so guard against injecting a
    // second copy of the outline stylesheet.
    if (!cdoc.getElementById("clinc-editor-outline")) {
      const style = cdoc.createElement("style");
      style.id = "clinc-editor-outline";
      style.textContent = OUTLINE_STYLE;
      cdoc.head.appendChild(style);
    }

    function commitCurrentField() {
      const el = currentFieldRef.current;
      const sel = selectionRef.current;
      if (!el || !sel) return;
      // .innerText (not .textContent) collapses to what's actually rendered, then flattening the
      // element's own content back to that plain string is what guarantees stray formatting (a pasted
      // <b>, autocorrect inserting a <div>) can never survive into the stored, plain-string field.
      const value = (el.innerText || "").replace(/\r\n/g, "\n").trim();
      el.textContent = value;
      onTextEditRef.current({ ...sel, value });
    }

    function applySelection(sel: Selection | null) {
      if (currentFieldRef.current) {
        commitCurrentField();
        currentFieldRef.current.removeAttribute("contenteditable");
      }
      currentFieldRef.current = null;
      cdoc!.querySelectorAll(".clinc-selected").forEach((n) => n.classList.remove("clinc-selected"));
      if (!sel) return;

      const blockRoot = cdoc!.getElementById(sel.blockId);
      const el = blockRoot?.querySelector<HTMLElement>(`[data-field="${CSS.escape(sel.fieldPath)}"]`);
      if (!el) return;
      el.classList.add("clinc-selected");

      const block = docRef.current.blocks.find((b) => b.id === sel.blockId);
      const field = block ? resolveFieldDefinition(block.type, sel.fieldPath) : null;
      if (field && (field.type === "text" || field.type === "textarea")) {
        try {
          el.contentEditable = "plaintext-only";
        } catch {
          // Safari doesn't support plaintext-only; falls through to the isContentEditable check below.
        }
        if (!el.isContentEditable) el.contentEditable = "true";
        currentFieldRef.current = el;
        el.focus();
      }
    }

    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const fieldEl = findAncestor(target, cdoc!.body, (n) => n.hasAttribute("data-field"));

      if (fieldEl) {
        // Always stop the click here: this is a `main.js`-authored page, and its own bubble-phase
        // listeners (the FAQ accordion toggle, most notably) would otherwise still fire underneath
        // an edit — clicking a question to edit it would also flip it open/closed.
        event.preventDefault();
        event.stopPropagation();
        // A block's outer element id IS block.id (see components.tsx's Section/Hero/ImageBanner), but
        // that id is not always "blk_..." — only blocks added via the palette get a newBlockId() one;
        // the stock template's blocks (see defaultTemplate.ts) use plain, hand-authored ids like
        // "hero" or "department". Membership in the actual document is the only reliable test.
        const blockIds = new Set(docRef.current.blocks.map((b) => b.id));
        const blockId = findAncestor(fieldEl, cdoc!.body, (n) => blockIds.has(n.id))?.id;
        const fieldPath = fieldEl.getAttribute("data-field");
        if (!blockId || !fieldPath) return;
        const sel = selectionRef.current;
        if (sel && sel.blockId === blockId && sel.fieldPath === fieldPath) return; // already selected
        applySelection({ blockId, fieldPath });
        onSelectRef.current({ blockId, fieldPath });
        return;
      }

      const link = target?.closest("a[href]");
      if (link) {
        // Never let the preview navigate itself away — a LINE/tel/nav link inside the iframe would
        // otherwise try to leave the generated page (or open a dialer/messaging-app prompt) instead
        // of just being previewed.
        event.preventDefault();
      }
      if (currentFieldRef.current || selectionRef.current) {
        applySelection(null);
        onSelectRef.current(null);
      }
    }

    function onPaste(event: ClipboardEvent) {
      if (event.target !== currentFieldRef.current) return;
      event.preventDefault();
      const text = event.clipboardData?.getData("text/plain") ?? "";
      cdoc!.execCommand("insertText", false, text);
    }

    function onKeydown(event: KeyboardEvent) {
      if (event.target !== currentFieldRef.current || event.key !== "Enter") return;
      const sel = selectionRef.current;
      const block = sel ? docRef.current.blocks.find((b) => b.id === sel.blockId) : null;
      const field = block && sel ? resolveFieldDefinition(block.type, sel.fieldPath) : null;
      // Single-line fields (headings, labels, ...) commit on Enter rather than inserting a line break
      // the browser would otherwise render as a stray <div>/<br> once flattened on commit.
      if (field?.type !== "textarea") {
        event.preventDefault();
        currentFieldRef.current?.blur();
      }
    }

    function onFocusOut(event: FocusEvent) {
      if (event.target === currentFieldRef.current) commitCurrentField();
    }

    cdoc.addEventListener("click", onClick, true);
    cdoc.addEventListener("paste", onPaste, true);
    cdoc.addEventListener("keydown", onKeydown, true);
    cdoc.addEventListener("focusout", onFocusOut, true);

    // The iframe just remounted (e.g. after Save) — restore whatever was selected a moment ago rather
    // than leaving the canvas looking inert until the next click.
    applySelection(selectionRef.current);

    cleanupRef.current = () => {
      cdoc.removeEventListener("click", onClick, true);
      cdoc.removeEventListener("paste", onPaste, true);
      cdoc.removeEventListener("keydown", onKeydown, true);
      cdoc.removeEventListener("focusout", onFocusOut, true);
    };
  }, []);

  // The iframe's `src` is already present in the server-rendered HTML (this whole page is SSR'd), so
  // the browser can start — and finish — loading it before React finishes hydrating and attaches the
  // native `load` listener behind the `onLoad` prop below. When that race is lost, the event fires
  // into a void and the canvas is inert until the next Save remounts the iframe. This effect runs once
  // on mount and, if the content had already finished loading by then, runs the same setup directly;
  // `handleLoad` starts by tearing down any previous listeners, so calling it twice for one document
  // (if `onLoad` still manages to fire too) is harmless, not a double-attachment.
  useEffect(() => {
    if (iframeRef.current?.contentDocument?.readyState === "complete") handleLoad();
  }, [handleLoad]);

  // Live-syncs every non-structural edit (text, per-field style, block spacing, images) straight into
  // the loaded iframe's DOM, regardless of whether it came from a canvas click or the sidebar's
  // BlockEditor — so the two editing surfaces can never visibly disagree with each other. Structural
  // edits (add/remove/reorder blocks or list items) still need a real Save, since only the server can
  // re-render the HTML shape itself.
  useEffect(() => {
    const cdoc = iframeRef.current?.contentDocument;
    if (!cdoc || !cdoc.body) return;

    for (const block of doc.blocks) {
      const root = cdoc.getElementById(block.id);
      if (!root) continue;

      root.querySelectorAll<HTMLElement>("[data-field]").forEach((el) => {
        const path = el.getAttribute("data-field");
        if (!path) return;
        const field = resolveFieldDefinition(block.type, path);
        if (!field) return;

        if (field.type === "image") {
          // Same cross-realm reasoning as findAncestor above: `el instanceof HTMLImageElement` would
          // be false here (the iframe's HTMLImageElement isn't this frame's), so this checks the tag
          // name instead — an `as HTMLImageElement` cast is safe once that's confirmed.
          const value = getFieldValue(block.data, path);
          if (typeof value === "string" && el.tagName === "IMG") {
            const img = el as HTMLImageElement;
            const resolved = resolveImageSrc(value, assetBaseRef.current);
            if (resolved && img.getAttribute("src") !== value) img.src = resolved;
          }
          return;
        }

        // Never overwrite the element the user is actively typing into — that would reset their
        // cursor position mid-keystroke. It's safe to skip: nothing else writes to `doc` for a field
        // that's still being edited, since edits only reach `doc` on commit (blur/Enter).
        if (el === currentFieldRef.current && cdoc.activeElement === el) return;

        const value = getFieldValue(block.data, path);
        if (typeof value === "string" && el.textContent !== value) el.textContent = value;

        const textStyle = block.textStyles?.[path];
        el.style.color = textStyle?.color ?? "";
        el.style.fontFamily = textStyle?.fontFamily ?? "";
        el.style.fontSize = textStyle?.fontSize !== undefined ? `${textStyle.fontSize}px` : "";
        el.style.fontWeight = textStyle?.fontWeight !== undefined ? String(textStyle.fontWeight) : "";
      });

      const spacing = block.spacing;
      const supportsPadding = blockSupportsPadding(block.type);
      root.style.paddingTop = supportsPadding && spacing?.paddingTop !== undefined ? `${spacing.paddingTop}px` : "";
      root.style.paddingBottom =
        supportsPadding && spacing?.paddingBottom !== undefined ? `${spacing.paddingBottom}px` : "";
      root.style.marginTop = spacing?.marginTop !== undefined ? `${spacing.marginTop}px` : "";
      root.style.marginBottom = spacing?.marginBottom !== undefined ? `${spacing.marginBottom}px` : "";
    }
  }, [doc]);

  return (
    <iframe
      key={previewVersion}
      ref={iframeRef}
      onLoad={handleLoad}
      src={`${previewUrl}?v=${encodeURIComponent(previewVersion)}`}
      title="プレビュー"
      className="h-full w-full"
    />
  );
}
