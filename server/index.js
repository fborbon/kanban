const { DynamoDBClient, GetItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { createHmac, timingSafeEqual, randomUUID } = require('crypto');

const dynamo = new DynamoDBClient({ region: 'us-east-1' });
const s3     = new S3Client({ region: 'us-east-1' });
const TABLE  = 'scrum-canva-state';
const BUCKET = 'scrum-forwardforecasting-295936871972';
const CF_URL      = 'https://kanban.forwardforecasting.eu';
const DRIVE_CF_URL = 'https://drive.forwardforecasting.eu';
const UPLOADS_PREFIX = 'uploads/';

const EXT_TYPE = {
  pdf: 'pdf', txt: 'txt', csv: 'csv',
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image', gif: 'image',
};

const JWT_SECRET = process.env.JWT_SECRET;
const SCRUM_USER = process.env.SCRUM_USER;
const SCRUM_PASS = process.env.SCRUM_PASS;

// ── Minimal JWT (no deps) ──────────────────────────────────────────────────
function b64url(str) {
  return Buffer.from(str).toString('base64url');
}

function signJwt(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body   = b64url(JSON.stringify({
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
  }));
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

function verifyJwt(token) {
  try {
    const [header, body, sig] = token.split('.');
    const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    const sBuf = Buffer.from(sig,      'base64url');
    const eBuf = Buffer.from(expected, 'base64url');
    if (sBuf.length !== eBuf.length || !timingSafeEqual(sBuf, eBuf)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
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

  // ── POST /login ──────────────────────────────────────────────────────────
  if (method === 'POST' && path === '/login') {
    let body;
    try { body = JSON.parse(event.body ?? '{}'); } catch { body = {}; }

    if (body.username !== SCRUM_USER || body.password !== SCRUM_PASS) {
      return resp(401, { error: 'Invalid credentials' });
    }
    return resp(200, { token: signJwt({ sub: SCRUM_USER }) });
  }

  // ── Auth guard ───────────────────────────────────────────────────────────
  const auth    = event.headers?.authorization ?? event.headers?.Authorization ?? '';
  const payload = verifyJwt(auth.replace(/^Bearer\s+/, ''));
  if (!payload) return resp(401, { error: 'Unauthorized' });

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
