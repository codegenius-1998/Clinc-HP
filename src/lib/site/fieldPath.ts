import { resolveFieldDefinition } from "./blocks";
import type { Block, SiteDocument } from "./document";

/** Reads and writes a block's `data` by field path (see document.ts's field-path convention: a bare
 * top-level key, or "<listKey>.<index>.<subKey>" for one item inside a list field). Deliberately
 * React-free, like blocks.ts — used by both the server-side prune step (editorActions.ts) and the
 * client-side visual canvas/Inspector. */

export type ParsedFieldPath = { key: string; index?: number; subKey?: string };

export function parseFieldPath(path: string): ParsedFieldPath {
  const [key, indexStr, subKey] = path.split(".");
  return indexStr === undefined ? { key } : { key, index: Number(indexStr), subKey };
}

export function getFieldValue(data: Record<string, unknown>, path: string): unknown {
  const { key, index, subKey } = parseFieldPath(path);
  const top = data[key];
  if (index === undefined) return top;
  if (!Array.isArray(top)) return undefined;
  const item = top[index];
  if (subKey === undefined || item === null || typeof item !== "object") return item;
  return (item as Record<string, unknown>)[subKey];
}

/** Immutable — always returns a new `data` object (and, for list items, a new array and a new item
 * object), never mutates `data` in place. Silently no-ops (returns `data` unchanged) if `path` names a
 * list index that doesn't exist, which can only happen if the caller is stale (e.g. the list item was
 * deleted via the sidebar between the canvas rendering it and the user's edit committing). */
export function setFieldValue(data: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const { key, index, subKey } = parseFieldPath(path);
  if (index === undefined) return { ...data, [key]: value };

  const top = data[key];
  if (!Array.isArray(top) || index < 0 || index >= top.length) return data;
  const nextArray = top.slice();
  if (subKey === undefined) {
    nextArray[index] = value;
  } else {
    const item = nextArray[index];
    if (item === null || typeof item !== "object") return data;
    nextArray[index] = { ...(item as Record<string, unknown>), [subKey]: value };
  }
  return { ...data, [key]: nextArray };
}

/** Drops `textStyles` entries that no longer resolve to a real field on that block's type — the
 * residue of a field being renamed/removed from BLOCK_DEFINITIONS, or (defensively) a stale/tampered
 * path. The schema's regex (document.ts) only screens out garbage-shaped keys; it can't know which
 * paths are valid for a given block *type*, since that requires cross-referencing BLOCK_DEFINITIONS —
 * this is the check that actually does that. Called from saveDocumentAction right before persisting. */
export function pruneOrphanedStyles(doc: SiteDocument): SiteDocument {
  return {
    ...doc,
    blocks: doc.blocks.map((block): Block => {
      let next = block;

      if (next.textStyles) {
        const entries = Object.entries(next.textStyles).filter(
          ([path]) => resolveFieldDefinition(next.type, path) !== null
        );
        if (entries.length !== Object.keys(next.textStyles).length) {
          next = { ...next, textStyles: entries.length > 0 ? Object.fromEntries(entries) : undefined };
        }
      }

      if (next.containerStyles) {
        const entries = Object.entries(next.containerStyles).filter(([path]) => containerExists(next, path));
        if (entries.length !== Object.keys(next.containerStyles).length) {
          next = { ...next, containerStyles: entries.length > 0 ? Object.fromEntries(entries) : undefined };
        }
      }

      return next;
    }),
  };
}

/** Whether a container path still names a box the renderer actually draws for this block. "section"
 * and "inner" always exist; a "card.<n>" only exists while the block still has that many cards, so
 * deleting the third card must not leave its styling behind to be re-applied to a future third card. */
function containerExists(block: Block, path: string): boolean {
  if (path === "section" || path === "inner") return true;
  const card = /^card\.(\d+)$/.exec(path);
  if (!card) return false;
  const cards = getFieldValue(block.data, "cards");
  return Array.isArray(cards) && Number(card[1]) < cards.length;
}
