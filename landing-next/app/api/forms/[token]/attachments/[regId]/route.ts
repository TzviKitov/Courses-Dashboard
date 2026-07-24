import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  REGISTRATION_ALLOWED_MIME,
  REGISTRATION_FILE_MAX_BYTES,
  REGISTRATION_FILE_MAX_COUNT,
  REGISTRATION_FILES_BUCKET,
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import { requireFormToken } from "@/lib/followups/tokens";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string; regId: string }> }
) {
  const { token, regId } = await params;
  const auth = await requireFormToken(token, "form1");
  if ("error" in auth) return auth.error;

  const admin = getSupabaseAdmin();
  const { data: landing } = await admin
    .from("landings")
    .select("start_date, end_date")
    .eq("id", auth.landingId)
    .maybeSingle();
  if (!landing) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }
  const dues = computeFollowupDueDates(landing.start_date, landing.end_date);
  if (!isFormWindowOpen(dues.form1)) {
    return Response.json(
      { success: false, error: "Attachments only when form 1 is open" },
      { status: 403 }
    );
  }

  const { data: reg } = await admin
    .from("registrations")
    .select("id, cancelled_at")
    .eq("id", regId)
    .eq("landing_id", auth.landingId)
    .maybeSingle();
  if (!reg || reg.cancelled_at) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const { count } = await admin
    .from("registration_attachments")
    .select("id", { count: "exact", head: true })
    .eq("registration_id", regId);

  if ((count ?? 0) >= REGISTRATION_FILE_MAX_COUNT) {
    return Response.json(
      { success: false, error: `Max ${REGISTRATION_FILE_MAX_COUNT} files` },
      { status: 400 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ success: false, error: "file required" }, { status: 400 });
  }
  if (!REGISTRATION_ALLOWED_MIME.has(file.type)) {
    return Response.json(
      { success: false, error: "Only PDF, JPG, PNG allowed" },
      { status: 400 }
    );
  }
  if (file.size > REGISTRATION_FILE_MAX_BYTES) {
    return Response.json({ success: false, error: "File too large" }, { status: 400 });
  }

  const ext =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : "jpg";
  const safeName = file.name.replace(/[^\w.\-א-ת ]+/g, "_").slice(0, 120);
  const storagePath = `${auth.landingId}/${regId}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const upload = await admin.storage
    .from(REGISTRATION_FILES_BUCKET)
    .upload(storagePath, bytes, { contentType: file.type, upsert: false });

  if (upload.error) {
    return Response.json(
      { success: false, error: upload.error.message },
      { status: 500 }
    );
  }

  const { data: row, error } = await admin
    .from("registration_attachments")
    .insert({
      registration_id: regId,
      landing_id: auth.landingId,
      file_name: safeName || `file.${ext}`,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      created_by: null,
    })
    .select("*")
    .single();

  if (error) {
    await admin.storage.from(REGISTRATION_FILES_BUCKET).remove([storagePath]);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  return Response.json({ success: true, item: row });
}
