import { newBlockId, type Block, type BlockType } from "./document";

/** The fixed block-type catalog — the "Sectionは固定" half of the design. Section TYPES live here in
 * code (not in the D1 `sections` table, which only mirrors these rows so the foreign key resolves);
 * how MANY of each a page has and in what order is free, and lives in the document's `blocks` array.
 *
 * This module is deliberately React-free. It is imported by the editor, which is a client component,
 * so pulling the server-side render components in here would drag the whole renderer into the browser
 * bundle. The type -> component mapping lives in src/lib/render/components.tsx instead; the two are
 * kept in step by both switching exhaustively over `BlockType`.
 *
 * `fields` is what makes the editor generic: BlockEditor.tsx walks this list and builds the form, so
 * adding a field to a block means editing one entry here — not touching the editor at all. */

export type LeafField = {
  key: string;
  label: string;
  type: "text" | "textarea" | "image" | "url";
  placeholder?: string;
  optional?: boolean;
};

export type SelectField = {
  key: string;
  label: string;
  type: "select";
  options: { value: string; label: string }[];
  /** Write the chosen value back as a number rather than a string (gallery columns, etc.). */
  numeric?: boolean;
};

export type ListField = {
  key: string;
  label: string;
  type: "list";
  /** Singular noun for the add/remove buttons — "スタッフを追加" etc. */
  itemLabel: string;
  fields: LeafField[];
  newItem: () => Record<string, string>;
  max?: number;
};

export type BlockField = LeafField | SelectField | ListField;

export type BlockDefinition = {
  type: BlockType;
  label: string;
  description: string;
  /** Shown in the "add block" palette. Plain emoji — the palette is a list, not an icon set. */
  icon: string;
  /** Default nav label for a freshly added block. Empty = not linked from the nav (hero, banners). */
  defaultNavLabel: string;
  /** Structural blocks a page can only sensibly have one of; the palette greys these out once used. */
  singleton: boolean;
  fields: BlockField[];
  defaultData: () => Record<string, unknown>;
};

const PLACEHOLDER_IMAGE = "images/placeholder.jpg";

