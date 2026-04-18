export const receiptObjectUrls: string[] = [];

export function clearReceiptObjectUrls(): void {
  for (const url of receiptObjectUrls) {
    URL.revokeObjectURL(url);
  }
  receiptObjectUrls.length = 0;
}
