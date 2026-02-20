/**
 * Vercel Edge Middleware that proxies `/github-releases/` requests to GitHub,
 * following the full redirect chain server-side.
 *
 * GitHub release downloads redirect to `release-assets.githubusercontent.com`
 * which doesn't set CORS headers. A plain Vercel rewrite passes the 302 back
 * to the browser, causing a CORS failure. This middleware follows the redirects
 * (like the Vite dev proxy with `followRedirects: true`) and returns the final
 * response with the correct headers.
 */
export default async function middleware(request: Request) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith('/github-releases/')) {
    return;
  }

  const path = url.pathname.replace(/^\/github-releases\//, '');

  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = `https://github.com/${path}`;

  try {
    const upstream = await fetch(targetUrl, {
      redirect: 'follow',
      headers: { 'User-Agent': 'vercel-proxy' },
    });

    if (!upstream.ok) {
      return new Response(upstream.statusText, { status: upstream.status });
    }

    const responseHeaders = new Headers();

    for (const key of [
      'content-type',
      'content-length',
      'content-disposition',
    ]) {
      const value = upstream.headers.get(key);
      if (value) responseHeaders.set(key, value);
    }

    // CORS + COEP headers (match vercel.json global headers)
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Cross-Origin-Resource-Policy', 'cross-origin');

    return new Response(upstream.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`github-releases proxy error: ${message}`);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
