# -*- coding: utf-8 -*-
"""
StagwithyouFerns:把「網頁上改過的內容」寫回 repo 的檔案(資料庫 -> 檔案)
========================================================================
管理者在網站/後台改的東西先存在 Supabase(該列 web_edited = true)。
這支腳本把這些列寫回檔案,讓 GitHub 上的檔案保持是完整備份,然後把 web_edited 設回 false:

  植物介紹      swf.plant_notes  -> plant-notes.js(該株那一行)
  來源·母株文字  swf.sources      -> sources.js(整檔由資料庫重新產生)
  封面          swf.plants / swf.individuals 的 cover -> data.json(植物封面同時設 coverLocked)
  知識庫文章    swf.articles     -> knowledge.js(整檔由資料庫重新產生;隱藏的文章會從檔案移除並刪除)
                                    私人文章 / 私人分類(admin_only = true)永遠不寫進檔案

由 .github/workflows/sync.yml 每天在 Drive 同步之前執行;也可以手動跑。
  python tools/export_from_supabase.py            實際寫檔並清旗標
  python tools/export_from_supabase.py --dry-run  只報告
  python tools/export_from_supabase.py --defer-clear m.json   寫檔但先不清旗標,把清單存到 m.json
  python tools/export_from_supabase.py --clear m.json         檔案確定推上 GitHub 後,再依清單清旗標
(分兩步是為了安全:萬一 push 失敗,旗標還在,網頁上的修改不會被下一次匯入蓋掉。)
環境變數:SUPABASE_URL / SUPABASE_SERVICE_KEY(本機沒有時沿用 ..\\plantdex\\tools\\sync_config.json)
"""
import hashlib, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DRY = '--dry-run' in sys.argv or '-n' in sys.argv
def _arg(flag): return sys.argv[sys.argv.index(flag) + 1] if flag in sys.argv else None
DEFER, CLEAR = _arg('--defer-clear'), _arg('--clear')


def q(s):
    """JS 單引號字串"""
    return "'" + str(s).replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n').replace('\r', '') + "'"


def read(name):
    return open(os.path.join(ROOT, name), encoding='utf-8', newline='').read()


def write(name, text):
    if DRY: return
    open(os.path.join(ROOT, name), 'w', encoding='utf-8', newline='').write(text)


def plant_key(p):
    if p.get('category') == '日記': return 'diary'
    return hashlib.sha1((p.get('fid') or p['name']).encode('utf-8')).hexdigest()[:10]


# ---------------------------------------------------------------- 各檔的寫回(純函式,方便測試)
def apply_notes(src, notes):
    """notes: {植物名: 介紹文字} -> 新的 plant-notes.js 內容"""
    nl = '\r\n' if '\r\n' in src else '\n'
    for name, body in notes.items():
        line = '  ' + json.dumps(name, ensure_ascii=False) + ': ' + json.dumps(body, ensure_ascii=False) + ','
        pat = re.compile(r'^  ' + re.escape(json.dumps(name, ensure_ascii=False)) + r': ".*",?[ \t]*\r?$', re.M)
        if pat.search(src):
            src = pat.sub(lambda m: line + ('\r' if m.group(0).endswith('\r') else ''), src, count=1)
        else:
            t = src.rindex('};')
            src = src[:t] + line + nl + src[t:]
    return src


def build_sources(src, rows, name_of):
    """整檔重產 sources.js:保留檔頭註解,內容 = 資料庫裡所有非空的來源·母株文字"""
    head = src[:src.index('window.PLANT_SOURCES')]
    nl = '\r\n' if '\r\n' in src else '\n'
    by = {}
    for r in rows:
        nm = name_of.get(r['plant_key'])
        if not nm or not ((r.get('source') or '') or (r.get('mother') or '')): continue
        by.setdefault(nm, {})[r.get('label') or ''] = {'source': r.get('source') or '', 'mother': r.get('mother') or ''}
    out = ['window.PLANT_SOURCES = {']
    for nm in sorted(by):
        out.append('  ' + json.dumps(nm, ensure_ascii=False) + ': {')
        labs = sorted(by[nm])
        for i, lab in enumerate(labs):
            v = by[nm][lab]
            out.append('    %s: { source: %s, mother: %s }%s' % (json.dumps(lab, ensure_ascii=False),
                       json.dumps(v['source'], ensure_ascii=False), json.dumps(v['mother'], ensure_ascii=False),
                       ',' if i < len(labs) - 1 else ''))
        out.append('  },')
    out.append('};')
    return head.replace('\r\n', '\n').replace('\n', nl) + nl.join(out) + nl


