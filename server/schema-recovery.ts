function postgresErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}

export function isMissingSchemaObject(error: unknown) {
  return ["3F000", "42P01", "42703"].includes(postgresErrorCode(error));
}

export async function withSchemaRecovery<T>(
  operation: () => Promise<T>,
  recoverSchema: () => Promise<void>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingSchemaObject(error)) throw error;
    await recoverSchema();
    return operation();
  }
}
