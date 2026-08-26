import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "studio_scheduler_session";

export function proxy(req: NextRequest) {
  const authed = req.cookies.get(COOKIE_NAME)?.value === "ok";

  if (!authed) {
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
