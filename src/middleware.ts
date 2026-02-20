import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Auth is handled client-side via AuthProvider + JWT in localStorage.
  // Middleware just passes through all requests.
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
