type LogLevel = "info" | "warn" | "error";

function formatMessage(level: LogLevel, message: string, context?: Record<string, unknown>) {
  return {
    level,
    message,
    context,
    timestamp: new Date().toISOString(),
  };
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  console.info(JSON.stringify(formatMessage("info", message, context)));
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  console.warn(JSON.stringify(formatMessage("warn", message, context)));
}

export function logError(message: string, context?: Record<string, unknown>) {
  console.error(JSON.stringify(formatMessage("error", message, context)));
}

function redactConnectionCredentials(value: string) {
  return value.replace(
    /\b(postgres(?:ql)?):\/\/[^@\s]+@/gi,
    "$1://[redacted]@",
  );
}

export function buildSafeErrorLogContext(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      errorName: "UnknownError",
      errorMessage: "Unknown error",
    };
  }

  return {
    errorName: error.name,
    errorMessage: redactConnectionCredentials(error.message),
    errorStack: error.stack ? redactConnectionCredentials(error.stack) : undefined,
  };
}
