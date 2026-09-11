/**
 * Supabase Error Types, Code Mappings, and Descriptive Parser
 * Translates Supabase auth & PostgreSQL error responses into actionable,
 * high-contrast brutalist error states.
 */

export type SupabaseErrorCode =
  | "invalid_credentials"
  | "user_not_found"
  | "username_taken"
  | "email_taken"
  | "weak_password"
  | "invalid_email"
  | "email_not_confirmed"
  | "over_request_rate_limit"
  | "network_error"
  | "database_error"
  | "generic_error";

export interface ParsedSupabaseError {
  code: SupabaseErrorCode;
  statusCode: number;
  statusLabel: string;
  rawMessage: string;
  title: string;
  description: string;
  troubleshooting: string[];
  field?: "identifier" | "username" | "email" | "password" | "confirmPassword";
  actionLabel?: string;
  actionType?:
    | "reset_password"
    | "signin_email"
    | "apply_username"
    | "resend_confirmation"
    | "try_demo"
    | "retry";
  suggestedValue?: string;
}

/**
 * Parses any error (string, Error instance, or Supabase JSON error payload)
 * into a structured, highly descriptive Supabase error representation.
 */
export function parseSupabaseError(
  error: unknown,
  context?: {
    username?: string;
    email?: string;
    identifier?: string;
  }
): ParsedSupabaseError {
  let message = "";
  let statusCode = 400;
  let codeHint = "";

  if (typeof error === "string") {
    message = error;
  } else if (error && typeof error === "object") {
    const obj = error as Record<string, any>;
    message =
      obj.message ||
      obj.error_description ||
      obj.error ||
      obj.msg ||
      "An unexpected authentication failure occurred.";
    if (typeof obj.status === "number") statusCode = obj.status;
    if (typeof obj.statusCode === "number") statusCode = obj.statusCode;
    if (typeof obj.code === "string") codeHint = obj.code;
  } else {
    message = "An unexpected authentication error occurred.";
  }

  const lower = message.toLowerCase();
  const username = context?.username || "";
  const email = context?.email || "";

  // 1. Invalid Login Credentials (common Supabase 400 error)
  if (
    lower.includes("invalid login credentials") ||
    lower.includes("invalid credentials") ||
    lower.includes("incorrect password") ||
    lower.includes("wrong password") ||
    codeHint === "invalid_credentials"
  ) {
    return {
      code: "invalid_credentials",
      statusCode: 400,
      statusLabel: "HTTP 400: INVALID_CREDENTIALS",
      rawMessage: message,
      title: "ACCESS REJECTED: INVALID CREDENTIALS",
      description:
        "Supabase Auth could not match this password to your account. Passwords are strictly case-sensitive. If you don't recall your password, you can reset it instantly.",
      troubleshooting: [
        "Check that Caps Lock is not turned on.",
        "Ensure there are no leading or trailing spaces.",
        "If you created your account with Google or an alternative email, check that address.",
      ],
      field: "password",
      actionLabel: "Reset Password Now",
      actionType: "reset_password",
    };
  }

  // 2. User Not Found (Supabase 400 / 404)
  if (
    lower.includes("no account found") ||
    lower.includes("user not found") ||
    lower.includes("no user") ||
    codeHint === "user_not_found"
  ) {
    return {
      code: "user_not_found",
      statusCode: 404,
      statusLabel: "HTTP 404: USER_NOT_FOUND",
      rawMessage: message,
      title: "ACCOUNT NOT FOUND IN DATABASE",
      description:
        "No registered account in Supabase matches this username or email address. You may have used a different handle or haven't signed up yet.",
      troubleshooting: [
        "Double-check your spelling for typos in the handle or domain.",
        "Use your registered email address instead of a username.",
        "New to datings.lol? Create a new account in under 30 seconds.",
      ],
      field: "identifier",
      actionLabel: "Create New Account",
      actionType: "retry",
    };
  }

  // 3. Username Already Taken (PostgreSQL unique constraint: users_username_key / 23505)
  if (
    lower.includes("username already taken") ||
    lower.includes("users_username_key") ||
    lower.includes("username is already in use") ||
    (lower.includes("already taken") && !lower.includes("email"))
  ) {
    const baseClean = (username || "dating_star").replace(/[^a-zA-Z0-9_]/g, "");
    const randomSuffix = Math.floor(Math.random() * 899 + 100);
    const suggested = `${baseClean}_${randomSuffix}`;

    return {
      code: "username_taken",
      statusCode: 409,
      statusLabel: "HTTP 409: CONFLICT (UNIQUE_CONSTRAINT)",
      rawMessage: message,
      title: "HANDLE UNAVAILABLE: USERNAME ALREADY TAKEN",
      description: `The handle "${username || "chosen"}" is already claimed by another active user in the database. Choose another username or adopt one of our suggestions.`,
      troubleshooting: [
        "Usernames must be unique across all dating profiles.",
        "Add a birth year, favorite number, or underscore (e.g. _nyc, _real).",
        "If this handle belongs to you, head to Sign In instead.",
      ],
      field: "username",
      actionLabel: `Use @${suggested}`,
      actionType: "apply_username",
      suggestedValue: suggested,
    };
  }

  // 4. Email Already Registered (Supabase "User already registered" / 422 / unique_violation)
  if (
    lower.includes("user already registered") ||
    lower.includes("email already in use") ||
    lower.includes("users_email_key") ||
    lower.includes("already exists") ||
    codeHint === "user_already_exists"
  ) {
    return {
      code: "email_taken",
      statusCode: 409,
      statusLabel: "HTTP 409: USER_ALREADY_REGISTERED",
      rawMessage: message,
      title: "DUPLICATE ACCOUNT: EMAIL ALREADY REGISTERED",
      description: `An existing account is already registered under "${email || "this email"}". Supabase prevents multiple logins with the same primary address.`,
      troubleshooting: [
        "Sign in directly using this email address and your password.",
        "Use 'Forgot Password' if you cannot recall your login credentials.",
        "Or use a different email address to create a fresh profile.",
      ],
      field: "email",
      actionLabel: "Sign In With This Email",
      actionType: "signin_email",
    };
  }

  // 5. Weak / Short Password (Supabase 422: Password should be at least 6 characters)
  if (
    lower.includes("password should be at least") ||
    lower.includes("password must be at least") ||
    lower.includes("weak password") ||
    lower.includes("password is too weak") ||
    lower.includes("password requires")
  ) {
    return {
      code: "weak_password",
      statusCode: 422,
      statusLabel: "HTTP 422: UNPROCESSABLE_ENTITY",
      rawMessage: message,
      title: "SECURITY REJECTED: PASSWORD REQUIREMENTS UNMET",
      description:
        "Supabase Auth requires a minimum of 6 characters for user passwords. For high security, we recommend combining letters, numbers, and symbols.",
      troubleshooting: [
        "Ensure your password is at least 6 characters long.",
        "Include at least one uppercase letter (A-Z) and one number (0-9).",
        "Avoid easily guessable sequences like '123456' or 'password'.",
      ],
      field: "password",
      actionLabel: "Generate Secure Passkey",
      actionType: "retry",
    };
  }

  // 6. Invalid Email Format (Supabase: "Unable to validate email address: invalid format")
  if (
    lower.includes("unable to validate email") ||
    lower.includes("invalid email") ||
    lower.includes("valid email address")
  ) {
    return {
      code: "invalid_email",
      statusCode: 400,
      statusLabel: "HTTP 400: MALFORMED_EMAIL",
      rawMessage: message,
      title: "SYNTAX ERROR: INVALID EMAIL FORMAT",
      description:
        "Supabase could not validate the RFC-5322 structure of this email address. Please ensure it follows standard format (e.g., name@domain.com).",
      troubleshooting: [
        "Check for missing '@' or missing domain extension (like .com).",
        "Make sure there are no spaces or commas in the email string.",
      ],
      field: "email",
      actionLabel: "Correct Email Address",
      actionType: "retry",
    };
  }

  // 7. Rate Limit Exceeded (Supabase 429: "Email rate limit exceeded" / "Too many requests")
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("security purposes, you can only request this once") ||
    statusCode === 429
  ) {
    return {
      code: "over_request_rate_limit",
      statusCode: 429,
      statusLabel: "HTTP 429: RATE_LIMIT_EXCEEDED",
      rawMessage: message,
      title: "COOLDOWN LOCK: TOO MANY AUTH ATTEMPTS",
      description:
        "Supabase automated DDoS/Brute-force security has triggered a temporary 60-second cooldown on this IP or account to protect against unauthorized attacks.",
      troubleshooting: [
        "Wait 60 seconds before making another sign-in or signup attempt.",
        "Do not repeatedly submit the form while locked.",
        "For quick preview testing, utilize the 1-Click Demo Accounts.",
      ],
      actionLabel: "Use Instant Demo Account",
      actionType: "try_demo",
    };
  }

  // 8. Email Not Confirmed (Supabase: "Email not confirmed")
  if (
    lower.includes("email not confirmed") ||
    lower.includes("unconfirmed email") ||
    codeHint === "email_not_confirmed"
  ) {
    return {
      code: "email_not_confirmed",
      statusCode: 403,
      statusLabel: "HTTP 403: EMAIL_UNVERIFIED",
      rawMessage: message,
      title: "VERIFICATION PENDING: EMAIL NOT CONFIRMED",
      description:
        "Supabase requires email confirmation before granting access. A verification link was dispatched to your inbox upon registration.",
      troubleshooting: [
        "Search your spam or junk folder for an email from datings.lol.",
        "Click the confirmation button inside the email to activate your account.",
        "Click below to generate a new verification link.",
      ],
      field: "email",
      actionLabel: "Resend Confirmation Email",
      actionType: "resend_confirmation",
    };
  }

  // 9. Network / Connection Error
  if (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("network error") ||
    lower.includes("connection refused") ||
    lower.includes("offline")
  ) {
    return {
      code: "network_error",
      statusCode: 503,
      statusLabel: "HTTP 503: SERVICE_UNAVAILABLE",
      rawMessage: message,
      title: "GATEWAY ERROR: SUPABASE UNREACHABLE",
      description:
        "Could not establish a stable TLS handshake with the Supabase Auth API endpoint. You may be offline or the remote gateway timed out.",
      troubleshooting: [
        "Verify your device has an active internet connection.",
        "Check that no firewall or ad-blocker is blocking *.supabase.co.",
        "Click below to retry the connection.",
      ],
      actionLabel: "Retry Connection",
      actionType: "retry",
    };
  }

  // Fallback Generic Error
  return {
    code: "generic_error",
    statusCode: statusCode || 400,
    statusLabel: `HTTP ${statusCode || 400}: AUTH_FAILURE`,
    rawMessage: message,
    title: "AUTHENTICATION FAILED",
    description: message,
    troubleshooting: [
      "Review the information entered in the form above.",
      "If the error persists, try signing in with a demo account.",
    ],
    actionLabel: "Dismiss & Try Again",
    actionType: "retry",
  };
}

