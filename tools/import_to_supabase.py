# -*- coding: utf-8 -*-
"""
StagwithyouFerns -> Supabase 一次性匯入(冪等,可重複執行;以主鍵 upsert)
======================================================================
把 data.json + plant-notes.js / knowledge.js / sources.js / about.js 全部寫進
Supabase 的 swf schema(與 PlantDex 同一個專案、不同 schema)。

先決條件:
  1. Supabase SQL Editor 已執行 Docs/migrations/swf_001_schema.sql
  2. Settings -> API -> Exposed schemas 已加入 swf
  3. service_role 金鑰:環境變數 SUPABASE_SERVICE_KEY,
     或沿用 ..\\plantdex\\tools\\sync_config.json 的 SERVICE_ROLE_KEY(自動讀)

用法:
  python tools/import_to_supabase.py            實際匯入
  python tools/import_to_supabase.py --dry-run  只組資料、檢查、印出筆數,不連線
  python tools/import_to_supabase.py --dump X   把要寫入的資料存成 JSON(測試用)
  python tools/import_to_supabase.py --no-mirror  只新增/覆蓋,不刪除資料庫多出來的列
  python tools/import_to_supabase.py --force      略過「一次刪超過 20%」的安全中止

預設會「對齊」:資料庫裡有、但 data.json / 內容檔已經沒有的列會被刪除
(過渡期以 repo 的檔案為準)。互動資料(收藏/留言/瀏覽數/詢價)與同步紀錄不會動。
GitHub Actions(.github/workflows/import.yml)在每次 push 後自動執行本腳本。
"""
import hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DRY = '--dry-run' in sys.argv or '-n' in sys.argv
DUMP = sys.argv[sys.argv.index('--dump') + 1] if '--dump' in sys.argv else None
MIRROR = '--no-mirror' not in sys.argv
FORCE = '--force' in sys.argv
DIARY_KEY, DIARY_IID = 'diary', 'DIARY-000'


def plant_key(p):
    """穩定代碼:Drive 資料夾 ID 的雜湊(改名不變、不洩漏資料夾 ID)。"""
    if p.get('category') == '日記': return DIARY_KEY
    return hashlib.sha1((p.get('fid') or p['name']).encode('utf-8')).hexdigest()[:10]


def load_content():
    """JS 內容檔 -> dict。優先用 node 即時轉;沒有 node 就用 Docs/import/content.json。"""
    try:
        out = subprocess.run(['node', os.path.join(HERE, 'export_content.js')], cwd=ROOT,
                             capture_output=True, check=True).stdout
        return json.loads(out.decode('utf-8'))
    except Exception as e:
        p = os.path.join(ROOT, 'Docs', 'import', 'content.json')
        if os.path.exists(p):
            print('(找不到 node,改用 Docs/import/content.json;若之後改過內容檔請先裝 Node.js 再跑)')
            return json.load(open(p, encoding='utf-8'))
        print('無法讀取內容檔:', e); sys.exit(1)


