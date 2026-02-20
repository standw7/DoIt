import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BACKEND_URL =
  process.env.BACKEND_URL ??
  (process.env.NODE_ENV === "development"
    ? "http://localhost:8000"
    : "http://doit-backend:8000");

async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const backendPath = pathname.replace(/^\/api\/backend/, "");
  const url = `${BACKEND_URL}${backendPath}${search}`;

  // Forward all headers except host/connection
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key !== "host" && key !== "connection" && key !== "transfer-encoding") {
      headers[key] = value;
    }
  });

  let body: BodyInit | null = null;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  try {
    let res = await fetch(url, {
      method: req.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    // Handle redirects manually to preserve Authorization headers
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (location) {
        const redirectUrl = new URL(location, url);
        res = await fetch(redirectUrl.toString(), {
          method: req.method,
          headers,
          body,
          cache: "no-store",
          redirect: "manual",
        });
      }
    }

    const data = await res.text();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("content-type") || "application/json",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { detail: `Backend unreachable: ${String(err)}` },
      { status: 502 }
    );
  }
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const DELETE = proxy;
export const PATCH = proxy;
