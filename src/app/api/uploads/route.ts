import { isStorageConfigured, StorageError, uploadObject } from "@/lib/supabaseStorage";
import { imageExtensionFor, unsupportedImageMessage } from "@/lib/imageFormats";

const PREFIX = "clinc-hp";
const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
// Not limited to the marketing IMAGE_CATEGORIES — this is just a storage path segment, and other
// upload flows (e.g. a staff member's own photo) use their own category names ("staff").
const CATEGORY_PATTERN = /^[a-z0-9_-]{1,32}$/i;

export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    return Response.json({ error: "Supabase Storageが設定されていないため、アップロードできませんでした。" }, { status: 500 });
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
    // Checked HERE, not only when the editor later adopts the file: an upload that "succeeds" and
    // then fails downstream is the confusing case this replaces (see imageFormats.ts).
    const extension = imageExtensionFor(file.type);
    if (!extension) {
      return Response.json({ error: unsupportedImageMessage(file.name, file.type) }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return Response.json({ error: `${file.name} のサイズが大きすぎます（8MBまで）。` }, { status: 400 });
    }

    // From the MIME type, not the filename: the two disagree often enough (a .jpg that is really a
    // PNG, a photo saved with no extension) and the stored object's type is what the adopt step reads.
    const key = `${PREFIX}/${category}/${crypto.randomUUID()}.${extension}`;

    try {
      urls.push(await uploadObject(key, await file.arrayBuffer(), file.type));
    } catch (err) {
      const message = err instanceof StorageError ? err.message : err instanceof Error ? err.message : "不明なエラー";
      return Response.json({ error: `アップロードに失敗しました: ${message}` }, { status: 502 });
    }
  }

  return Response.json({ urls });
}
