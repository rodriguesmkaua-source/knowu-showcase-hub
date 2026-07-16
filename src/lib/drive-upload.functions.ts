import { createServerFn } from "@tanstack/react-start";

const DRIVE_FOLDER_ID = "16yaWz2Ati8lhL6dkksbvCeOMUF6KO3TE";
const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const uploadExcelToDrive = createServerFn({ method: "POST" })
  .inputValidator((data: { filename: string; base64: string }) => {
    if (!data || typeof data.filename !== "string" || typeof data.base64 !== "string") {
      throw new Error("Invalid input");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const { uploadFileToDrive } = await import("./google-drive.server");
    return uploadFileToDrive({
      folderId: DRIVE_FOLDER_ID,
      filename: data.filename,
      data: Buffer.from(data.base64, "base64"),
      contentType: XLSX_MIME,
      upsertByName: false,
    });
  });
