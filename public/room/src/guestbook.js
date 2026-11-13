/* The visitor book.
 *
 * A portfolio room is read-only by nature: people look and leave, and you never
 * know they came. This is the one surface that runs the other way. It is open
 * to anyone — no sign-in, no email — because a book you have to register for is
 * a book nobody signs.
 *
 * The store is injected, so the room works unchanged whether it is hosted as a
 * static site with Firebase behind it or opened with no backend at all.
 */
const NOTE_MAX = 180;
const NAME_MAX = 40;

export function createGuestbook(store) {
  let entries = [];
  let status = store ? 'loading' : 'unconfigured';
  const listeners = [];

  function emit() { for (const f of listeners) f(entries, status); }

  async function init() {
    if (!store) { emit(); return; }
    // never let a slow or blocked network leave the panel spinning
    const guard = setTimeout(() => {
      if (status === 'loading') { status = 'unavailable'; emit(); }
    }, 9000);
    try {
      entries = await store.list();
      status = 'ready';
    } catch (e) {
      status = 'unavailable';
    }
    clearTimeout(guard);
    emit();
  }

  function clean(s, n) {
    return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, n);
  }

  async function sign(name, note) {
    if (!store) return { ok: false, why: 'unconfigured' };
    const nm = clean(name, NAME_MAX) || 'Anonymous';
    const nt = clean(note, NOTE_MAX);
    if (!nt) return { ok: false, why: 'empty' };
    try {
      const row = await store.sign(nm, nt);
      const mine = row && row.id ? row.id : (store.uid || 'me');
      entries = entries.filter((e) => e.id !== mine);
      entries.unshift({ id: mine, name: nm, note: nt, at: Date.now() });
      status = 'ready';
      emit();
      return { ok: true };
    } catch (e) {
      return { ok: false, why: 'refused' };
    }
  }

  return {
    init,
    sign,
    onChange(f) { listeners.push(f); f(entries, status); },
    get entries() { return entries; },
    get status() { return status; },
    get canSign() { return !!store && status !== 'unavailable'; },
    get mine() {
      const id = store && store.uid;
      return id ? entries.find((e) => e.id === id) : null;
    },
    get count() { return entries.length; },
  };
}
