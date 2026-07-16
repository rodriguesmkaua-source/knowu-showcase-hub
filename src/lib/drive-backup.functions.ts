import { createServerFn } from "@tanstack/react-start";

const DRIVE_FOLDER_ID = "1xflnkggLuDvZWUDbnYZDEfvayiXNdPni";
const BACKUP_FILENAME = "backup_demandas.json";

export const uploadBackupToDrive = createServerFn({ method: "POST" })
  .inputValidator((data: { json: string }) => {
    if (!data || typeof data.json !== "string") throw new Error("Invalid input");
    return data;
  })
  .handler(async ({ data }) => {
    const { uploadFileToDrive } = await import("./google-drive.server");
    return uploadFileToDrive({
      folderId: DRIVE_FOLDER_ID,
      filename: BACKUP_FILENAME,
      data: Buffer.from(data.json, "utf8"),
      contentType: "application/json",
      upsertByName: true,
    });
  });
