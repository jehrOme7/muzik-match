const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

test('standalone playlist page sends unverified entries to playlist search', () => {
  const html = fs.readFileSync(path.join(__dirname, '../public/playlist.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const elements = new Map();
  const classList = { add() {}, remove() {} };
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, {
        href: '', textContent: '', style: {}, classList,
        addEventListener() {}, scrollIntoView() {}, offsetWidth: 0
      });
      return elements.get(id);
    }
  };
  const context = { document, window: { location: { href: 'https://example.com/' } }, URL,
    setTimeout(callback) { callback(); return 1; }, clearTimeout() {} };
  vm.createContext(context);
  vm.runInContext(script, context);

  context.ALL_PLAYLISTS = [{ emoji: '🎵', name: 'เพลงไทยฮิต', desc: 'เพลงไทย', cat: 'เพลงไทย', url: '', search: 'เพลงไทยฮิต' }];
  context.shuffleQueue = [];
  context.shuffle();
  assert.match(elements.get('resultLink').href, /open\.spotify\.com\/search\/.+\/playlists$/);
  assert.equal(elements.get('resultLinkLabel').textContent, 'ค้นหา Playlist ใน Spotify');

  context.ALL_PLAYLISTS = [{ emoji: '🎵', name: 'K-Pop', desc: 'เพลงเกาหลี', cat: 'แนวเพลง', url: 'https://open.spotify.com/playlist/abc123' }];
  context.shuffleQueue = [];
  context.shuffle();
  assert.equal(elements.get('resultLink').href, 'https://open.spotify.com/playlist/abc123');
  assert.equal(elements.get('resultLinkLabel').textContent, 'เปิด Playlist ใน Spotify');
});
