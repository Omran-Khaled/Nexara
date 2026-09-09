import { accessToken } from "../lib/auth";

export type UiErrorKind =
  | "network"
  | "timeout"
  | "cancelled"
  | "authentication"
  | "authorization"
  | "validation"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "server"
  | "invalid_response"
  | "unknown";

export interface UiError {
  kind: UiErrorKind;
  status: number | null;
  message: string;
  messageAr: string;
  retryable: boolean;
}

export interface NetworkLogEntry {
  requestId: string;
  method: string;
  path: string;
  attempt: number;
  durationMs: number;
  outcome:
    | "success"
    | "http_error"
    | "timeout"
    | "cancelled"
    | "network_error"
    | "invalid_response";
  status: number | null;
}

const networkLog: NetworkLogEntry[] = [];
const NETWORK_LOG_LIMIT = 200;
function recordNetwork(entry: NetworkLogEntry) {
  networkLog.push(entry);
  if (networkLog.length > NETWORK_LOG_LIMIT)
    networkLog.splice(0, networkLog.length - NETWORK_LOG_LIMIT);
}
export function recentNetworkLog(): readonly NetworkLogEntry[] {
  return networkLog.slice();
}

export class ApiError extends Error {
  constructor(public readonly ui: UiError) {
    super(ui.message);
    this.name = "ApiError";
  }
}

const messages: Record<
  UiErrorKind,
  Pick<UiError, "message" | "messageAr" | "retryable">
> = {
  network: {
    message: "The connection is unavailable. Please retry.",
    messageAr: "الاتصال غير متاح. يرجى إعادة المحاولة.",
    retryable: true,
  },
  timeout: {
    message: "The request took too long. Please try again.",
    messageAr: "استغرق الطلب وقتاً أطول من اللازم. يرجى المحاولة مجدداً.",
    retryable: true,
  },
  cancelled: {
    message: "The request was cancelled.",
    messageAr: "تم إلغاء الطلب.",
    retryable: false,
  },
  authentication: {
    message: "Please sign in to continue.",
    messageAr: "يرجى تسجيل الدخول للمتابعة.",
    retryable: false,
  },
  authorization: {
    message: "Your account does not have permission for this action.",
    messageAr: "لا يملك حسابك صلاحية تنفيذ هذه العملية.",
    retryable: false,
  },
  validation: {
    message: "Please review the submitted information.",
    messageAr: "يرجى مراجعة البيانات المُرسلة.",
    retryable: false,
  },
  not_found: {
    message: "The requested resource is no longer available.",
    messageAr: "المورد المطلوب لم يعد متاحًا.",
    retryable: false,
  },
  conflict: {
    message:
      "This action conflicts with the current server state. Refresh and try again.",
    messageAr:
      "تتعارض العملية مع حالة الخادم الحالية. حدّث الصفحة وحاول مجددًا.",
    retryable: true,
  },
  rate_limited: {
    message: "Too many requests were sent. Please wait and try again.",
    messageAr: "تم إرسال طلبات كثيرة. يرجى الانتظار ثم المحاولة مجدداً.",
    retryable: true,
  },
  server: {
    message: "The server could not complete the request.",
    messageAr: "تعذر على الخادم إكمال الطلب.",
    retryable: true,
  },
  invalid_response: {
    message: "The service returned an invalid response.",
    messageAr: "أعادت الخدمة استجابة غير صالحة.",
    retryable: true,
  },
  unknown: {
    message: "The request could not be completed.",
    messageAr: "تعذر إكمال الطلب.",
    retryable: true,
  },
};

function kindFromStatus(status: number): UiErrorKind {
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 400 || status === 422) return "validation";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server";
  return "unknown";
}

export function toUiError(error: unknown): UiError {
  if (error instanceof ApiError) return error.ui;
  if (error instanceof DOMException && error.name === "AbortError")
    return { kind: "cancelled", status: null, ...messages.cancelled };
  return { kind: "network", status: null, ...messages.network };
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
}
export interface RequestOptions extends Omit<RequestInit, "body" | "signal"> {
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  retry?: Partial<RetryPolicy> | false;
  /** Validates parsed JSON before UI code receives it. */
  validate?: (value: unknown) => boolean;
}
export interface RawRequestOptions extends RequestOptions {
  absoluteUrl?: boolean;
}