def build():
    d = json.load(open(os.path.join(ROOT, 'data.json'), encoding='utf-8'))
    c = load_content()
    T = {k: [] for k in ['categories', 'plants', 'plant_folders', 'individuals', 'photos', 'id_state',
                         'plant_notes', 'sources', 'article_cats', 'articles', 'about']}
    warn = []

    for i, cat in enumerate(d.get('categories') or []):
        T['categories'].append({'name': cat['name'], 'cover': cat.get('cover') or '',
                                'model': cat.get('model'), 'fx': cat.get('fx'), 'sort': i})

    name2pid, seen_photo = {}, {}
    for pi, p in enumerate(d['plants']):
        diary = p.get('category') == '日記'
        pid = '' if diary else (p.get('pid') or '')
        key = plant_key(p)
        if not diary and not pid: warn.append('植物沒有 pid:' + p['name'])
        name2pid[p['name']] = key
        T['plants'].append({'key': key, 'pid': pid, 'name': p['name'], 'latin': p.get('latin') or '',
                            'category': p['category'], 'date': p.get('date') or '', 'note': p.get('note') or '',
                            'cover': p.get('cover') or '', 'cover_locked': bool(p.get('coverLocked')),
                            'is_public': True, 'sort': pi})
        if p.get('fid'):
            T['plant_folders'].append({'plant_key': key, 'fid': p['fid']})
        for ii, iv in enumerate(p.get('individuals') or []):
            iid = DIARY_IID if diary else iv.get('id')
            if not iid:
                warn.append('個體沒有 id,略過:%s %s' % (p['name'], iv.get('label'))); continue
            T['individuals'].append({'id': iid, 'plant_key': key, 'label': iv.get('label') or '',
                                     'name': iv.get('name') or '', 'cover': iv.get('cover') or '',
                                     'mother_info': iv.get('motherInfo'), 'is_public': True, 'sort': ii})
            for kind, items in (('timeline', iv.get('timeline') or []),
                                ('mother', [{'photo': m} for m in (iv.get('mother') or [])])):
                for k, t in enumerate(items):
                    ph = t.get('photo')
                    if not ph: continue
                    if ph in seen_photo:
                        warn.append('照片重複出現,只保留第一次:%s(%s / %s)' % (ph, seen_photo[ph], iid)); continue
                    seen_photo[ph] = iid
                    T['photos'].append({'drive_id': ph, 'individual_id': iid, 'kind': kind,
                                        'date': t.get('date') or '', 'tag': t.get('tag') or '',
                                        'note': t.get('note') or '', 'sort': k, 'trashed': False})

    for k, v in (d.get('_ids') or {}).items():
        T['id_state'].append({'key': k, 'value': v})

    for name, body in (c.get('notes') or {}).items():
        if name in name2pid: T['plant_notes'].append({'plant_key': name2pid[name], 'body': body})
        else: warn.append('介紹找不到對應植物,略過:' + name)

    for name, labels in (c.get('sources') or {}).items():
        if name not in name2pid:
            warn.append('來源·母株找不到對應植物,略過:' + name); continue
        for label, v in (labels or {}).items():
            if (v.get('source') or '') or (v.get('mother') or ''):
                T['sources'].append({'plant_key': name2pid[name], 'label': label or '',
                                     'source': v.get('source') or '', 'mother': v.get('mother') or ''})

    for i, n in enumerate(c.get('cats') or []):
        T['article_cats'].append({'name': n, 'sort': i})
    for i, a in enumerate(c.get('articles') or []):
        T['articles'].append({'id': a['id'], 'cat': a['cat'], 'grp': a.get('group') or '', 'title': a['title'],
                              'lead': a.get('lead') or '', 'body': a.get('body') or [], 'img': a.get('img') or '',
                              'img_credit': a.get('imgCredit') or '', 'short': a.get('short') or '',
                              'is_public': True, 'sort': i})
    T['about'].append({'id': 1, 'lines': c.get('about') or [], 'font': c.get('aboutFont') or ''})

    # 完整性檢查
    pids = {r['key'] for r in T['plants']}; iids = {r['id'] for r in T['individuals']}
    assert len(pids) == len(T['plants']), '植物代碼重複'
    assert len(iids) == len(T['individuals']), '個體 id 重複'
    assert all(r['plant_key'] in pids for r in T['individuals'])
    assert all(r['individual_id'] in iids for r in T['photos'])
    cats = {r['name'] for r in T['article_cats']}
    assert all(a['cat'] in cats for a in T['articles']), '文章分類不在 SF_KNOWLEDGE_CATS'
    return T, warn


# 對齊時要檢查的表與主鍵(由子到父刪,避免外鍵擋住);複合主鍵用 tuple
MIRROR_PK = [('photos', ('drive_id',)), ('sources', ('plant_key', 'label')), ('plant_notes', ('plant_key',)),
             ('plant_folders', ('plant_key',)), ('individuals', ('id',)), ('plants', ('key',)),
             ('articles', ('id',)), ('article_cats', ('name',)), ('categories', ('name',)), ('id_state', ('key',))]


def stale_keys(existing, rows, pk):
    """資料庫現有主鍵 - 這次要寫入的主鍵 = 該刪的。"""
    keep = {tuple(r[k] for k in pk) for r in rows}
    return [e for e in existing if tuple(e[k] for k in pk) not in keep]


# 可以在網頁上編輯的表(主鍵):web_edited = true 的列由網頁為準,匯入時跳過、對齊時不刪
FLAGGED = {'plants': ('key',), 'individuals': ('id',), 'plant_notes': ('plant_key',),
           'sources': ('plant_key', 'label'), 'articles': ('id',), 'about': ('id',)}
# 私人內容(admin_only = true):只存在資料庫、不在公開檔案裡 → 匯入不覆蓋、對齊時不刪
PRIVATE = {'articles': ('id',), 'article_cats': ('name',)}
# 這兩張表只有封面欄位歸網頁管;其他欄位(名稱、學名、分類…)仍然跟著檔案走
WEB_FIELDS = {'plants': ('cover', 'cover_locked'), 'individuals': ('cover',)}


def split_web_edited(rows, pk, edited):
    """-> (照常匯入的列, 網頁改過要保留的列)"""
    keep = [r for r in rows if tuple(r[k] for k in pk) in edited]
    return [r for r in rows if tuple(r[k] for k in pk) not in edited], keep


ORDER = ['categories', 'plants', 'plant_folders', 'individuals', 'photos', 'id_state',
         'plant_notes', 'sources', 'article_cats', 'articles', 'about']


def get_key():
    k = os.environ.get('SUPABASE_SERVICE_KEY')
    url = os.environ.get('SUPABASE_URL')
    cfg = os.path.join(os.path.dirname(ROOT), 'plantdex', 'tools', 'sync_config.json')
    if (not k or not url) and os.path.exists(cfg):
        j = json.load(open(cfg, encoding='utf-8'))
        k = k or j.get('SERVICE_ROLE_KEY'); url = url or j.get('SUPABASE_URL')
    if not k or not url:
        print('找不到金鑰:請設定環境變數 SUPABASE_URL / SUPABASE_SERVICE_KEY,'
              '或確認 ..\\plantdex\\tools\\sync_config.json 存在。'); sys.exit(1)
    return url.rstrip('/'), k


