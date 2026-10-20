import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Handle vanity @handle routing
  // Strip basePath /curio if present for regex matching
  let cleanPath = pathname;
  const hasCurioPrefix = pathname.startsWith("/curio");
  if (hasCurioPrefix) {
    cleanPath = pathname.slice(6) || "/";
  }

  // Regex 1: /@handle/:slug -> /list/:slug?curator=handle
  const boardMatch = cleanPath.match(/^\/@([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_-]+)\/?$/);
  if (boardMatch) {
    const [, handle, slug] = boardMatch;
    const url = req.nextUrl.clone();
    url.pathname = hasCurioPrefix ? `/curio/list/${slug}` : `/list/${slug}`;
    url.searchParams.set("curator", handle);
    return NextResponse.rewrite(url);
  }

  // Regex 2: /@handle -> /user/:handle
  const userMatch = cleanPath.match(/^\/@([a-zA-Z0-9_.-]+)\/?$/);
  if (userMatch) {
    const [, handle] = userMatch;
    const url = req.nextUrl.clone();
    url.pathname = hasCurioPrefix ? `/curio/user/${handle}` : `/user/${handle}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public asset extensions (.svg, .png, .jpg, .jpeg, .gif, .webp, .ico)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
