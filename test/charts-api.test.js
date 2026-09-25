const assert = require('node:assert/strict');
const test = require('node:test');

function response() {
  return {
    headers: {}, statusCode: 200, body: null,
    setHeader(key, value) { this.headers[key] = value; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('chart API returns feed update time and bounds the requested limit', async () => {
  const originalFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ feed: {
      updated: { label: '2026-09-25T02:13:39-07:00' },
      entry: Array.from({ length: 20 }, (_, i) => ({
        'im:name': { label: `Song ${i + 1}` },
        'im:artist': { label: `Artist ${i + 1}` },
        'im:image': [{ label: 'https://is1-ssl.mzstatic.com/image/100x100bb.jpg' }],
        link: [{ attributes: { type: 'text/html', href: 'https://music.apple.com/us/album/example' } }]
      }))
    } })
  });
  try {
    const handler = require('../api/charts');
    const full = response();
    await handler({ method: 'GET', query: { limit: '20' } }, full);
    assert.equal(full.statusCode, 200);
    assert.equal(full.body.songs.length, 20);
    assert.equal(full.body.updatedAt, '2026-09-25T09:13:39.000Z');
    assert.equal(full.body.songs[0].artwork, 'https://is1-ssl.mzstatic.com/image/300x300bb.jpg');

    const bounded = response();
    await handler({ method: 'GET', query: { limit: '0' } }, bounded);
    assert.equal(bounded.body.songs.length, 1);
    assert.equal(bounded.body.updatedAt, full.body.updatedAt);
  } finally {
    global.fetch = originalFetch;
  }
});
