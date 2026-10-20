const API_BASE = import.meta.env.VITE_API_URL || "/api";
const isDevelopment = import.meta.env.DEV;

function logAuthResponse(details) {
  if (isDevelopment)
    console.info("[KrishiSetu auth]", {
      ...details,
      note: "Response bodies, cookies, and credentials are not logged.",
    });
}

function getEndpointPath(url) {
  return new URL(url, "http://localhost").pathname;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isAuthRequest = path.startsWith("/auth/");
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const url = `${API_BASE}${path}`;
  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
      ...(isAuthRequest ? { cache: "no-store" } : {}),
      body:
        options.body && !(options.body instanceof FormData)
          ? JSON.stringify(options.body)
          : options.body,
    });
  } catch (error) {
    if (isAuthRequest)
      logAuthResponse({
        method: options.method || "GET",
        url,
        status: "network error",
        contentType: "unavailable",
        error: error.message,
      });
    throw error;
  }
  const contentType = response.headers?.get?.("content-type") || "not provided";
  const endpoint = getEndpointPath(url);
  if (response.status === 304) {
    logAuthResponse({
      method: options.method || "GET",
      url,
      status: response.status,
      contentType,
      error: "304 responses cannot establish current authentication state.",
    });
    const error = new Error(
      "The server returned 304 Not Modified without a current API response.",
    );
    error.status = 304;
    throw error;
  }
  let payload = {};
  if (response.status !== 204) {
    if (typeof response.text === "function") {
      const text = await response.text();
      if (text.trim()) {
        try {
          payload = JSON.parse(text);
        } catch (error) {
          if (isDevelopment)
            console.error("[KrishiSetu API]", {
              method: options.method || "GET",
              endpoint,
              status: response.status,
              contentType,
              error: `JSON parsing failed: ${error.message}`,
            });
          if (isAuthRequest)
            logAuthResponse({
              method: options.method || "GET",
              url,
              status: response.status,
              contentType,
              error: `JSON parsing failed: ${error.message}`,
              responseLength: text.length,
            });
          if (response.ok) {
            const parseError = new Error(
              `API endpoint ${endpoint} returned a non-JSON response (${response.status}, ${contentType}).`,
            );
            parseError.status = response.status;
            throw parseError;
          }
        }
      } else if (response.ok) {
        if (isAuthRequest)
          logAuthResponse({
            method: options.method || "GET",
            url,
            status: response.status,
            contentType,
            error: "Response body was empty.",
          });
        const emptyError = new Error(
          `The server returned an empty response (${response.status}).`,
        );
        emptyError.status = response.status;
        throw emptyError;
      }
    } else if (typeof response.json === "function") {
      try {
        payload = await response.json();
      } catch (error) {
        if (isDevelopment)
          console.error("[KrishiSetu API]", {
            method: options.method || "GET",
            endpoint,
            status: response.status,
            contentType,
            error: `JSON parsing failed: ${error.message}`,
          });
        if (isAuthRequest)
          logAuthResponse({
            method: options.method || "GET",
            url,
            status: response.status,
            contentType,
            error: `JSON parsing failed: ${error.message}`,
          });
        if (response.ok)
          throw new Error(
            `API endpoint ${endpoint} returned a non-JSON response (${response.status}, ${contentType}).`,
          );
      }
    } else if (response.ok) {
      if (isAuthRequest)
        logAuthResponse({
          method: options.method || "GET",
          url,
          status: response.status,
          contentType,
          error: "Response body was empty.",
        });
      const emptyError = new Error(
        `The server returned an empty response (${response.status}).`,
      );
      emptyError.status = response.status;
      throw emptyError;
    }
  }
  if (isAuthRequest)
    logAuthResponse({
      method: options.method || "GET",
      url,
      status: response.status,
      contentType,
      responseDataKeys:
        payload.data && typeof payload.data === "object"
          ? Object.keys(payload.data)
          : [],
    });
  if (!response.ok) {
    const error = new Error(
      payload.error?.message || `Request failed (${response.status}).`,
    );
    error.status = response.status;
    error.details = payload.error?.details;
    throw error;
  }
  return payload.data;
}

export function imageUrl(path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;

  const origin = API_BASE.replace(/\/api\/?$/, "");
  return `${origin}${path}`;
}
