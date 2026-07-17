import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRIVE_FOLDER_ID = "16yaWz2Ati8lhL6dkksbvCeOMUF6KO3TE";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

export const uploadExcelToDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data || typeof data.filename !== "string" || typeof data.base64 !== "string") {
      throw new Error("Invalid input");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const buffer = Buffer.from(data.base64, "base64");
    if (buffer.byteLength > MAX_UPLOAD_BYTES) {
      throw new Error("Arquivo excede o tamanho máximo de 20 MB");
    }
    const { uploadFileToDrive } = await import("./google-drive.server");
    return uploadFileToDrive({
      folderId: DRIVE_FOLDER_ID,
      filename: data.filename,
      data: buffer,
      contentType: XLSX_MIME,
      upsertByName: false,
    });
  });
