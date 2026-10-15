const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { S3Client, PutObjectCommand, GetObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { timingSafeEqual, randomUUID } = require('crypto');

const dynamo = new DynamoDBClient({ region: 'eu-west-1' });
const s3     = new S3Client({ region: 'eu-west-1' });
const TABLE  = 'kanban-state';
const BUCKET = 'kanban-forwardforecasting-295936871972';
const CF_URL      = 'https://kanban.forwardforecasting.eu';
const DRIVE_CF_URL = 'https://drive.forwardforecasting.eu';
const UPLOADS_PREFIX = 'uploads/';

const EXT_TYPE = {
  pdf: 'pdf', txt: 'txt', csv: 'csv',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
};

// Auth: the app is served only through nginx on the EC2 host, behind the central login
// (Authelia, password + Google Authenticator). nginx adds X-Origin-Secret to every request it
// forwards here; anything without it (direct API Gateway / old CloudFront calls) is refused.
const ORIGIN_SECRET = process.env.ORIGIN_SECRET ?? '';
const SCRUM_USER    = process.env.SCRUM_USER;   // DynamoDB key of the single board

function fromTrustedProxy(event) {
  const got = event.headers?.['x-origin-secret'] ?? event.headers?.['X-Origin-Secret'] ?? '';
  if (!ORIGIN_SECRET || !got) return false;                        // fail closed if unset
  const a = Buffer.from(got), b = Buffer.from(ORIGIN_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Helpers ────────────────────────────────────────────────────────────────
function resp(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(body),
  };
}

function getPath(event) {
  const raw = event.rawPath ?? event.path ?? '';
  // Strip /api prefix → /login, /state, etc.
  return raw.replace(/^\/api/, '') || '/';
}

// ── Handler ────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const method = (event.requestContext?.http?.method ?? event.httpMethod ?? 'GET').toUpperCase();
  const path   = getPath(event);

  // ── Auth guard (central login happens in nginx) ───────────────────────
  if (!fromTrustedProxy(event)) return resp(401, { error: 'Unauthorized' });
  if (path === '/login') return resp(410, { error: 'Login moved to the central portal' });
  const payload = { sub: SCRUM_USER };

  // ── GET /file?key=uploads/... : attachments, served only behind the login ─
  if (method === 'GET' && path === '/file') {
    const key = event.queryStringParameters?.key ?? '';
    if (!key.startsWith(UPLOADS_PREFIX) || key.includes('..')) return resp(400, { error: 'Invalid key' });
    try {
      const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
      const body = Buffer.from(await obj.Body.transformToByteArray());
      return {
        statusCode: 200,
        headers: { 'Content-Type': obj.ContentType ?? 'application/octet-stream', 'Cache-Control': 'private, max-age=300' },
        body: body.toString('base64'),
        isBase64Encoded: true,
      };
    } catch {
      return resp(404, { error: 'Not found' });
    }
  }

  // ── GET /state ───────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/state') {
    const result = await dynamo.send(new GetItemCommand({
      TableName: TABLE,
      Key: marshall({ userId: payload.sub }),
    }));
    const state = result.Item
      ? unmarshall(result.Item).state
      : { tasks: [], categories: [] };
    return resp(200, state);
  }

  // ── PUT /state ───────────────────────────────────────────────────────────
  if (method === 'PUT' && path === '/state') {
    let state;
    try { state = JSON.parse(event.body ?? '{}'); } catch { return resp(400, { error: 'Bad JSON' }); }
    await dynamo.send(new PutItemCommand({
      TableName: TABLE,
      Item: marshall({ userId: payload.sub, state, updatedAt: new Date().toISOString() }),
    }));
    return resp(200, { ok: true });
  }

  // ── POST /upload ─────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/upload') {
    let body;
    try { body = JSON.parse(event.body ?? '{}'); } catch { return resp(400, { error: 'Bad JSON' }); }
    const { data, mimeType, filename } = body;
    if (!data || !mimeType) return resp(400, { error: 'Missing data or mimeType' });

    const EXT_MAP = {
      'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif',
      'application/pdf': 'pdf', 'text/plain': 'txt', 'text/csv': 'csv',
    };
    const ext  = EXT_MAP[mimeType] ?? 'bin';
    const folder = mimeType.startsWith('image/') ? 'images' : 'files';
    const key  = `uploads/${folder}/${randomUUID()}.${ext}`;
    const buf  = Buffer.from(data, 'base64');

    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: mimeType,
    }));

    return resp(200, { url: `${CF_URL}/${key}` });
  }

  // ── GET /drive ───────────────────────────────────────────────────────────
  if (method === 'GET' && path === '/drive') {
    const result = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: UPLOADS_PREFIX,
    }));
    const files = (result.Contents ?? [])
      .filter(obj => obj.Key !== UPLOADS_PREFIX && obj.Size > 0)
      .map(obj => {
        const name = obj.Key.split('/').pop();
        const ext  = (name.split('.').pop() ?? '').toLowerCase();
        return {
          key:          obj.Key,
          name,
          type:         EXT_TYPE[ext] ?? 'file',
          size:         obj.Size,
          lastModified: obj.LastModified,
          url:          `${CF_URL}/${obj.Key}`,
        };
      })
      .sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
    return resp(200, files);
  }

  // ── DELETE /drive ─────────────────────────────────────────────────────────
  if (method === 'DELETE' && path === '/drive') {
    let body;
    try { body = JSON.parse(event.body ?? '{}'); } catch { return resp(400, { error: 'Bad JSON' }); }
    const { key } = body;
    if (!key || !key.startsWith(UPLOADS_PREFIX)) return resp(400, { error: 'Invalid key' });
    await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    return resp(200, { ok: true });
  }

  return resp(404, { error: 'Not found' });
};
