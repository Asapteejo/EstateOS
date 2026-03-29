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