function defaultRetry(method: string): RetryPolicy {
  return ["GET", "HEAD"].includes(method.toUpperCase())
    ? { maxAttempts: 2, baseDelayMs: 120 }
    : { maxAttempts: 1, baseDelayMs: 0 };
}
function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timer);
        reject(new DOMException("Cancelled", "AbortError"));
      },
      { once: true },
    );
  });
}
function isJsonResponse(response: Response): boolean {
  return /application\/json/i.test(response.headers.get("content-type") || "");
}
function defaultJsonShape(value: unknown): boolean {
  return value !== null && typeof value === "object";
}

export class HttpClient {
  constructor(private readonly baseUrl = "/api") {}

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const response = await this.requestRaw(path, options);
    if (response.status === 204) return undefined as T;
    if (!isJsonResponse(response))
      throw new ApiError({
        kind: "invalid_response",
        status: response.status,
        ...messages.invalid_response,
      });
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new ApiError({
        kind: "invalid_response",
        status: response.status,
        ...messages.invalid_response,
      });
    }
    if (!(options.validate || defaultJsonShape)(value))
      throw new ApiError({
        kind: "invalid_response",
        status: response.status,
        ...messages.invalid_response,
      });
    return value as T;
  }

  async requestRaw(
    path: string,
    options: RawRequestOptions = {},
  ): Promise<Response> {
    const method = options.method ?? "GET";
    const policy =
      options.retry === false
        ? { maxAttempts: 1, baseDelayMs: 0 }
        : { ...defaultRetry(method), ...(options.retry || {}) };
    const requestId = crypto.randomUUID();
    const target = options.absoluteUrl ? path : `${this.baseUrl}${path}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= policy.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = globalThis.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, options.timeoutMs ?? 10_000);
      const onAbort = () => controller.abort();
      options.signal?.addEventListener("abort", onAbort, { once: true });
      const startedAt = Date.now();
      try {
        const token = await accessToken();
        const response = await fetch(target, {
          method,
          headers: {
            ...(options.body !== undefined &&
            !(options.body instanceof FormData)
              ? { "content-type": "application/json" }
              : {}),
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            "x-request-id": requestId,
            ...(options.headers || {}),
          },
          body:
            options.body === undefined
              ? undefined
              : typeof options.body === "string" ||
                  options.body instanceof Blob ||
                  options.body instanceof FormData ||
                  options.body instanceof ArrayBuffer
                ? options.body
                : JSON.stringify(options.body),
          signal: controller.signal,
        });
        if (!response.ok) {
          const kind = kindFromStatus(response.status);
          recordNetwork({
            requestId,
            method,
            path: target,
            attempt,
            durationMs: Date.now() - startedAt,
            outcome: "http_error",
            status: response.status,
          });
          const error = new ApiError({
            kind,
            status: response.status,
            ...messages[kind],
          });
          if (
            attempt < policy.maxAttempts &&
            (kind === "server" || kind === "rate_limited")
          ) {
            await sleep(
              policy.baseDelayMs * attempt,
              options.signal || new AbortController().signal,
            );
            continue;
          }
          throw error;
        }
        recordNetwork({
          requestId,
          method,
          path: target,
          attempt,
          durationMs: Date.now() - startedAt,
          outcome: "success",
          status: response.status,
        });
        return response;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        lastError = error;
        const cancelled = !!options.signal?.aborted;
        const outcome: NetworkLogEntry["outcome"] = cancelled
          ? "cancelled"
          : timedOut
            ? "timeout"
            : "network_error";
        recordNetwork({
          requestId,
          method,
          path: target,
          attempt,
          durationMs: Date.now() - startedAt,
          outcome,
          status: null,
        });
        if (cancelled)
          throw new ApiError({
            kind: "cancelled",
            status: null,
            ...messages.cancelled,
          });
        if (attempt < policy.maxAttempts && (timedOut || !isAbort(error))) {
          await sleep(
            policy.baseDelayMs * attempt,
            options.signal || new AbortController().signal,
          );
          continue;
        }
        if (timedOut)
          throw new ApiError({
            kind: "timeout",
            status: null,
            ...messages.timeout,
          });
        throw new ApiError({
          kind: "network",
          status: null,
          ...messages.network,
        });
      } finally {
        globalThis.clearTimeout(timeout);
        options.signal?.removeEventListener("abort", onAbort);
      }
    }
    throw lastError instanceof ApiError
      ? lastError
      : new ApiError({ kind: "network", status: null, ...messages.network });
  }
}

export const http = new HttpClient();
export interface ApiData<T> {
  data: T;
}
export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
