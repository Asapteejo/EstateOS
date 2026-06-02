export function selectAuthenticatedCompany<T>(input: {
  sessionCompany: T | null;
  hintedCompany: T | null;
  fallbackCompany: T | null;
}) {
  return input.sessionCompany;
}