def build_knowledge(src, articles, cats):
    """整檔重產 knowledge.js:保留檔頭註解;articles 依 sort 排,cats = 分類順序"""
    head = src[:src.index('window.SF_KNOWLEDGE_CATS')]
    nl = '\r\n' if '\r\n' in src else '\n'
    out = ['window.SF_KNOWLEDGE_CATS = [' + ', '.join(q(c) for c in cats) + '];', '', 'window.SF_KNOWLEDGE = [', '']
    last = None
    for a in sorted(articles, key=lambda x: (x.get('sort') or 0, x['id'])):
        if a['cat'] != last:
            out.append('/* ---------- %s ---------- */' % a['cat']); last = a['cat']
        parts = ['id:' + q(a['id']), 'cat:' + q(a['cat']), 'group:' + q(a.get('grp') or '')]
        if a.get('short'): parts.append('short:' + q(a['short']))
        parts += ['title:' + q(a['title']), 'lead:' + q(a.get('lead') or '')]
        if a.get('img') or a['cat'] == '介質介紹': parts.append('img:' + q(a.get('img') or ''))
        if a.get('img_credit'): parts.append('imgCredit:' + q(a['img_credit']))
        body = a.get('body') or []
        out.append('{ ' + ', '.join(parts) + ', body:[')
        out.append(',\n'.join('  ' + q(l) for l in body))
        out.append(']},'); out.append('')
    out.append('];')
    return head.replace('\r\n', '\n').replace('\n', nl) + '\n'.join(out).replace('\n', nl) + nl


def apply_covers(data, plant_rows, indiv_rows):
    """data.json:植物封面(並鎖定)、個體封面。回傳套用的筆數"""
    n = 0
    by_key = {plant_key(p): p for p in data['plants']}
    by_id = {iv['id']: iv for p in data['plants'] for iv in p.get('individuals', []) if iv.get('id')}
    for r in plant_rows:
        p = by_key.get(r['key'])
        if p is None: continue
        p['cover'] = r.get('cover') or ''
        if r.get('cover_locked'): p['coverLocked'] = True
        else: p.pop('coverLocked', None)
        n += 1
    for r in indiv_rows:
        iv = by_id.get(r['id'])
        if iv is None: continue
        iv['cover'] = r.get('cover') or ''; n += 1
    return n


# ---------------------------------------------------------------- 主流程
def get_key():
    k, url = os.environ.get('SUPABASE_SERVICE_KEY'), os.environ.get('SUPABASE_URL')
    cfg = os.path.join(os.path.dirname(ROOT), 'plantdex', 'tools', 'sync_config.json')
    if (not k or not url) and os.path.exists(cfg):
        j = json.load(open(cfg, encoding='utf-8'))
        k = k or j.get('SERVICE_ROLE_KEY'); url = url or j.get('SUPABASE_URL')
    if not k or not url:
        print('找不到金鑰(SUPABASE_URL / SUPABASE_SERVICE_KEY)。'); sys.exit(1)
    return url.rstrip('/'), k


