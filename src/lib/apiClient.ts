/**
 * Client-side API URL resolver that dynamically handles Next.js basePath
 * and Tailscale Serve subpath reverse proxy routing.
 */
export function getApiUrl(path: string): string {
  const prefix =
    typeof window !== "undefined" && window.location.pathname.startsWith("/curio")
      ? "/curio"
      : "";
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (prefix && cleanPath.startsWith(prefix)) return cleanPath;
  return `${prefix}${cleanPath}`;
}

export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(getApiUrl(input), init);
}
