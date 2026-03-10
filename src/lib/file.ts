export async function readUploadedFile(file: File): Promise<string> {
  return file.text();
}
