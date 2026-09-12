/** Map incoming URLs (termasuk prefix /api dari BFF Next) ke rute Fastify kanonik. */

export function rewriteRequestUrl(url: string, method = "GET"): string {
  const q = url.indexOf("?");
  const search = q >= 0 ? url.slice(q) : "";
  let path = q >= 0 ? url.slice(0, q) : url;
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (!path.startsWith("/")) path = `/${path}`;

  if (path !== "/api/health" && (path === "/api" || path.startsWith("/api/"))) {
    path = path.slice("/api".length) || "/";
  }

  return mapLegacyPath(method.toUpperCase(), path) + search;
}

export function mapLegacyPath(method: string, path: string): string {
  const m = method.toUpperCase();

  if (m === "GET" && path === "/health") return "/api/health";

  if (m === "POST" && path === "/user/register") return "/customer/register";
  if (m === "POST" && path === "/user/login") return "/customer/login";
  if ((m === "GET" || m === "PATCH" || m === "PUT") && path === "/user/profile") return "/customer/profile";
  if (m === "POST" && (path === "/user/logout" || path === "/auth/logout")) return "/customer/logout";

  if (m === "POST" && path === "/auth/otp/verify") return "/auth/otp-validation";
  if (m === "POST" && path === "/auth/otp/request") return "/auth/otp";

  if (m === "GET" && path === "/me") return "/customer/profile";
  if (m === "GET" && path === "/wallet") return "/customer/coin";
  if (m === "GET" && path === "/wallet/ledger") return "/customer/coin/ledger";

  if (m === "GET" && path === "/catalog/generate") return "/customer/models";
  if (m === "GET" && path === "/catalog/topup") return "/customer/packages";

  if (m === "GET" && path === "/jobs") return "/customer/generated-lists";
  const jobFile = m === "GET" ? path.match(/^\/jobs\/([^/]+)\/file$/) : null;
  if (jobFile) return `/customer/generated/${jobFile[1]}/file`;
  const jobDetail = m === "GET" ? path.match(/^\/jobs\/([^/]+)$/) : null;
  if (jobDetail) return `/customer/generated/${jobDetail[1]}`;

  if (m === "POST" && path === "/admin/auth/logout") return "/admin/logout";
  const adjust = m === "POST" ? path.match(/^\/admin\/users\/([^/]+)\/wallet\/adjust$/) : null;
  if (adjust) return `/admin/topup/poin/${adjust[1]}`;
  const modelUpdate = m === "PATCH" || m === "PUT" ? path.match(/^\/admin\/models\/([^/]+)$/) : null;
  if (modelUpdate) return `/admin/model/${modelUpdate[1]}`;

  return path;
}
