const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../public/index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function makePage() {
  const elements = new Map();
  const listeners = {};
  const classList = { add() {}, remove() {}, toggle() {} };
  const document = {
    body: { classList },
    addEventListener(type, handler) { listeners[type] = handler; },
    getElementById(id) {
      if (!elements.has(id)) {
        elements.set(id, {
          innerHTML: '', textContent: '', style: {}, classList,
          dataset: {}, scrollIntoView() {}, addEventListener() {}
        });
      }
      return elements.get(id);
    },
    querySelectorAll() { return []; }
  };
  const context = {
    document, URL, console, setTimeout, clearTimeout,
    CSS: { escape: String },
    window: { CSS: { escape: String }, scrollTo() {} }
  };
  vm.createContext(context);
  vm.runInContext(script, context);
  return { context, elements, listeners };
}

test('chart actions remain valid for song names containing quotes', () => {
  const { context, elements, listeners } = makePage();
  const song = {
    rank: 1, title: 'Track "one" & Don\'t', artist: 'A < B',
    artwork: '', appleUrl: '', youtubeId: 'abcdefghijk'
  };
  context.renderChartTeaser([song]);
  context.renderChartPage([song]);
  const markup = elements.get('chartPageContent').innerHTML;
  assert.match(markup, /data-video-title="Track &quot;one&quot; &amp; Don&#39;t"/);
  assert.match(markup, /data-video-artist="A &lt; B"/);
  assert.match(markup, /data-chart-action="spotify"/);
  assert.doesNotMatch(markup, /onclick="return (openSpotify|playChartMV)/);

  listeners.DOMContentLoaded();
  let played;
  context.playChartMV = (...args) => { played = args; };
  let prevented = false;
  listeners.click({
    target: { closest: () => ({ dataset: {
      chartAction: 'video', videoId: song.youtubeId,
      videoTitle: song.title, videoArtist: song.artist
    } }) },
    preventDefault() { prevented = true; }
  });
  assert.equal(prevented, true);
  assert.deepEqual(Array.from(played), [null, song.youtubeId, song.title, song.artist]);
});

test('retry uses the current result and ignores a late previous response', async () => {
  const { context, elements } = makePage();
  const requests = [];
  context.fetch = (_url, options) => {
    const pending = deferred();
    requests.push({ pending, body: JSON.parse(options.body) });
    return pending.promise;
  };

  context.loadSongRecommendations('Artist A', 'Persona A', 'thai');
  context.reloadSongRec();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].body.query, 'Artist A Persona A');
  requests[1].pending.resolve({ ok: true, json: () => Promise.resolve({
    songs: [{ name: 'Current song', artist: 'Artist A' }]
  }) });
  await new Promise(setImmediate);
  requests[0].pending.resolve({ ok: true, json: () => Promise.resolve({
    songs: [{ name: 'Old song', artist: 'Artist A' }]
  }) });
  await new Promise(setImmediate);
  const result = elements.get('songRecContent').innerHTML;
  assert.match(result, /Current song/);
  assert.doesNotMatch(result, /Old song/);
});

test('Discover skips empty artist slots and discards a previous image', async () => {
  const { context, elements } = makePage();
  context.daInit();
  assert.equal(context.daAll.length, 300);
  const pending = [];
  const applied = [];
  context.fetchWikiSummaryThumb = () => {
    const request = deferred();
    pending.push(request);
    return request.promise;
  };
  context.setWikiImgToEl = (_el, src) => { applied.push(src); return true; };
  context.daQueue = [0];
  context.daShuffle();
  context.daQueue = [1];
  context.daShuffle();
  pending[1].resolve('https://upload.wikimedia.org/new.jpg');
  await new Promise(setImmediate);
  pending[0].resolve('https://upload.wikimedia.org/old.jpg');
  await new Promise(setImmediate);
  assert.deepEqual(applied, ['https://upload.wikimedia.org/new.jpg']);
  assert.ok(elements.get('daName').textContent);
});
