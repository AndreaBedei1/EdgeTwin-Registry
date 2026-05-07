import type { EdgeRegistrationQrPayload, LoginInput, ProfileCreateInput, RegisterInput } from "@hdt/shared";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

type ApiErrorDetail = { field?: string; message: string };
export type ApiError = Error & { status?: number; code?: string; details?: ApiErrorDetail[] };

type RequestOptions = RequestInit & {
  skipCsrf?: boolean;
};

let csrfToken: string | null = null;

function isStateChanging(method: string) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

async function fetchCsrfToken() {
  const response = await fetch(`${API_BASE_URL}/api/csrf-token`, {
    credentials: "include"
  });

  if (!response.ok) {
    throw new Error("Unable to prepare secure request");
  }

  const data = (await response.json()) as { csrfToken: string };
  csrfToken = data.csrfToken;
  return csrfToken;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (!options.skipCsrf && isStateChanging(method)) {
    const token = csrfToken ?? (await fetchCsrfToken());
    headers.set("X-CSRF-Token", token);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message ?? "Request failed") as ApiError;
    error.status = response.status;
    error.code = data.error?.code;
    error.details = data.error?.details;
    throw error;
  }

  return data as T;
}

export type User = {
  _id: string;
  email: string;
};

export type Profile = ProfileCreateInput & {
  _id: string;
  deployment: {
    status: string;
    provider: "mock";
    image: string;
    podName?: string;
    deploymentName?: string | null;
    namespace?: string | null;
    lastError?: string | null;
    updatedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
};

export const api = {
  register(input: RegisterInput) {
    csrfToken = null;
    return request<{ user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify(input), skipCsrf: true });
  },
  login(input: LoginInput) {
    csrfToken = null;
    return request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(input), skipCsrf: true });
  },
  async logout() {
    await request<void>("/api/auth/logout", { method: "POST" });
    csrfToken = null;
  },
  me() {
    return request<{ user: User }>("/api/me");
  },
  createProfile(input: ProfileCreateInput) {
    return request<{ profile: Profile }>("/api/profiles", { method: "POST", body: JSON.stringify(input) });
  },
  updateProfile(profileId: string, input: ProfileCreateInput) {
    return request<{ profile: Profile }>(`/api/profiles/${profileId}`, { method: "PUT", body: JSON.stringify(input) });
  },
  profiles() {
    return request<{ profiles: Profile[] }>("/api/profiles/me");
  },
  edgeRegistrationPayload() {
    return request<EdgeRegistrationQrPayload>("/api/edge/registration-payload");
  }
};
