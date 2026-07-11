// Thin wrapper around localStorage for the JWT issued by /api/auth/{signup,login}.

const TOKEN_KEY = "finops_jwt";
const EMAIL_KEY = "finops_email";

export function saveAuth(token: string, email: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EMAIL_KEY, email);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}