/**
 * List of simulated Supabase failures for UI testing & demo verification
 */
export const COMMON_SUPABASE_FAILURES = [
  {
    label: "Invalid credentials (400)",
    error: {
      message: "Invalid login credentials",
      status: 400,
      code: "invalid_credentials",
    },
  },
  {
    label: "Username already taken (409)",
    error: {
      message: "Username already taken: duplicate key value violates unique constraint 'users_username_key'",
      status: 409,
      code: "23505",
    },
  },
  {
    label: "User already registered (409)",
    error: {
      message: "User already registered: an account with this email already exists",
      status: 409,
      code: "user_already_exists",
    },
  },
  {
    label: "Weak password (422)",
    error: {
      message: "Password should be at least 6 characters",
      status: 422,
      code: "weak_password",
    },
  },
  {
    label: "Rate limit exceeded (429)",
    error: {
      message: "Email rate limit exceeded. For security purposes, you can only request this once every 60 seconds.",
      status: 429,
      code: "over_email_send_rate_limit",
    },
  },
  {
    label: "Email not confirmed (403)",
    error: {
      message: "Email not confirmed. Please click the link sent to your email to verify your account.",
      status: 403,
      code: "email_not_confirmed",
    },
  },
  {
    label: "Network / Unreachable (503)",
    error: {
      message: "Failed to fetch: Unable to reach Supabase Auth gateway",
      status: 503,
      code: "network_error",
    },
  },
];
