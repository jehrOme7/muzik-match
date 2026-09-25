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
  context.AbortController = AbortController;
  const requests = [];
  context.fetch = (_url, options) => {
    const pending = deferred();
    requests.push({ pending, body: JSON.parse(options.body), signal: options.signal });
    return pending.promise;
  };

  context.loadSongRecommendations('Artist A', 'Persona A', 'thai');
  context.reloadSongRec();
  assert.equal(requests.length, 2);
  assert.equal(requests[0].signal.aborted, true);
  assert.equal(requests[1].signal.aborted, false);
  assert.equal(requests[1].body.query, 'Artist A');
  assert.equal(requests[1].body.artist, 'Artist A');
  assert.equal(requests[1].body.persona, 'Persona A');
  assert.equal(requests[1].body.lang, 'thai');
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

test('a stalled song recommendation shows retry and ignores its late response', async () => {
  const { context, elements } = makePage();
  context.AbortController = AbortController;
  const timers = [];
  context.setTimeout = (callback, delay) => {
    timers.push({ callback, delay });
    return timers.length;
  };
  context.clearTimeout = () => {};
  const requests = [];
  context.fetch = (_url, options) => {
    const pending = deferred();
    requests.push({ pending, signal: options.signal });
    return pending.promise;
  };

  context.loadSongRecommendations('Artist A', 'Persona A', 'thai');
  assert.equal(timers[0].delay, 15000);
  timers[0].callback();
  assert.equal(requests[0].signal.aborted, true);
  assert.match(elements.get('songRecContent').innerHTML, /ลองใหม่/);

  context.reloadSongRec();
  assert.equal(requests.length, 2);
  requests[0].pending.resolve({ ok: true, json: () => Promise.resolve({
    songs: [{ name: 'Late song', artist: 'Artist A' }]
  }) });
  await new Promise(setImmediate);
  assert.doesNotMatch(elements.get('songRecContent').innerHTML, /Late song/);
  requests[1].pending.resolve({ ok: true, json: () => Promise.resolve({
    songs: [{ name: 'New song', artist: 'Artist A' }]
  }) });
  await new Promise(setImmediate);
  assert.match(elements.get('songRecContent').innerHTML, /New song/);
});

test('Discover skips empty artist slots and discards a previous image', async () => {
  const { context, elements } = makePage();
  context.daInit();
  assert.equal(context.daAll.length, 273);
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

test('match ranking removes duplicate artists and derives percent from mood distance', () => {
  const { context } = makePage();
  const mood = { dark: 0, chill: 0, energetic: 0, emotional: 0, indie: 0 };
  const exact = { name: 'Exact', mood: { dark: 5, chill: 5, energetic: 5, emotional: 5, indie: 5 } };
  const partial = { name: 'Partial', mood: { dark: 5, chill: 5, energetic: 5, emotional: 5, indie: 0 } };
  const ranked = context.rankArtists([partial, exact, { ...exact, name: ' exact ' }, null], mood);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].a.name, 'Exact');
  assert.equal(ranked[0].score, 50);
  assert.equal(context.matchPercent(ranked[0].score), 100);
  assert.equal(ranked[1].a.name, 'Partial');
  assert.equal(ranked[1].score, 45);
  assert.equal(context.matchPercent(ranked[1].score), 90);
  assert.equal(context.rankArtists([partial, exact], mood)[0].a.name, 'Exact');
});

test('charts show the dated snapshot first and replace it with validated API songs', async () => {
  const { context, elements } = makePage();
  context.initChart();
  assert.match(elements.get('chartTeaserSource').textContent, /27 มิ\.ย\. 2569/);
  const songs = Array.from({ length: 20 }, (_, i) => ({
    title: `Current song ${i + 1}`, artist: `Artist ${i + 1}`,
    artwork: i === 0 ? 'https://example.com/unsafe.jpg' : 'https://is1-ssl.mzstatic.com/art.jpg',
    appleUrl: 'https://music.apple.com/us/album/example'
  }));
  context.fetch = async () => ({ ok: true, json: async () => ({
    songs, updatedAt: '2026-09-25T09:13:39.000Z'
  }) });
  assert.equal(await context.bgRefreshChart(), true);
  assert.equal(context.chartData.length, 20);
  assert.equal(context.chartData[0].title, 'Current song 1');
  assert.equal(context.chartData[0].artwork, '');
  assert.match(elements.get('chartTeaserSource').textContent, /iTunes US Top Songs/);
  assert.match(elements.get('chartPageContent').innerHTML, /Current song 1/);
  assert.match(elements.get('chartPageContent').innerHTML, /ค้นหาบน YouTube/);
  assert.doesNotMatch(elements.get('chartPageContent').innerHTML, /data-video-id=""/);
});

test('charts keep the dated snapshot if the API is unavailable', async () => {
  const { context, elements } = makePage();
  context.initChart();
  const before = context.chartData[0].title;
  context.fetch = async () => { throw new Error('offline'); };
  assert.equal(await context.bgRefreshChart(), false);
  assert.equal(context.chartData[0].title, before);
  assert.match(elements.get('chartPageSource').textContent, /ข้อมูลสำรอง/);
});