def main():
    T, warn = build()
    print('準備匯入:' + '、'.join('%s %d' % (k, len(T[k])) for k in ORDER))
    for w in warn: print('  注意:', w)
    if DUMP:
        json.dump(T, open(DUMP, 'w', encoding='utf-8'), ensure_ascii=False); print('已存', DUMP)
    if DRY or DUMP:
        print('(預演,未連線)'); return
    try:
        import requests
    except ImportError:
        print('缺套件,請先執行: pip install requests'); sys.exit(1)
    url, key = get_key()
    H = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
         'Content-Profile': 'swf', 'Accept-Profile': 'swf'}
    import urllib.parse
    edited = {}
    for t, pk in FLAGGED.items():           # 網頁改過、還沒寫回檔案的列
        r = requests.get(url + '/rest/v1/%s?select=%s&web_edited=eq.true&limit=10000' % (t, ','.join(pk)), headers=H, timeout=60)
        edited[t] = {tuple(x[k] for k in pk) for x in r.json()} if r.status_code == 200 else set()
    private = {}
    for t, pk in PRIVATE.items():           # 私人列(還沒執行 swf_003 時沒有這個欄位 → 當作沒有)
        r = requests.get(url + '/rest/v1/%s?select=%s&admin_only=eq.true&limit=10000' % (t, ','.join(pk)), headers=H, timeout=60)
        private[t] = {tuple(x[k] for k in pk) for x in r.json()} if r.status_code == 200 else set()
        if private[t]: print('  %-14s 私人內容 %d 筆(只在資料庫,不匯入、不刪除)' % (t, len(private[t])))
    for t in ORDER:
        rows = T[t]
        if private.get(t):
            rows, _ = split_web_edited(rows, PRIVATE[t], private[t])
        if edited.get(t):
            rows, held = split_web_edited(rows, FLAGGED[t], edited[t])
            for h in held:                  # 只更新不歸網頁管的欄位
                if t not in WEB_FIELDS: continue
                body = {k: v for k, v in h.items() if k not in WEB_FIELDS[t] and k not in FLAGGED[t]}
                q = '&'.join('%s=eq.%s' % (k, urllib.parse.quote(str(h[k]), safe='')) for k in FLAGGED[t])
                requests.patch(url + '/rest/v1/%s?%s' % (t, q), headers=dict(H, Prefer='return=minimal'),
                               data=json.dumps(body, ensure_ascii=False).encode('utf-8'), timeout=60)
            print('  %-14s 保留網頁上的修改 %d 筆(等每日匯出寫回檔案)' % (t, len(edited[t])))
        for i in range(0, len(rows), 500):
            r = requests.post(url + '/rest/v1/' + t, headers=dict(H, Prefer='resolution=merge-duplicates,return=minimal'),
                              data=json.dumps(rows[i:i + 500], ensure_ascii=False).encode('utf-8'), timeout=60)
            if r.status_code >= 300:
                print('[失敗] %s:%s %s' % (t, r.status_code, r.text[:400]))
                if r.status_code in (404, 406) or 'schema' in r.text:
                    print('  -> 多半是還沒執行 swf_001_schema.sql,或 Exposed schemas 沒加 swf。')
                sys.exit(1)
        r = requests.get(url + '/rest/v1/' + t + '?select=*&limit=1', headers=dict(H, Prefer='count=exact'), timeout=60)
        total = (r.headers.get('content-range') or '/?').split('/')[-1]
        print('  %-14s 寫入 %4d 筆,資料庫現有 %s 筆' % (t, len(rows), total))
    if MIRROR:
        for t, pk in MIRROR_PK:
            existing, off = [], 0
            while True:
                r = requests.get(url + '/rest/v1/%s?select=%s&order=%s&limit=1000&offset=%d'
                                 % (t, ','.join(pk), ','.join(pk), off), headers=H, timeout=60)
                r.raise_for_status(); page = r.json(); existing += page
                if len(page) < 1000: break
                off += 1000
            keep = edited.get(t, set()) | private.get(t, set())
            gone = [g for g in stale_keys(existing, T[t], pk) if tuple(g[k] for k in pk) not in keep]
            if not gone: continue
            if len(gone) > max(5, len(existing) * 0.2) and not FORCE:
                print('[中止] %s 要刪 %d / %d 筆,超過 20%%;確認無誤請加 --force 重跑。' % (t, len(gone), len(existing)))
                sys.exit(1)
            for g in gone:
                q = '&'.join('%s=eq.%s' % (k, urllib.parse.quote(str(g[k]), safe='')) for k in pk)
                d = requests.delete(url + '/rest/v1/%s?%s' % (t, q), headers=H, timeout=60)
                if d.status_code >= 300:
                    print('[失敗] 刪除 %s %s:%s %s' % (t, g, d.status_code, d.text[:200])); sys.exit(1)
            print('  %-14s 對齊:刪除 %d 筆(資料庫有、檔案已沒有)' % (t, len(gone)))
    print('匯入完成。')


if __name__ == '__main__':
    main()
