import { getSupabaseClient } from "@/lib/supabase";
import { isImageCategoryKey } from "@/lib/imageCategories";

const BUCKET = "site-images";
const PREFIX = "clinc-hp";
const MAX_FILES = 10;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return Response.json({ error: "Supabaseが設定されていないため、アップロードできませんでした。" }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "リクエストの形式が正しくありません。" }, { status: 400 });
  }

  const category = formData.get("category");
  if (typeof category !== "string" || !isImageCategoryKey(category)) {
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
    const path = `${PREFIX}/${category}/${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: false });
    if (uploadError) {
      return Response.json({ error: `アップロードに失敗しました: ${uploadError.message}` }, { status: 502 });
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }

  return Response.json({ urls });
}