def main():
    import requests
    url, key = get_key()
    H = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
         'Content-Profile': 'swf', 'Accept-Profile': 'swf'}
    base = url + '/rest/v1/'

    def get(path):
        out, off = [], 0
        while True:
            r = requests.get(base + path + ('&' if '?' in path else '?') + 'limit=1000&offset=%d' % off, headers=H, timeout=60)
            if r.status_code == 400 and 'web_edited' in r.text:
                print('資料庫還沒有 web_edited 欄位(尚未執行 swf_002_web_edit.sql),沒有可匯出的內容。'); sys.exit(0)
            r.raise_for_status(); page = r.json(); out += page
            if len(page) < 1000: return out
            off += 1000

    import urllib.parse
    PK = {'plant_notes': ('plant_key',), 'sources': ('plant_key', 'label'), 'plants': ('key',),
          'individuals': ('id',), 'articles': ('id',)}
    manifest = {}

    def do_clear(table, rows, delete_hidden=False):
        for r in rows:
            flt = '&'.join('%s=eq.%s' % (k, urllib.parse.quote(str(r[k]), safe='')) for k in PK[table])
            if delete_hidden and r.get('_hidden'):
                requests.delete(base + table + '?' + flt + '&is_public=eq.false', headers=H, timeout=60)
            else:
                requests.patch(base + table + '?' + flt, headers=dict(H, Prefer='return=minimal'),
                               data=json.dumps({'web_edited': False}), timeout=60).raise_for_status()

    def clear(table, rows):
        """rows = 這次寫回檔案的列(只含主鍵);延後模式先記下來"""
        rows = [dict({k: r[k] for k in PK[table]}, **({'_hidden': True} if r.get('_hidden') else {})) for r in rows]
        if DRY: return
        if DEFER: manifest[table] = rows
        else: do_clear(table, rows, table == 'articles')

    if CLEAR:
        if not os.path.exists(CLEAR): print('沒有清單檔,略過。'); return
        m = json.load(open(CLEAR, encoding='utf-8'))
        for t, rows in m.items(): do_clear(t, rows, t == 'articles')
        print('已清除旗標:' + ('、'.join('%s %d' % (t, len(r)) for t, r in m.items()) or '無')); return

    done = []
    name_of = {p['key']: p['name'] for p in get('plants?select=key,name')}

    notes = get('plant_notes?select=plant_key,body&web_edited=eq.true')
    if notes:
        m = {name_of[n['plant_key']]: n['body'] for n in notes if n['plant_key'] in name_of}
        write('plant-notes.js', apply_notes(read('plant-notes.js'), m))
        clear('plant_notes', notes); done.append('植物介紹 %d 則' % len(m))

    se = get('sources?select=plant_key,label&web_edited=eq.true')
    if se:
        rows = get('sources?select=plant_key,label,source,mother')
        write('sources.js', build_sources(read('sources.js'), rows, name_of))
        clear('sources', se); done.append('來源·母株文字(整檔重產,%d 筆)' % len(rows))

    pl = get('plants?select=key,cover,cover_locked&web_edited=eq.true')
    iv = get('individuals?select=id,cover&web_edited=eq.true')
    if pl or iv:
        raw = read('data.json'); data = json.loads(raw)
        n = apply_covers(data, pl, iv)
        nl = '\r\n' if '\r\n' in raw else '\n'
        write('data.json', json.dumps(data, ensure_ascii=False, indent=2).replace('\n', nl))
        if pl: clear('plants', pl)
        if iv: clear('individuals', iv)
        done.append('封面 %d 筆' % n)

    ae = get('articles?select=id,is_public&web_edited=eq.true')
    if ae:
        # select=* :admin_only 欄位在執行 swf_003 之前不存在,用 * 兩種情況都讀得到
        arts = get('articles?select=*')
        allc = sorted(get('article_cats?select=*'), key=lambda c: c['sort'])
        cats = [c['name'] for c in allc if not c.get('admin_only')]
        # 私人文章、放在私人分類裡的文章:一律不寫進公開的 knowledge.js
        shown = [a for a in arts if a.get('is_public') and not a.get('admin_only') and a['cat'] in cats]
        if len(shown) < 5:
            print('知識庫文章數異常地少(%d),為安全起見不重產 knowledge.js。' % len(shown)); sys.exit(1)
        write('knowledge.js', build_knowledge(read('knowledge.js'), shown, cats))
        hidden = [a['id'] for a in ae if not a.get('is_public')]
        clear('articles', [dict(a, _hidden=not a.get('is_public')) for a in ae])
        done.append('知識庫(整檔重產,%d 篇%s)' % (len(shown), (',移除 %d 篇' % len(hidden)) if hidden else ''))

    if DEFER and not DRY:
        json.dump(manifest, open(DEFER, 'w', encoding='utf-8'), ensure_ascii=False)
    print('網頁修改寫回檔案:' + ('、'.join(done) if done else '沒有需要寫回的內容') + ('(預演,未寫檔)' if DRY and done else ''))
    gs = os.environ.get('GITHUB_STEP_SUMMARY')
    if gs and done:
        with open(gs, 'a', encoding='utf-8') as f: f.write('### 網頁修改寫回檔案\n\n' + '、'.join(done) + '\n\n')


if __name__ == '__main__':
    main()
