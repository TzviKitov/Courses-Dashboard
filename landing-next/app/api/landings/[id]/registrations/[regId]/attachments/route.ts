import { getCurrentUser } from "@/lib/supabase/ssr";
import { getSupabaseAdmin, isSupabaseDbEnabled } from "@/lib/supabase/server";
import { requireLandingAccess } from "@/lib/followups/access";
import {
  REGISTRATION_ALLOWED_MIME,
  REGISTRATION_FILE_MAX_BYTES,
  REGISTRATION_FILE_MAX_COUNT,
  REGISTRATION_FILES_BUCKET,
  computeFollowupDueDates,
  isFormWindowOpen,
} from "@/lib/followups/dates";
import {
  detectFileKind,
  extensionForKind,
  isAllowedRegistrationFile,
} from "@/lib/security/file-magic";
import { logAuditEvent } from "@/lib/security/audit";
import { ATTACHMENT_LIST_SELECT } from "@/lib/security/sensitive-notes";

/**
 * POST multipart: file upload for a registrant (form 1 attachments).
 * DELETE ?attachmentId=...
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const { id, regId } = await params;
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "DB disabled" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  const dues = computeFollowupDueDates(
    access.landing.start_date,
    access.landing.end_date
  );
  if (!isFormWindowOpen(dues.form1)) {
    return Response.json(
      { success: false, error: "Attachments only when form 1 is open" },
      { status: 403 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: reg } = await admin
    .from("registrations")
    .select("id, cancelled_at")
    .eq("id", regId)
    .eq("landing_id", id)
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
      { success: false, error: `Max ${REGISTRATION_FILE_MAX_COUNT} files per registrant` },
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
    return Response.json(
      { success: false, error: "File too large (max 10MB)" },
      { status: 400 }
    );
  }

  const extGuess =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : "jpg";
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!isAllowedRegistrationFile(bytes, file.type)) {
    return Response.json(
      { success: false, error: "תוכן הקובץ אינו תואם (PDF/JPG/PNG בלבד)" },
      { status: 400 }
    );
  }
  const kind = detectFileKind(bytes);
  const ext = extensionForKind(kind) || extGuess;
  const safeName = file.name.replace(/[^\w.\-א-ת ]+/g, "_").slice(0, 120);
  const storagePath = `${id}/${regId}/${crypto.randomUUID()}.${ext}`;

  const upload = await admin.storage
    .from(REGISTRATION_FILES_BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });

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
      landing_id: id,
      file_name: safeName || `file.${ext}`,
      storage_path: storagePath,
      mime_type: file.type,
      size_bytes: file.size,
      created_by: user.id,
    })
    .select(ATTACHMENT_LIST_SELECT)
    .single();

  if (error) {
    await admin.storage.from(REGISTRATION_FILES_BUCKET).remove([storagePath]);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  logAuditEvent({
    actorId: user.id,
    action: "upload_file",
    resourceType: "registration",
    resourceId: regId,
    metadata: { landingId: id, attachmentId: (row as unknown as { id: string }).id },
    req,
  });

  return Response.json({ success: true, item: row });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const { id, regId } = await params;
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "DB disabled" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) {
    return Response.json(
      { success: false, error: "attachmentId required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: att } = await admin
    .from("registration_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("registration_id", regId)
    .eq("landing_id", id)
    .maybeSingle();

  if (!att) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  await admin.storage.from(REGISTRATION_FILES_BUCKET).remove([att.storage_path]);
  const { error } = await admin
    .from("registration_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }

  logAuditEvent({
    actorId: user.id,
    action: "delete_file",
    resourceType: "attachment",
    resourceId: attachmentId,
    metadata: { landingId: id, registrationId: regId },
    req,
  });

  return Response.json({ success: true });
}

/** Signed download URL (short TTL). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; regId: string }> }
) {
  const { id, regId } = await params;
  if (!isSupabaseDbEnabled()) {
    return Response.json({ success: false, error: "DB disabled" }, { status: 503 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const access = await requireLandingAccess(user, id);
  if ("error" in access) return access.error;

  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) {
    return Response.json(
      { success: false, error: "attachmentId required" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();
  const { data: att } = await admin
    .from("registration_attachments")
    .select("*")
    .eq("id", attachmentId)
    .eq("registration_id", regId)
    .eq("landing_id", id)
    .maybeSingle();

  if (!att) {
    return Response.json({ success: false, error: "Not found" }, { status: 404 });
  }

  const signed = await admin.storage
    .from(REGISTRATION_FILES_BUCKET)
    .createSignedUrl(att.storage_path, 60);

  if (signed.error || !signed.data?.signedUrl) {
    return Response.json(
      { success: false, error: signed.error?.message || "sign failed" },
      { status: 500 }
    );
  }

  logAuditEvent({
    actorId: user.id,
    action: "download_file",
    resourceType: "attachment",
    resourceId: attachmentId,
    metadata: { landingId: id, registrationId: regId },
    req,
  });

  return Response.json({
    success: true,
    url: signed.data.signedUrl,
    fileName: att.file_name,
  });
}
