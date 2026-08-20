import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, r2PublicUrl } from "@/lib/r2";

const BUCKET = process.env.R2_BUCKET_NAME;
const PREFIX = "clinc-hp";
const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
// Not limited to the marketing IMAGE_CATEGORIES — this is just a storage path segment, and other
// upload flows (e.g. a staff member's own photo) use their own category names ("staff").
const CATEGORY_PATTERN = /^[a-z0-9_-]{1,32}$/i;

export async function POST(request: Request) {
  const client = getR2Client();
  if (!client || !BUCKET) {
    return Response.json({ error: "Cloudflare R2が設定されていないため、アップロードできませんでした。" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const category = formData.get("category");
  if (typeof category !== "string" || !CATEGORY_PATTERN.test(category)) {
    return Response.json({ error: "カテゴリが不正です。" }, { status: 400 });
  }

  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) {
    return Response.json({ error: "アップロードする画像を選択してください。" }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return Response.json({ error: `画像は一度に${MAX_FILES}枚までです。` }, { status: 400 });
  }

  const urls: string[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      return Response.json({ error: `${file.name} は画像ファイルではありません。` }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `${file.name} のサイズが大きすぎます（8MBまで）。` }, { status: 400 });
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const key = `${PREFIX}/${category}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    try {
      await client.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: file.type }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "不明なエラー";
      return Response.json({ error: `アップロードに失敗しました: ${message}` }, { status: 502 });
    }

    const url = r2PublicUrl(key);
    if (!url) {
      return Response.json({ error: "R2の公開URL（R2_PUBLIC_URL）が設定されていません。" }, { status: 500 });
    }
    urls.push(url);
  }

  return Response.json({ urls });
}
