/* ===== backend.js — 從 Supabase(swf schema)讀資料,組回和 data.json 一樣的形狀 =====
   window.SWF.enabled()  是否啟用動態後端(config/supabase.js)
   window.SWF.loadAll()  Promise → { plants:[…], categories:[…] }(同 data.json),
                         並把 介紹 / 知識庫 / 來源·母株 / 關於 覆寫到
                         window.PLANT_NOTES / SF_KNOWLEDGE(_CATS) / PLANT_SOURCES / SF_ABOUT。
                         任何一步失敗就 reject,app.js 會退回靜態檔。
   只做「讀」;用瀏覽器內建 fetch 直接打 PostgREST,不需要額外函式庫。
*/
(function () {
  'use strict';
  var CFG = window.SWF_BACKEND || {};

  function enabled() { return !!(CFG.enabled && CFG.url && CFG.anonKey); }

  // 讀整張表(PostgREST 預設一次最多 1000 筆 → 分頁讀完)
  function fetchAll(table, query, signal) {
    var out = [], page = 1000;
    function next(offset) {
      var url = CFG.url.replace(/\/+$/, '') + '/rest/v1/' + table + '?' + query + '&limit=' + page + '&offset=' + offset;
      return fetch(url, {
        signal: signal,
        headers: { apikey: CFG.anonKey, Authorization: 'Bearer ' + CFG.anonKey, 'Accept-Profile': CFG.schema || 'swf' }
      }).then(function (r) {
        if (!r.ok) throw new Error(table + ' HTTP ' + r.status);
        return r.json();
      }).then(function (rows) {
        out = out.concat(rows);
        return rows.length === page ? next(offset + page) : out;
      });
    }
    return next(0);
  }

  function bySort(a, b) { return (a.sort || 0) - (b.sort || 0); }

  // 資料列 → data.json 形狀(純函式,方便測試)
  function assemble(t) {
    var indByPlant = {}, phByInd = {};
    t.photos.forEach(function (p) { (phByInd[p.individual_id] = phByInd[p.individual_id] || []).push(p); });
    t.individuals.forEach(function (iv) { (indByPlant[iv.plant_key] = indByPlant[iv.plant_key] || []).push(iv); });

    var plants = t.plants.slice().sort(bySort).map(function (p) {
      var diary = p.category === '日記';
      var o = { name: p.name, latin: p.latin || '', category: p.category, date: p.date || '', note: p.note || '', cover: p.cover || '' };
      if (!diary && p.pid) o.pid = p.pid;
      if (p.cover_locked) o.coverLocked = true;
      o.key = p.key;
      o.individuals = (indByPlant[p.key] || []).slice().sort(bySort).map(function (iv) {
        var ph = (phByInd[iv.id] || []).slice().sort(bySort);
        var v = { label: iv.label || '', name: iv.name || '', cover: iv.cover || '' };
        if (!diary) v.id = iv.id;
        var mother = ph.filter(function (x) { return x.kind === 'mother'; }).map(function (x) { return x.drive_id; });
        if (mother.length) v.mother = mother;
        if (iv.mother_info) v.motherInfo = iv.mother_info;
        v.timeline = ph.filter(function (x) { return x.kind !== 'mother'; }).map(function (x) {
          return { date: x.date || '', tag: x.tag || '', note: x.note || '', photo: x.drive_id };
        });
        return v;
      });
      return o;
    });

    var categories = t.categories.slice().sort(bySort).map(function (c) {
      var o = { name: c.name, cover: c.cover || '' };
      if (c.model != null) o.model = c.model;
      if (c.fx) o.fx = c.fx;
      return o;
    });

    var nameOf = {}; t.plants.forEach(function (p) { nameOf[p.key] = p.name; });
    var notes = {}; (t.plant_notes || []).forEach(function (n) { if (nameOf[n.plant_key]) notes[nameOf[n.plant_key]] = n.body; });
    var sources = {}; (t.sources || []).forEach(function (s) {
      var nm = nameOf[s.plant_key]; if (!nm) return;
      (sources[nm] = sources[nm] || {})[s.label || ''] = { source: s.source || '', mother: s.mother || '' };
    });
    var articles = (t.articles || []).slice().sort(bySort).map(function (a) {
      var o = { id: a.id, cat: a.cat, group: a.grp || '', title: a.title, lead: a.lead || '', body: a.body || [] };
      if (a.short) o.short = a.short;
      if (a.img) o.img = a.img;
      if (a.img_credit) o.imgCredit = a.img_credit;
      return o;
    });
    var cats = (t.article_cats || []).slice().sort(bySort).map(function (c) { return c.name; });
    var about = (t.about && t.about[0]) || null;
    return { plants: plants, categories: categories, notes: notes, sources: sources, articles: articles, articleCats: cats, about: about };
  }

  function loadAll() {
    if (!enabled()) return Promise.reject(new Error('backend disabled'));
    var ctl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, CFG.timeoutMs || 6000);
    var sig = ctl ? ctl.signal : undefined;
    var jobs = [
      ['plants', 'select=key,pid,name,latin,category,date,note,cover,cover_locked,sort'],
      ['individuals', 'select=id,plant_key,label,name,cover,mother_info,sort'],
      ['photos', 'select=drive_id,individual_id,kind,date,tag,note,sort&order=individual_id.asc,sort.asc,drive_id.asc'],
      ['categories', 'select=name,cover,model,fx,sort'],
      ['plant_notes', 'select=plant_key,body'],
      ['sources', 'select=plant_key,label,source,mother'],
      ['articles', 'select=id,cat,grp,title,lead,body,img,img_credit,short,sort'],
      ['article_cats', 'select=name,sort'],
      ['about', 'select=lines,font']
    ];
    return Promise.all(jobs.map(function (j) {
      // 穩定排序(分頁時不會漏/重複):有指定 order 就用,否則交給各表主鍵
      var q = j[1].indexOf('order=') >= 0 ? j[1] : j[1] + '&order=' + j[1].replace('select=', '').split(',')[0] + '.asc';
      return fetchAll(j[0], q, sig);
    })).then(function (res) {
      clearTimeout(timer);
      var t = {}; jobs.forEach(function (j, i) { t[j[0]] = res[i]; });
      if (!t.plants.length) throw new Error('backend has no plants');
      var d = assemble(t);
      // 內容覆寫(資料庫有才蓋過靜態檔)
      if (Object.keys(d.notes).length) window.PLANT_NOTES = d.notes;
      if (Object.keys(d.sources).length) window.PLANT_SOURCES = d.sources;
      if (d.articles.length) window.SF_KNOWLEDGE = d.articles;
      if (d.articleCats.length) window.SF_KNOWLEDGE_CATS = d.articleCats;
      if (d.about && d.about.lines && d.about.lines.length) {
        window.SF_ABOUT = d.about.lines;
        window.SF_ABOUT_FONT = d.about.font || '';      // 資料庫是空字串 = 管理者把字型清掉,用網站預設
      }
      return { plants: d.plants, categories: d.categories, _source: 'supabase' };
    }, function (e) { clearTimeout(timer); throw e; });
  }

  window.SWF = { enabled: enabled, loadAll: loadAll, _assemble: assemble };
})();
