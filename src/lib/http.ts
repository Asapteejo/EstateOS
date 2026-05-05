import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function safeValidationIssues(error: ZodError) {
  return error.issues.map((issue) => ({
    path:
      issue.path.length > 0
        ? issue.path.map(String).join(".")
        : issue.code === "unrecognized_keys"
          ? issue.keys.join(",")
          : "",
    message: issue.message,
    code: issue.code,
  }));
}

export function validationFail(error: ZodError) {
  return NextResponse.json(
    {
      success: false,
      error: "Validation failed",
      issues: safeValidationIssues(error),
    },
    { status: 400 },
  );
}
