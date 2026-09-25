const assert = require('node:assert/strict');
const test = require('node:test');

const handler = require('../api/search');

function response() {
  return {
    code: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function request(body) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    socket: { remoteAddress: 'test-client' },
    body
  };
}

test('quiz song recommendations use the live Gemini model and structured music context', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  let call;
  global.fetch = async (url, options) => {
    call = { url, options };
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({
        identified: 'Artist A',
        songs: [{ name: 'Song A', artist: 'Artist A', why: 'เหมาะกับคุณ' }]
      }) }] } }] })
    };
  };

  try {
    const res = response();
    await handler(request({ query: 'Artist A', mode: 'song', artist: 'Artist A', persona: 'Dreamy', lang: 'thai' }), res);
    assert.equal(res.code, 200);
    assert.equal(res.body.songs[0].name, 'Song A');
    assert.equal(call.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent');
    assert.equal(call.options.headers['x-goog-api-key'], 'test-key');
    assert.doesNotMatch(call.url, /test-key/);
    const prompt = JSON.parse(call.options.body).contents[0].parts[0].text;
    assert.match(prompt, /"matchedArtist":"Artist A"/);
    assert.match(prompt, /"musicPersonality":"Dreamy"/);
    assert.match(prompt, /"selectedMusicLanguage":"thai"/);
    assert.doesNotMatch(prompt, /The user likes this song/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('song context rejects unsupported language before contacting Gemini', async () => {
  const res = response();
  await handler(request({ query: 'Artist A', mode: 'song', artist: 'Artist A', lang: 'other' }), res);
  assert.equal(res.code, 400);
});

test('query-only song requests remain supported', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.GEMINI_API_KEY = 'test-key';
  let prompt;
  global.fetch = async (_url, options) => {
    prompt = JSON.parse(options.body).contents[0].parts[0].text;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: '{"songs":[]}' }] } }] }) };
  };
  try {
    const res = response();
    await handler(request({ query: 'indie pop', mode: 'song' }), res);
    assert.equal(res.code, 200);
    assert.match(prompt, /"musicSearchQuery":"indie pop"/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
  }
});