export const BLOCK_DEFINITIONS: Record<BlockType, BlockDefinition> = {
  hero: {
    type: "hero",
    label: "メインビジュアル",
    description: "ページ最上部の大きな画像とキャッチコピー。",
    icon: "🖼",
    defaultNavLabel: "",
    singleton: true,
    fields: [
      { key: "headline", label: "キャッチコピー", type: "text" },
      { key: "subheadline", label: "サブコピー", type: "textarea", optional: true },
      { key: "image", label: "背景画像", type: "image" },
    ],
    defaultData: () => ({ headline: "", subheadline: "", image: PLACEHOLDER_IMAGE }),
  },

  rich: {
    type: "rich",
    label: "文章＋カード",
    description: "見出し・本文と、写真つきカードの一覧。診療科案内・ご挨拶・特徴・施設案内はすべてこれ。",
    icon: "📝",
    defaultNavLabel: "セクション",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      { key: "body", label: "本文", type: "textarea" },
      { key: "image", label: "セクション画像", type: "image", optional: true },
      {
        key: "cards",
        label: "カード",
        type: "list",
        itemLabel: "カード",
        fields: [
          { key: "heading", label: "カード見出し", type: "text" },
          { key: "body", label: "カード本文", type: "textarea" },
          { key: "image", label: "カード画像", type: "image", optional: true },
        ],
        newItem: () => ({ heading: "", body: "", image: "" }),
      },
    ],
    defaultData: () => ({ heading: "", body: "", cards: [] }),
  },

  hours: {
    type: "hours",
    label: "診療時間",
    description: "曜日ごとの診療時間の表。",
    icon: "🕐",
    defaultNavLabel: "診療時間",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      {
        key: "rows",
        label: "時間の行",
        type: "list",
        itemLabel: "行",
        fields: [
          { key: "label", label: "曜日・区分", type: "text" },
          { key: "value", label: "時間", type: "text" },
        ],
        newItem: () => ({ label: "", value: "" }),
      },
      { key: "note", label: "補足", type: "textarea", optional: true },
    ],
    defaultData: () => ({ heading: "診療時間", rows: [] }),
  },

  access: {
    type: "access",
    label: "アクセス",
    description: "住所と地図。",
    icon: "📍",
    defaultNavLabel: "アクセス",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      { key: "address", label: "住所", type: "textarea" },
      { key: "mapQuery", label: "地図の検索語", type: "text", placeholder: "空欄なら住所をそのまま使います" },
      { key: "note", label: "補足", type: "textarea", optional: true },
    ],
    defaultData: () => ({ heading: "アクセス", address: "", mapQuery: "" }),
  },

  news: {
    type: "news",
    label: "お知らせ",
    description: "日付つきのお知らせ一覧。",
    icon: "📰",
    defaultNavLabel: "お知らせ",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      {
        key: "items",
        label: "お知らせ",
        type: "list",
        itemLabel: "お知らせ",
        fields: [
          { key: "date", label: "日付", type: "text", placeholder: "2026.04.01" },
          { key: "title", label: "タイトル", type: "text" },
          { key: "body", label: "本文", type: "textarea", optional: true },
        ],
        newItem: () => ({ date: "", title: "", body: "" }),
      },
    ],
    defaultData: () => ({ heading: "お知らせ", items: [] }),
  },

  staff: {
    type: "staff",
    label: "スタッフ紹介",
    description: "写真つきのスタッフカード。",
    icon: "👩‍⚕️",
    defaultNavLabel: "スタッフ紹介",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      {
        key: "members",
        label: "スタッフ",
        type: "list",
        itemLabel: "スタッフ",
        fields: [
          { key: "name", label: "氏名", type: "text" },
          { key: "role", label: "役職", type: "text", optional: true },
          { key: "comment", label: "コメント", type: "textarea" },
          { key: "image", label: "写真", type: "image", optional: true },
        ],
        newItem: () => ({ name: "", role: "", comment: "", image: "" }),
      },
    ],
    defaultData: () => ({ heading: "スタッフ紹介", members: [] }),
  },

  faq: {
    type: "faq",
    label: "よくある質問",
    description: "クリックで開閉する Q&A。",
    icon: "❓",
    defaultNavLabel: "よくある質問",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      {
        key: "items",
        label: "質問",
        type: "list",
        itemLabel: "質問",
        fields: [
          { key: "question", label: "質問", type: "text" },
          { key: "answer", label: "回答", type: "textarea" },
        ],
        newItem: () => ({ question: "", answer: "" }),
      },
    ],
    defaultData: () => ({ heading: "よくある質問", items: [] }),
  },

  pricing: {
    type: "pricing",
    label: "料金表",
    description: "料金の一覧表。",
    icon: "💴",
    defaultNavLabel: "料金表",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      {
        key: "items",
        label: "料金",
        type: "list",
        itemLabel: "料金",
        fields: [
          { key: "name", label: "項目名", type: "text" },
          { key: "price", label: "金額", type: "text" },
          { key: "note", label: "備考", type: "text", optional: true },
        ],
        newItem: () => ({ name: "", price: "", note: "" }),
      },
      { key: "note", label: "注意書き", type: "textarea", optional: true },
    ],
    defaultData: () => ({ heading: "料金表", items: [] }),
  },

  contact: {
    type: "contact",
    label: "お問い合わせ",
    description: "電話・LINE の予約ボタン。番号は「基本情報」から取ります。",
    icon: "📞",
    defaultNavLabel: "お問い合わせ",
    singleton: true,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      { key: "lead", label: "リード文", type: "textarea" },
    ],
    defaultData: () => ({
      heading: "お問い合わせ・ご予約",
      lead: "お電話またはLINEにて、お気軽にご相談・ご予約ください。",
    }),
  },

  freeText: {
    type: "freeText",
    label: "自由文",
    description: "見出しと本文だけの、写真のないシンプルな区切り。",
    icon: "✍️",
    defaultNavLabel: "",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text", optional: true },
      { key: "body", label: "本文", type: "textarea" },
      {
        key: "align",
        label: "文字揃え",
        type: "select",
        options: [
          { value: "left", label: "左揃え" },
          { value: "center", label: "中央揃え" },
        ],
      },
    ],
    defaultData: () => ({ heading: "", body: "", align: "center" }),
  },

  imageBanner: {
    type: "imageBanner",
    label: "画像バナー",
    description: "横幅いっぱいの帯状の画像。セクションの区切りに使います。",
    icon: "🏞",
    defaultNavLabel: "",
    singleton: false,
    fields: [
      { key: "image", label: "画像", type: "image" },
      { key: "caption", label: "重ねる文字", type: "text", optional: true },
      { key: "href", label: "リンク先", type: "url", optional: true },
      {
        key: "height",
        label: "高さ",
        type: "select",
        options: [
          { value: "short", label: "低め" },
          { value: "tall", label: "高め" },
        ],
      },
    ],
    defaultData: () => ({ image: PLACEHOLDER_IMAGE, height: "short" }),
  },

  gallery: {
    type: "gallery",
    label: "写真ギャラリー",
    description: "写真をタイル状に並べます。院内の様子などに。",
    icon: "🖼️",
    defaultNavLabel: "ギャラリー",
    singleton: false,
    fields: [
      { key: "heading", label: "見出し", type: "text" },
      {
        key: "images",
        label: "写真",
        type: "list",
        itemLabel: "写真",
        fields: [
          { key: "src", label: "画像", type: "image" },
          { key: "caption", label: "キャプション", type: "text", optional: true },
        ],
        newItem: () => ({ src: "", caption: "" }),
      },
      {
        key: "columns",
        label: "横に並べる数",
        type: "select",
        numeric: true,
        options: [
          { value: "2", label: "2列" },
          { value: "3", label: "3列" },
          { value: "4", label: "4列" },
        ],
      },
    ],
    defaultData: () => ({ heading: "院内の様子", images: [], columns: 3 }),
  },
};

