export const MIN_PASSWORD_LENGTH = 8;
// bcrypt truncates input at 72 bytes; anything longer silently loses
// entropy, so reject it instead of pretending it is protected.
export const MAX_PASSWORD_BYTES = 72;

export const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const validateEmail = (email: string): string | null => {
  if (!email) return "Email is required.";
  if (email.length > 254) return "Email address is too long.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return "Enter a valid email address.";
  }
  return null;
};

export const passwordByteLength = (password: string): number =>
  new TextEncoder().encode(password).length;

export const validatePassword = (password: unknown): string | null => {
  if (typeof password !== "string" || password.length === 0) {
    return "Password is required.";
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!password.trim()) {
    return "Password cannot contain only spaces.";
  }
  if (passwordByteLength(password) > MAX_PASSWORD_BYTES) {
    return `Password must be ${MAX_PASSWORD_BYTES} bytes or fewer.`;
  }
  return null;
};
