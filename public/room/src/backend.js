/* Storage for the visitor book, behind an adapter.
 *
 * The room is published as a Claude artifact for review but will be hosted as a
 * plain static site, so the store cannot depend on either environment. This
 * talks to Firestore over its REST API rather than the Firebase SDK: no
 * hundred-kilobyte dependency, no build step, and it works from any origin.
 *
 * Anonymous auth gives every visitor a uid without asking them for anything,
 * and each visitor writes exactly one document keyed by that uid. Validation
 * lives in the security rules, not here — a client can always be bypassed.
 */
const AUTH = 'https://identitytoolkit.googleapis.com/v1/accounts:signUp';
const FS = 'https://firestore.googleapis.com/v1/projects';
const UID_KEY = 'room.visitor.uid';
const TOK_KEY = 'room.visitor.tok';

function store(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch (e) { /* private mode: fall back to a session-only identity */ }
  return v;
}

export function createFirebaseStore(cfg) {
  if (!cfg || !cfg.apiKey || !cfg.projectId) return null;
  const base = `${FS}/${cfg.projectId}/databases/(default)/documents`;
  let uid = store(UID_KEY) || null;
  let token = null;

  async function signIn() {
    if (token) return token;
    const r = await fetch(`${AUTH}?key=${encodeURIComponent(cfg.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ returnSecureToken: true }),
    });
    if (!r.ok) throw new Error('auth ' + r.status);
    const j = await r.json();
    // a returning visitor keeps their row rather than adding a second one
    uid = store(UID_KEY) || j.localId;
    store(UID_KEY, uid);
    token = j.idToken;
    store(TOK_KEY, token);
    return token;
  }

  function decode(doc) {
    const f = (doc && doc.fields) || {};
    const id = (doc.name || '').split('/').pop();
    return {
      id,
      name: f.name ? f.name.stringValue : '',
      note: f.note ? f.note.stringValue : '',
      at: f.at ? Number(f.at.integerValue || 0) : 0,
    };
  }

  return {
    get uid() { return uid; },

    async list(limit = 60) {
      // one read per entry on open, rather than a live listener that re-reads:
      // the free tier is generous but there is no reason to spend it
      const r = await fetch(`${base}/guestbook?pageSize=${limit}`, { method: 'GET' });
      if (!r.ok) throw new Error('list ' + r.status);
      const j = await r.json();
      const rows = (j.documents || []).map(decode).filter((e) => e.note);
      rows.sort((a, b) => b.at - a.at);
      return rows;
    },

    async sign(name, note) {
      await signIn();
      if (!uid) throw new Error('no uid');
      const body = {
        fields: {
          name: { stringValue: name },
          note: { stringValue: note },
          at: { integerValue: String(Date.now()) },
        },
      };
      const url = `${base}/guestbook/${encodeURIComponent(uid)}`;
      let r = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      if (r.status === 401) {                 // token aged out mid-session
        token = null;
        await signIn();
        r = await fetch(url, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
          body: JSON.stringify(body),
        });
      }
      if (!r.ok) throw new Error('write ' + r.status);
      return decode(await r.json());
    },
  };
}