/** Palette order — roughly the order these read best down a clinic page. */
export const BLOCK_PALETTE: BlockDefinition[] = [
  BLOCK_DEFINITIONS.hero,
  BLOCK_DEFINITIONS.rich,
  BLOCK_DEFINITIONS.news,
  BLOCK_DEFINITIONS.hours,
  BLOCK_DEFINITIONS.staff,
  BLOCK_DEFINITIONS.pricing,
  BLOCK_DEFINITIONS.faq,
  BLOCK_DEFINITIONS.gallery,
  BLOCK_DEFINITIONS.imageBanner,
  BLOCK_DEFINITIONS.freeText,
  BLOCK_DEFINITIONS.access,
  BLOCK_DEFINITIONS.contact,
];

export function blockLabel(type: BlockType): string {
  return BLOCK_DEFINITIONS[type].label;
}

/** Builds a fresh, schema-valid block. The cast is safe because each definition's `defaultData`
 * returns exactly the shape its own variant declares in document.ts — the two are edited together. */
export function createBlock(type: BlockType, overrides?: Partial<Omit<Block, "type" | "data">>): Block {
  const def = BLOCK_DEFINITIONS[type];
  return {
    id: newBlockId(),
    type,
    visible: true,
    navLabel: def.defaultNavLabel,
    data: def.defaultData(),
    ...overrides,
  } as Block;
}

/** A short human summary of a block, for the editor's block list — so a page with four "文章＋カード"
 * blocks doesn't show four identical rows. */
export function blockSummary(block: Block): string {
  switch (block.type) {
    case "hero":
      return block.data.headline || "（キャッチコピー未設定）";
    case "rich":
      return block.data.heading || "（見出し未設定）";
    case "imageBanner":
      return block.data.caption || "（画像のみ）";
    case "freeText":
      return block.data.heading || block.data.body.slice(0, 20) || "（本文未設定）";
    default:
      return block.data.heading || BLOCK_DEFINITIONS[block.type].label;
  }
}
