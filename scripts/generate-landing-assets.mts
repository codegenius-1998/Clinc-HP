// Generates the photographs used on the public landing page (src/app/page.tsx).
//
//   npx tsx scripts/generate-landing-assets.mts            # 足りないものだけ作る
//   npx tsx scripts/generate-landing-assets.mts --force    # 全部作り直す（課金あり）
//   npx tsx scripts/generate-landing-assets.mts hero cta   # 指定したものだけ
//
// ⚠️ 課金があります。1枚あたり gpt-image-2 の medium 品質1回分です。既にあるファイルは既定で
// 飛ばすので、うっかり二重に払うことはありません。
//
// Why generated rather than stock: this product's entire claim is that a clinic does not need to hire
// a photographer, so a landing page built on licensed stock photography would be arguing against
// itself. It also keeps the whole page free of third-party image rights.
//
// ⚠️ Every prompt below forbids people's faces and readable text. Faces because a recognisable person
// on a medical sales page implies a patient or a doctor who never consented to being there, and text
// because image models render Japanese as convincing nonsense.
//
// The screenshots of actual generated homepages are NOT made here — those come from
// scripts/shoot-templates.mts, which photographs the real renders. Nothing on this page asks a model
// to imagine what this app's output looks like.
import { mkdir, readFile, writeFile, access } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "public", "landing");

const SHARED_STYLE =
  "Editorial photography for a Japanese medical clinic brand. Natural daylight, calm and airy, " +
  "warm neutral palette of off-white, pale oak and muted sage green. Shallow depth of field, soft " +
  "shadows, generous empty space in the frame. No people and no faces. No text, no lettering, no " +
  "signage, no logo, no watermark, no user interface. Nothing that looks clinical-cold or stock-photo staged.";

type Asset = { key: string; size: string; prompt: string; note: string };

const ASSETS: Asset[] = [
  {
    key: "hero",
    size: "1536x1024",
    note: "ヒーローの背景",
    prompt:
      "The waiting area of a small private clinic in Japan early in the morning, before opening. " +
      "Light oak bench seating, a large window with sheer curtains, one potted plant, a pale wall. " +
      "Shot wide from a low angle with the left third of the frame almost empty so text can sit over it.",
  },
  {
    key: "flow-01",
    size: "1024x1024",
    note: "制作の流れ 01（入力）",
    prompt:
      "A quiet desk by a window: an open blank notebook, a fountain pen, a cup of tea, a folded pair " +
      "of reading glasses, and a few loose sheets of plain paper. Seen from directly above. " +
      "The moment before someone writes down what their clinic is.",
  },
  {
    key: "flow-02",
    size: "1024x1024",
    note: "制作の流れ 02（AIが作る）",
    prompt:
      "Blank printed page layouts spread out on a pale oak table, overlapping slightly, all of them " +
      "empty white paper with no printing on them at all. Morning light rakes across from the left. " +
      "A designer's table mid-composition, with nobody at it.",
  },
  {
    key: "flow-03",
    size: "1024x1024",
    note: "制作の流れ 03（手直しして公開）",
    prompt:
      "An open laptop on a clean pale desk beside a window, its screen a plain soft neutral glow with " +
      "absolutely nothing displayed on it. A small green plant beside it, a glass of water. " +
      "Late afternoon light. Nobody in the frame.",
  },
  {
    key: "assurance",
    size: "1024x1024",
    note: "安心のしくみ",
    prompt:
      "A corner of a consultation room in a small clinic: a folded clean white cloth on a pale wooden " +
      "surface, a single sprig of green in a small ceramic vase, a soft grey wall behind. " +
      "Very close, very still, almost a still life.",
  },
  {
    key: "cta",
    size: "1536x1024",
    note: "最後の申し込み帯",
    prompt:
      "The entrance of a small neighbourhood clinic seen from the street on a clear morning: a plain " +
      "pale facade, a glass door catching the light, low green planting either side, a strip of sky. " +
      "Welcoming and ordinary. Absolutely no signage, no lettering and no name anywhere on the building.",
  },
];

async function loadEnv() {
  const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    process.env[match[1]] ??= match[2].replace(/^["']|["']$/g, "");
  }
}

async function exists(file: string) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

await loadEnv();
if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY が .env.local にありません。");
  process.exit(2);
}

const args = process.argv.slice(2);
const force = args.includes("--force");
const only = args.filter((a) => !a.startsWith("--"));

const wanted = only.length > 0 ? ASSETS.filter((a) => only.includes(a.key)) : ASSETS;
if (wanted.length === 0) {
  console.error(`指定に一致する素材がありません。使える名前: ${ASSETS.map((a) => a.key).join(", ")}`);
  process.exit(2);
}

await mkdir(OUT_DIR, { recursive: true });

const OpenAI = (await import("openai")).default;
const openai = new OpenAI();

let made = 0;
let skipped = 0;
let failed = 0;

for (const asset of wanted) {
  const file = path.join(OUT_DIR, `${asset.key}.jpg`);
  if (!force && (await exists(file))) {
    skipped++;
    console.log(`⏭  ${asset.key}（既にあります。作り直すには --force）`);
    continue;
  }

  try {
    const result = await openai.images.generate({
      model: "gpt-image-2",
      prompt: `${asset.prompt} ${SHARED_STYLE}`,
      size: asset.size,
      quality: "medium",
      output_format: "jpeg",
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("画像が返りませんでした。");
    await writeFile(file, Buffer.from(b64, "base64"));
    made++;
    console.log(`✅ ${asset.key} — ${asset.note}（${asset.size}）`);
  } catch (err) {
    failed++;
    console.error(`⛔ ${asset.key}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

console.log(`\n生成 ${made} 件 / 既存 ${skipped} 件 / 失敗 ${failed} 件 → ${path.relative(ROOT, OUT_DIR)}`);
process.exit(failed > 0 ? 1 : 0);
