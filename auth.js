/* ===== auth.js — 管理者登入(Supabase Auth,Email + 密碼;帳號與 PlantDex 共用)=====
   window.SWFAuth
     .session()            目前的登入資訊(沒有就是 null)
     .signIn(email, pw)    Promise
     .signOut()            Promise
     .isAdmin()            Promise<boolean>(是否在 swf.admins 名單內;結果會快取)
     .api(method, path, body, prefer)   以登入身分呼叫 swf 資料表(PostgREST),回傳 JSON 或 null
   不用額外函式庫,直接用 fetch。登入資訊存在這個瀏覽器的 localStorage。
   寫入權限由資料庫的 RLS 把關:不是管理者,就算拿到這支程式也改不了任何東西。
*/
(function () {
  'use strict';
  var CFG = window.SWF_BACKEND || {};
  var KEY = 'swf_auth_v1';
  var adminCache = null;

  function base() { return String(CFG.url || '').replace(/\/+$/, ''); }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(s) { try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY); } catch (e) {} }

  function errText(j, status) {
    var m = j && (j.msg || j.error_description || j.message || j.error || j.hint);
    if (m === 'Invalid login credentials') return 'Email 或密碼不正確';
    return m || ('連線失敗(' + status + ')');
  }
  function post(path, body, token) {
    return fetch(base() + path, {
      method: 'POST',
      headers: { apikey: CFG.anonKey, 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || CFG.anonKey) },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error(errText(j, r.status));
        return j;
      });
    });
  }
  function keep(j) {
    var s = { access_token: j.access_token, refresh_token: j.refresh_token,
              expires_at: j.expires_at || (Math.floor(Date.now() / 1000) + (j.expires_in || 3600)),
              user: { id: j.user && j.user.id, email: j.user && j.user.email } };
    save(s); return s;
  }

  function signIn(email, password) {
    adminCache = null;
    return post('/auth/v1/token?grant_type=password', { email: email, password: password }).then(keep);
  }
  function signOut() {
    var s = load(); adminCache = null; save(null);
    if (!s) return Promise.resolve();
    return post('/auth/v1/logout', {}, s.access_token).catch(function () {});
  }
  // 取得有效的 access token;快過期就先換新
  var refreshing = null;
  function token() {
    var s = load();
    if (!s || !s.access_token) return Promise.resolve(null);
    if ((s.expires_at || 0) - Date.now() / 1000 > 90) return Promise.resolve(s.access_token);
    if (!refreshing) {
      refreshing = post('/auth/v1/token?grant_type=refresh_token', { refresh_token: s.refresh_token })
        .then(function (j) { refreshing = null; return keep(j).access_token; })
        .catch(function () { refreshing = null; save(null); adminCache = null; return null; });
    }
    return refreshing;
  }

  function api(method, path, body, prefer) {
    return token().then(function (tk) {
      if (!tk) throw new Error('請先登入');
      var h = { apikey: CFG.anonKey, Authorization: 'Bearer ' + tk,
                'Accept-Profile': CFG.schema || 'swf', 'Content-Profile': CFG.schema || 'swf' };
      if (body !== undefined && body !== null) h['Content-Type'] = 'application/json';
      if (prefer) h.Prefer = prefer;
      return fetch(base() + '/rest/v1/' + path, { method: method, headers: h,
        body: (body !== undefined && body !== null) ? JSON.stringify(body) : undefined });
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) throw new Error(errText(j, r.status));
        return j;
      });
    });
  }

  function isAdmin() {
    if (adminCache !== null) return Promise.resolve(adminCache);
    if (!load() || !CFG.url) return Promise.resolve(false);
    return api('POST', 'rpc/is_admin', {}).then(function (v) { adminCache = (v === true); return adminCache; })
      .catch(function () { return false; });
  }

  window.SWFAuth = { session: load, signIn: signIn, signOut: signOut, isAdmin: isAdmin, api: api };
})();
