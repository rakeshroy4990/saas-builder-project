export function isGoogleDeveloperConfigError(message: string): boolean {
  const m = message.trim().toLowerCase();
  return (
    m.includes('developer_error') ||
    m.includes('developer error') ||
    m.includes('code: 10') ||
    m.includes('developer console is not set up correctly')
  );
}
