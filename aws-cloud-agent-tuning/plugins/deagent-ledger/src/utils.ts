export function notImplemented(functionName: string): never {
  throw new Error(`${functionName}: Not implemented`);
}

export function requireNonEmpty(value: string | undefined, fieldName: string): string {
  if (!value?.trim()) {
    throw new Error(`${fieldName} is required`);
  }

  return value.trim();
}
