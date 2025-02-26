import { IRequest, error } from 'itty-router';
import { Environment } from './types';
import { Context } from 'hono';
import { AppContext } from '.';

// assets are stored in the bucket under the /uploads path
function getAssetObjectName(uploadId: string) {
  return `uploads/${uploadId.replace(/[^a-zA-Z0-9\_\-]+/g, '_')}`;
}

// when a user uploads an asset, we store it in the bucket. we only allow image and video assets.
export async function handleAssetUpload(ctx: Context<AppContext>) {
  const uploadId = ctx.req.param('uploadId');
  const objectName = getAssetObjectName(uploadId);

  const contentType = ctx.req.header('content-type') ?? '';
  if (!contentType.startsWith('image/') && !contentType.startsWith('video/')) {
    return error(400, 'Invalid content type');
  }

  if (await ctx.env.TLDRAW_BUCKET.head(objectName)) {
    return error(409, 'Upload already exists');
  }

  await ctx.env.TLDRAW_BUCKET.put(objectName, ctx.req.raw.body, {
    httpMetadata: ctx.req.raw.headers,
  });

  return { ok: true };
}

// when a user downloads an asset, we retrieve it from the bucket. we also cache the response for performance.
export async function handleAssetDownload(ctx: Context<AppContext>) {
  const uploadId = ctx.req.param('uploadId');
  const objectName = getAssetObjectName(uploadId);

  // if we have a cached response for this request (automatically handling ranges etc.), return it
  const cacheKey = new Request(ctx.req.url, { headers: ctx.req.raw.headers });

  let cache = caches.default;
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // if not, we try to fetch the asset from the bucket
  const object = await ctx.env.TLDRAW_BUCKET.get(objectName, {
    range: ctx.req.raw.headers,
    onlyIf: ctx.req.raw.headers,
  });

  if (!object) {
    return error(404);
  }

  // write the relevant metadata to the response headers
  const headers = new Headers();
  object.writeHttpMetadata(headers);

  // assets are immutable, so we can cache them basically forever:
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('etag', object.httpEtag);

  // we set CORS headers so all clients can access assets. we do this here so our `cors` helper in
  // worker.ts doesn't try to set extra cors headers on responses that have been read from the
  // cache, which isn't allowed by cloudflare.
  headers.set('access-control-allow-origin', '*');

  // cloudflare doesn't set the content-range header automatically in writeHttpMetadata, so we
  // need to do it ourselves.
  let contentRange;
  if (object.range) {
    if ('suffix' in object.range) {
      const start = object.size - object.range.suffix;
      const end = object.size - 1;
      contentRange = `bytes ${start}-${end}/${object.size}`;
    } else {
      const start = object.range.offset ?? 0;
      const end = object.range.length
        ? start + object.range.length - 1
        : object.size - 1;
      if (start !== 0 || end !== object.size - 1) {
        contentRange = `bytes ${start}-${end}/${object.size}`;
      }
    }
  }

  if (contentRange) {
    headers.set('content-range', contentRange);
  }

  // make sure we get the correct body/status for the response
  const body = 'body' in object && object.body ? object.body : null;
  const status = body ? (contentRange ? 206 : 200) : 304;

  // we only cache complete (200) responses
  if (status === 200) {
    const [cacheBody, responseBody] = body!.tee();
    ctx.executionCtx.waitUntil(
      caches.default.put(cacheKey, new Response(cacheBody, { headers, status }))
    );
    return new Response(responseBody, { headers, status });
  }

  return new Response(body, { headers, status });
}
