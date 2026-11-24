# -*- coding: utf-8 -*-
"""
StagwithyouFerns 每日自動同步:Google Drive(公開資料夾)-> data.json
=====================================================================
把原本要請 Claude「開始更新」的流程寫成程式(規則同 SKILL 附錄 A):
  * 以 data.json 的 fid(Drive 資料夾 ID)對應植物,不靠名稱
  * 以「照片 ID 集合」比對找新照片(不看日期)
  * #NN[-暱稱] 夾 = 個體;「母株」夾 = 母株照 + .txt(來源/母株文字)
  * 日記-diary/YYYY.MM.DD/ = 日記(.txt = 當日文字)
  * 介質/<名稱>/ = 知識庫「介質介紹」的照片
  * 新個體、新植物依規則自動發 ID(發出後不改、不重用)
規則明確的自動套用;有疑問的(改名、照片不見、散落照片、命名不合規…)不動資料,
只列進「收件匣」(寫到執行摘要,並在有金鑰時寫進 Supabase swf.sync_inbox)。

用法:
  python tools/sync_swf.py            讀 Drive、更新 data.json(與 knowledge.js 的介質圖)
  python tools/sync_swf.py --dry-run  只報告,不寫檔
  python tools/sync_swf.py --force    略過「一次變動過多」的安全中止
環境變數:GOOGLE_API_KEY(必要)、SUPABASE_URL / SUPABASE_SERVICE_KEY(選用,寫收件匣與紀錄)
"""
import json, os, re, sys, time
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DRY = '--dry-run' in sys.argv or '-n' in sys.argv
FORCE = '--force' in sys.argv

DRIVE_ROOT = '1B_lSq655LqMXjyR0iCDWXkZPw15udEqH'       # 植物照片
CAT_GENUS = {'鹿角蕨': 'Platycerium', '棒槌': 'Pachypodium', '龍舌蘭': 'Agave'}   # 單屬分類(無屬名夾)
MIXED = {'仙人掌', '大戟', '塊根', '多肉', '觀葉'}                                  # 有屬名夾的分類
IGNORE_ROOT = {'素材', '文案', '知識庫素材', 'StagwithyourFerns_Seasonal_TimeSet'}
SPECIES_18 = ['alcicorne', 'andinum', 'bifurcatum', 'coronarium', 'elephantotis', 'ellisii', 'grande', 'hillii',
              'holttumii', 'quadridichotomum', 'stemaria', 'superbum', 'veitchii', 'wallichii', 'wandae',
              'madagascariense', 'ridleyi', 'willinckii']
FOLDER = 'application/vnd.google-apps.folder'
TPE = timezone(timedelta(hours=8))
CJK = re.compile(r'[一-鿿]')


# ---------------------------------------------------------------- Drive 讀取層
class Drive:
    """用 API 金鑰讀「知道連結的任何人可檢視」的資料夾。"""
    def __init__(self, key):
        import requests
        self.s = requests.Session(); self.key = key; self.calls = 0
        self.basic = False; self.denied = {}

    def _get(self, url, params):
        for i in range(5):
            r = self.s.get(url, params=dict(params, key=self.key), timeout=60); self.calls += 1
            if r.status_code in (429, 500, 502, 503) or (r.status_code == 403 and 'ateLimit' in r.text):
                time.sleep(2 ** i); continue
            if r.status_code >= 300:
                raise RuntimeError('Drive API %s:%s' % (r.status_code, r.text[:300]))
            return r
        raise RuntimeError('Drive API 重試多次仍失敗')

    FULL = 'nextPageToken,files(id,name,mimeType,parents,createdTime,size,trashed,imageMediaMetadata(time))'
    BASIC = 'nextPageToken,files(id,name,mimeType,parents,createdTime,size,trashed)'

    def _list_one(self, parent):
        """列一個資料夾的子項。用 API 金鑰時不能把多個資料夾用 or 串在一起查(會 403),所以一夾一查。"""
        out, tok, basic = [], None, self.basic
        while True:
            p = {'q': "'%s' in parents" % parent, 'pageSize': 1000, 'fields': self.BASIC if basic else self.FULL}
            if tok: p['pageToken'] = tok
            try:
                j = self._get('https://www.googleapis.com/drive/v3/files', p).json()
            except RuntimeError as e:
                if ' 403' in str(e)[:16] and not basic and not out:
                    basic = True; continue             # 這一夾改用精簡欄位再試一次
                raise
            if basic and not self.basic: self.basic = True   # 精簡欄位才讀得到 → 之後都用精簡欄位
            out += [f for f in j.get('files', []) if not f.get('trashed')]
            tok = j.get('nextPageToken')
            if not tok: break
        return sorted(out, key=lambda f: f['name'])

    def children(self, parent_ids):
        """查多個資料夾的子項 -> {parent_id: [item…]};讀不到的資料夾記在 self.denied。"""
        from concurrent.futures import ThreadPoolExecutor
        def one(pid):
            try: return pid, self._list_one(pid), None
            except RuntimeError as e: return pid, [], str(e)
        out = {}
        with ThreadPoolExecutor(max_workers=6) as ex:
            for pid, items, err in ex.map(one, list(parent_ids)):
                out[pid] = items
                if err: self.denied[pid] = err
        return out

    def read_text(self, fid):
        r = self._get('https://www.googleapis.com/drive/v3/files/' + fid, {'alt': 'media'})
        return r.content.decode('utf-8-sig', 'replace').replace('\r\n', '\n').strip()


def walk(drive, root):
    """整棵樹走一遍(逐層查)-> tree[folder_id] = [item…](含子資料夾與檔案)"""
    tree, level, names = {}, [root], {root: '植物照片'}
    while level:
        res = drive.children(level)
        tree.update(res)
        level = []
        for items in res.values():
            for f in items:
                if f['mimeType'] == FOLDER and f['name'].strip() not in IGNORE_ROOT:
                    level.append(f['id']); names[f['id']] = f['name']
    drive.denied = {names.get(k, k): v for k, v in drive.denied.items()}
    return tree


# ---------------------------------------------------------------- 小工具
def is_img(f): return (f.get('mimeType') or '').startswith('image/')
def is_txt(f): return f.get('mimeType') == 'text/plain' or f['name'].lower().endswith('.txt')
def labnum(l):
    m = re.search(r'\d+', l or ''); return int(m.group()) if m else -1


def photo_date(f):
    """檔名 -> EXIF -> 上傳時間(台灣時區),回 YYYY.MM.DD"""
    n = f['name']
    for pat in (r'(20\d\d)年(\d{1,2})月(\d{1,2})日', r'(20\d\d)[:\-._ ](\d{1,2})[:\-._ ](\d{1,2})(?!\d)',
                r'(?<!\d)(20\d\d)(\d\d)(\d\d)(?!\d)'):
        m = re.search(pat, n)
        if m:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if 1 <= mo <= 12 and 1 <= d <= 31: return '%04d.%02d.%02d' % (y, mo, d)
    t = (f.get('imageMediaMetadata') or {}).get('time') or ''
    m = re.match(r'(20\d\d)[:\-](\d\d)[:\-](\d\d)', t)
    if m: return '%s.%s.%s' % m.groups()
    try:
        dt = datetime.fromisoformat(f['createdTime'].replace('Z', '+00:00')).astimezone(TPE)
        return dt.strftime('%Y.%m.%d')
    except Exception:
        return ''


def fern_species(latin):
    l = latin or ''
    if re.search(r'[×x]\s', l, re.I) or 'Hybrid' in l or '×' in l: return ''
    for w in re.split(r'[^A-Za-z]+', re.sub(r'^Platycerium', '', l, flags=re.I)):
        if w.lower() in SPECIES_18: return w.lower()
    return ''


def parse_mother_txt(text):
    src, mot, cur, plain = [], [], None, []
    for ln in text.split('\n'):
        m = re.match(r'^\s*(來源|母株)\s*[:：]\s*(.*)$', ln)
        if m:
            cur = 's' if m.group(1) == '來源' else 'm'
            (src if cur == 's' else mot).append(m.group(2).strip()); continue
        (src if cur == 's' else mot if cur == 'm' else plain).append(ln.rstrip())
    if not src and not mot: return {'source': '', 'mother': '\n'.join(plain).strip()}
    return {'source': '\n'.join(src).strip(), 'mother': '\n'.join(mot).strip()}


def parse_plant_title(title, cat, genus):
    """新植物夾名 -> (中文名, 全屬名學名);不合規回 (None, 原因)"""
    t = title.strip()
    if '-' in t and CJK.search(t.split('-', 1)[0]):
        name, sci = [x.strip() for x in t.split('-', 1)]
    elif CJK.search(t) and not re.search(r'[A-Za-z]{3,}', t):
        name, sci = t, ''
    else:
        return None, '夾名不是「中文-學名」格式'
    full = genus or CAT_GENUS.get(cat) or ''
    m = re.match(r'^([A-Z])\.\s*(.*)$', sci)
    if m:
        if not full or full[0] != m.group(1): return None, '學名用了屬縮寫,但找不到對應的屬名夾'
        sci = full + ' ' + m.group(2)
    return name, sci


# ---------------------------------------------------------------- 主流程
class Sync:
    def __init__(self, data, tree, read_text, knowledge_src=None):
        self.d, self.tree, self.read_text = data, tree, read_text
        self.kb = knowledge_src
        self.inbox, self.log, self.n = [], [], {'photos': 0, 'mother': 0, 'diary': 0, 'individuals': 0, 'plants': 0,
                                                'notes': 0, 'media': 0}
        self.ids = data['_ids']
        self.by_fid = {p['fid']: p for p in data['plants'] if p.get('fid')}
        self.known = {}
        for p in data['plants']:
            for iv in p.get('individuals', []):
                for t in iv.get('timeline', []): self.known[t['photo']] = (p, iv, 'timeline')
                for m in iv.get('mother') or []: self.known[m] = (p, iv, 'mother')
        self.seen = {}        # photo id -> (plant, individual or None) 這次在 Drive 看到的位置

    def kids(self, fid): return self.tree.get(fid, [])
    def flag(self, kind, key, title, **payload):
        self.inbox.append({'kind': kind, 'title': title, 'payload': dict(payload, key=kind + ':' + key)})

    # ---- ID 發號(規則同 SKILL §10b)
    def used_ids(self):
        return {iv['id'] for p in self.d['plants'] for iv in p.get('individuals', []) if iv.get('id')} | \
               set(self.ids.get('retired', {}))

    def new_individual_id(self, pid):
        slots = set(self.ids.get('speciesSlots', {}).values())
        used = self.used_ids()
        if pid in slots:
            n = self.ids['speciesNext'].get(pid, 0) + 1
            while '%s-%03d' % (pid, n) in used: n += 1
            self.ids['speciesNext'][pid] = n
        else:
            n = max([int(i.rsplit('-', 1)[1]) for i in used if i.startswith(pid + '-') and i.count('-') == 2] or [0]) + 1
        return '%s-%03d' % (pid, n)

    def new_pid(self, cat, latin):
        code = self.ids['codes'].get(cat)
        if not code: return None
        if cat == '鹿角蕨':
            sp = fern_species(latin)
            if sp and sp in self.ids.get('speciesSlots', {}): return self.ids['speciesSlots'][sp]
        used = {p.get('pid') for p in self.d['plants']} | {k for k in self.ids.get('retired', {}) if k.count('-') == 1}
        n = self.ids['counters'].get(code, 0) + 1
        while '%s-%03d' % (code, n) in used: n += 1
        self.ids['counters'][code] = n
        return '%s-%03d' % (code, n)

    # ---- 照片
    def dedupe(self, imgs):
        """同夾、同大小、一分鐘內上傳的重複:留檔名是日期的那張(另一張若已在網站上就不動)。"""
        def ts(f):
            try: return datetime.fromisoformat(f['createdTime'].replace('Z', '+00:00')).timestamp()
            except Exception: return None
        drop = set()
        for i, a in enumerate(imgs):
            for b in imgs[i + 1:]:
                if a['id'] in drop or b['id'] in drop: continue
                if not a.get('size') or a.get('size') != b.get('size'): continue
                ta, tb = ts(a), ts(b)
                if ta is None or tb is None or abs(ta - tb) > 60: continue
                ia, ib = bool(re.match(r'^IMG_', a['name'], re.I)), bool(re.match(r'^IMG_', b['name'], re.I))
                loser = a if (ia and not ib) else b if (ib and not ia) else (a if ta > tb else b)
                if loser['id'] in self.known: continue
                drop.add(loser['id']); self.seen[loser['id']] = (None, None)
                self.flag('duplicate', loser['id'], '重複上傳,已略過一張:' + loser['name'], photo=loser['id'])
        return [f for f in imgs if f['id'] not in drop]

    def add_timeline(self, p, iv, imgs):
        for f in self.dedupe(imgs):
            self.seen[f['id']] = (p, iv)
            if f['id'] in self.known: continue
            iv['timeline'].append({'date': photo_date(f), 'tag': iv.get('label') or '', 'note': '', 'photo': f['id']})
            self.known[f['id']] = (p, iv, 'timeline'); self.n['photos'] += 1
            self.log.append('+ 照片 %s %s %s' % (p['name'], iv.get('label') or '', photo_date(f)))

    def add_mother(self, p, iv, folder_id):
        items = self.kids(folder_id)
        for f in [x for x in items if is_img(x)]:
            self.seen[f['id']] = (p, iv)
            if f['id'] in self.known: continue
            iv.setdefault('mother', []).append(f['id'])
            self.known[f['id']] = (p, iv, 'mother'); self.n['mother'] += 1
            self.log.append('+ 母株照 %s %s' % (p['name'], iv.get('label') or ''))
        txts = [x for x in items if is_txt(x)]
        if txts:
            info = parse_mother_txt(self.read_text(txts[0]['id']))
            if info != iv.get('motherInfo'):
                iv['motherInfo'] = info; self.n['notes'] += 1
                self.log.append('~ 來源·母株文字 %s %s' % (p['name'], iv.get('label') or ''))

    def default_indiv(self, p, create):
        ivs = p['individuals']
        for iv in ivs:
            if not (iv.get('label') or ''): return iv
        if len(ivs) == 1: return ivs[0]
        if not ivs and create:
            iv = {'label': '', 'name': '', 'cover': '', 'timeline': [], 'id': self.new_individual_id(p['pid'])}
            ivs.append(iv); self.n['individuals'] += 1
            self.log.append('+ 個體 %s %s' % (p['name'], iv['id'])); return iv
        return None

    def do_plant(self, p, folder):
        items = self.kids(folder['id'])
        loose = [f for f in items if is_img(f)]
        if loose:
            iv = self.default_indiv(p, True)
            if iv is not None: self.add_timeline(p, iv, loose)
            else:
                for f in loose: self.seen[f['id']] = (p, None)
                new = [f for f in loose if f['id'] not in self.known]
                if new: self.flag('loose', p['fid'], '%s:有 %d 張照片直接放在植物夾,但這株有多個編號個體,不知道屬於誰' % (p['name'], len(new)),
                                  plant=p['name'], photos=[f['id'] for f in new])
        for sub in [f for f in items if f['mimeType'] == FOLDER]:
            if sub['name'].strip() == '母株':
                iv = self.default_indiv(p, True)
                if iv is not None: self.add_mother(p, iv, sub['id'])
                continue
            m = re.match(r'^#\s*(\d+)[-\s]*(.*)$', sub['name'].strip())
            if not m:
                if self.kids(sub['id']):
                    self.flag('folder', sub['id'], '%s:不認得的子資料夾「%s」(不是 #編號 也不是 母株)' % (p['name'], sub['name']), plant=p['name'])
                continue
            num, nick = int(m.group(1)), m.group(2).strip()
            iv = next((x for x in p['individuals'] if labnum(x.get('label')) == num), None)
            sub_items = self.kids(sub['id'])
            if iv is None:
                if not any(is_img(f) for f in sub_items) and not any(
                        is_img(f) for s in sub_items if s['mimeType'] == FOLDER for f in self.kids(s['id'])):
                    continue                               # 空夾:等有照片再發號
                iv = {'label': '#%02d' % num, 'name': nick, 'cover': '', 'timeline': [], 'id': self.new_individual_id(p['pid'])}
                p['individuals'].append(iv); self.n['individuals'] += 1
                self.log.append('+ 個體 %s %s %s' % (p['name'], iv['label'], iv['id']))
            elif nick and not iv.get('name'):
                iv['name'] = nick
            self.add_timeline(p, iv, [f for f in sub_items if is_img(f)])
            for s in [f for f in sub_items if f['mimeType'] == FOLDER and f['name'].strip() == '母株']:
                self.add_mother(p, iv, s['id'])

    def do_category(self, cat, folder):
        for f in [x for x in self.kids(folder['id']) if x['mimeType'] == FOLDER]:
            if f['id'] in self.by_fid:
                self.plant_folder(cat, '', f)
            elif cat in MIXED and re.match(r'^[A-Z][A-Za-z]+$', f['name'].strip()):
                for g in [x for x in self.kids(f['id']) if x['mimeType'] == FOLDER]:
                    self.plant_folder(cat, f['name'].strip(), g)
            else:
                self.plant_folder(cat, '', f)

    def plant_folder(self, cat, genus, f):
        p = self.by_fid.get(f['id'])
        if p is None:
            name, latin = parse_plant_title(f['name'], cat, genus)
            if name is None:
                self.flag('naming', f['id'], '新資料夾「%s」(%s)沒有建立植物:%s' % (f['name'], cat, latin), folder=f['name']); return
            if any(x['name'] == name for x in self.d['plants']):
                self.flag('naming', f['id'], '新資料夾「%s」的中文名「%s」已經有另一株在用,沒有建立' % (f['name'], name), folder=f['name']); return
            pid = self.new_pid(cat, latin)
            if not pid:
                self.flag('naming', f['id'], '新資料夾「%s」在不認得的分類「%s」' % (f['name'], cat), folder=f['name']); return
            p = {'name': name, 'latin': latin, 'category': cat, 'date': '', 'note': '', 'cover': '',
                 'individuals': [], 'pid': pid, 'fid': f['id']}
            self.d['plants'].append(p); self.by_fid[f['id']] = p; self.n['plants'] += 1
            self.log.append('+ 植物 %s %s %s' % (name, pid, latin))
            self.flag('new_plant', f['id'], '新植物「%s」(%s %s)已建立,還沒有植物介紹' % (name, pid, latin), plant=name)
        else:
            if p['category'] != cat:
                self.flag('moved_cat', p['fid'], '%s:資料夾現在在「%s」分類,網站仍是「%s」' % (p['name'], cat, p['category']), plant=p['name'])
            t = f['name'].strip()
            zh = t.split('-', 1)[0].strip() if ('-' in t and CJK.search(t.split('-', 1)[0])) else None
            if zh and zh != p['name']:
                self.flag('rename', p['fid'], '%s:資料夾中文名改成「%s」,網站尚未跟著改' % (p['name'], zh), plant=p['name'], to=zh)
        self.do_plant(p, f)

    def do_diary(self, folder):
        dp = next((p for p in self.d['plants'] if p['category'] == '日記'), None)
        if dp is None: return
        iv = dp['individuals'][0]
        items = self.kids(folder['id'])
        loose = [f for f in items if is_img(f) and f['id'] not in self.known]
        if loose: self.flag('diary_loose', folder['id'], '日記:有 %d 張照片沒放進日期資料夾' % len(loose), photos=[f['id'] for f in loose])
        for f in [x for x in items if is_img(x)]: self.seen[f['id']] = (dp, iv)
        for sub in [f for f in items if f['mimeType'] == FOLDER]:
            date = sub['name'].strip()
            if not re.match(r'^20\d\d\.\d\d\.\d\d$', date): continue
            sub_items = self.kids(sub['id'])
            txts = [x for x in sub_items if is_txt(x)]
            note = self.read_text(txts[0]['id']) if txts else None
            old = next((t['note'] for t in iv['timeline'] if t['date'] == date and t.get('note')), '')
            for f in [x for x in sub_items if is_img(x)]:
                self.seen[f['id']] = (dp, iv)
                if f['id'] in self.known: continue
                iv['timeline'].append({'date': date, 'tag': '', 'note': note if note is not None else old, 'photo': f['id']})
                self.known[f['id']] = (dp, iv, 'timeline'); self.n['diary'] += 1
                self.log.append('+ 日記 %s' % date)
            if note is not None and note != old:
                for t in iv['timeline']:
                    if t['date'] == date: t['note'] = note
                self.n['notes'] += 1; self.log.append('~ 日記文字 %s' % date)

    def do_media(self, folder):
        """介質/<名稱>/ 最新一張照片 -> knowledge.js 該篇(short 相同)的 img"""
        if self.kb is None: return
        for sub in [f for f in self.kids(folder['id']) if f['mimeType'] == FOLDER]:
            imgs = sorted([f for f in self.kids(sub['id']) if is_img(f)], key=lambda f: f.get('createdTime') or '')
            if not imgs: continue
            m = re.search(r"short:'%s', title:[^\n]*?( body:\[)" % re.escape(sub['name'].strip()), self.kb)
            if not m:
                self.flag('media', sub['id'], '介質夾「%s」找不到對應的介質文章' % sub['name']); continue
            a = self.kb.rfind('{ id:', 0, m.start()); seg = self.kb[a:m.start(1)]
            cur = re.search(r"img:'([^']*)'", seg)
            if cur and cur.group(1) in {f['id'] for f in imgs}: continue
            new = re.sub(r"img:'[^']*'(, imgCredit:'[^']*')?", "img:'%s'" % imgs[-1]['id'], seg, count=1)
            if new != seg:
                self.kb = self.kb[:a] + new + self.kb[m.start(1):]; self.n['media'] += 1
                self.log.append('~ 介質照片 %s' % sub['name'])

    def run(self):
        cats = {re.sub(r'[A-Za-z]+$', '', c['name']) for c in self.d.get('categories', [])}
        for f in [x for x in self.kids(DRIVE_ROOT) if x['mimeType'] == FOLDER]:
            title = f['name'].strip(); zh = title.split('-', 1)[0].strip()
            if title in IGNORE_ROOT: continue
            if zh == '日記': self.do_diary(f)
            elif title == '介質': self.do_media(f)
            elif zh in cats: self.do_category(zh, f)
            else: self.flag('folder', f['id'], '植物照片 根目錄有不認得的資料夾「%s」' % title)
        # 網站在用、但 Drive 已找不到 / 被搬走的照片(只回報,不自動刪)
        gone, moved = {}, {}
        for ph, (p, iv, kind) in self.known.items():
            if re.match(r'^https?:', ph): continue
            if ph not in self.seen: gone.setdefault(p['name'], []).append(ph)
            elif self.seen[ph][1] is not None and self.seen[ph][1] is not iv:
                moved.setdefault(p['name'], []).append(ph)
        for name, lst in gone.items():
            self.flag('missing', name, '%s:%d 張網站在用的照片在 Drive 找不到(可能被刪除或移走)' % (name, len(lst)), plant=name, photos=lst)
        for name, lst in moved.items():
            self.flag('moved', name, '%s:%d 張照片在 Drive 被搬到別的個體夾,網站尚未跟著改' % (name, len(lst)), plant=name, photos=lst)
        # 排序 / 封面 / 入手日
        for p in self.d['plants']:
            for iv in p.get('individuals', []):
                iv['timeline'].sort(key=lambda t: t.get('date', ''))
                if not iv.get('cover'):
                    if iv['timeline']: iv['cover'] = iv['timeline'][0]['photo']
                    elif iv.get('mother'): iv['cover'] = iv['mother'][0]
            if not p.get('cover') and not p.get('coverLocked'):
                p['cover'] = next((iv['cover'] for iv in p.get('individuals', []) if iv.get('cover')), '')
            if not p.get('date'):
                ds = [t['date'] for iv in p.get('individuals', []) for t in iv['timeline'] if t.get('date')]
                p['date'] = min(ds) if ds else ''
        self.validate()
        return self

    def validate(self):
        ids = [iv['id'] for p in self.d['plants'] for iv in p.get('individuals', []) if iv.get('id')]
        assert len(ids) == len(set(ids)), '個體 ID 重複'
        assert not (set(ids) & set(self.ids.get('retired', {}))), '用到了退役號'
        ph = [t['photo'] for p in self.d['plants'] for iv in p.get('individuals', []) for t in iv['timeline']]
        assert len(ph) == len(set(ph)), '時間軸照片重複'
        fids = [p['fid'] for p in self.d['plants'] if p.get('fid')]
        assert len(fids) == len(set(fids)), 'fid 重複'
        json.loads(json.dumps(self.d, ensure_ascii=False))

    def changed(self): return sum(self.n.values()) > 0
    def summary(self):
        zh = {'photos': '時間軸照片', 'mother': '母株照', 'diary': '日記照片', 'individuals': '新個體', 'plants': '新植物',
              'notes': '文字更新', 'media': '介質照片'}
        s = '、'.join('%s %d' % (zh[k], v) for k, v in self.n.items() if v) or '沒有變動'
        return s + ';待確認 %d 項' % len(self.inbox)


# ---------------------------------------------------------------- Supabase 紀錄(選用)
def push_supabase(sync, status, err=''):
    url, key = os.environ.get('SUPABASE_URL'), os.environ.get('SUPABASE_SERVICE_KEY')
    if not url or not key or DRY: return
    import requests
    H = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json',
         'Content-Profile': 'swf', 'Accept-Profile': 'swf', 'Prefer': 'return=minimal'}
    base = url.rstrip('/') + '/rest/v1/'
    try:
        requests.post(base + 'sync_runs', headers=H, timeout=30, data=json.dumps({
            'finished_at': datetime.now(timezone.utc).isoformat(), 'status': status,
            'summary': dict(sync.n, inbox=len(sync.inbox)) if sync else None,
            'log': ('\n'.join(sync.log)[:20000] if sync else '') + err}, ensure_ascii=False).encode('utf-8'))
        if not sync: return
        r = requests.get(base + 'sync_inbox?select=payload&status=eq.open&limit=1000', headers=H, timeout=30)
        have = {(x.get('payload') or {}).get('key') for x in (r.json() if r.ok else [])}
        new = [i for i in sync.inbox if i['payload']['key'] not in have]
        if new:
            requests.post(base + 'sync_inbox', headers=H, timeout=30, data=json.dumps(new, ensure_ascii=False).encode('utf-8'))
    except Exception as e:
        print('(寫入 Supabase 紀錄失敗,不影響同步:%s)' % e)


def main():
    key = os.environ.get('GOOGLE_API_KEY')
    if not key: print('缺少環境變數 GOOGLE_API_KEY'); sys.exit(1)
    dj, kj = os.path.join(ROOT, 'data.json'), os.path.join(ROOT, 'knowledge.js')
    raw = open(dj, encoding='utf-8').read()
    data = json.loads(raw)
    kb = open(kj, encoding='utf-8').read()
    drive = Drive(key)
    tree = walk(drive, DRIVE_ROOT)
    files = sum(len(v) for v in tree.values())
    print('Drive:%d 個資料夾、%d 個項目(API 呼叫 %d 次)' % (len(tree), files, drive.calls))
    if drive.denied:
        print('讀不到的資料夾(%d 個):' % len(drive.denied))
        for k, v in list(drive.denied.items())[:20]: print('  - %s:%s' % (k, v.replace('\n', ' ')[:160]))
        if '植物照片' in drive.denied:
            print('連根資料夾都讀不到:請確認 Drive 的「植物照片」分享設定是「知道連結的任何人」可檢視,且 API 金鑰允許 Google Drive API。'); sys.exit(1)
    if len(tree) < 50 or files < 500:
        print('讀到的內容異常地少(可能是金鑰或分享權限問題),為安全起見不做任何變更。'); sys.exit(1)
    try:
        s = Sync(data, tree, drive.read_text, kb).run()
    except Exception as e:
        push_supabase(None, 'error', str(e)); raise
    print('結果:' + s.summary())
    for l in s.log[:200]: print('  ' + l)
    for i in s.inbox: print('  ? ' + i['title'])
    for k in drive.denied: s.inbox.append({'kind': 'denied', 'title': '資料夾「%s」讀不到(分享權限不是公開?),裡面的照片這次沒有檢查' % k, 'payload': {'key': 'denied:' + k}})
    if (s.n['photos'] + s.n['diary'] > 300 or s.n['plants'] > 15 or s.n['individuals'] > 40) and not FORCE:
        print('一次變動太多,為安全起見不寫入;確認無誤請用 --force 重跑。'); push_supabase(s, 'error', '\n變動過多,未寫入'); sys.exit(1)
    gs = os.environ.get('GITHUB_STEP_SUMMARY')
    if gs:
        with open(gs, 'a', encoding='utf-8') as f:
            f.write('### Drive 同步\n\n%s\n\n' % s.summary())
            if s.log: f.write('<details><summary>變動明細</summary>\n\n' + '\n'.join('- ' + l for l in s.log[:300]) + '\n\n</details>\n\n')
            if s.inbox: f.write('**待確認**\n\n' + '\n'.join('- ' + i['title'] for i in s.inbox) + '\n')
    if DRY: print('(預演,未寫檔)'); return
    if s.changed():
        new = json.dumps(s.d, ensure_ascii=False, indent=2)
        if new != raw.rstrip('\n'):
            open(dj, 'w', encoding='utf-8').write(new)
        if s.kb != kb: open(kj, 'w', encoding='utf-8').write(s.kb)
    push_supabase(s, 'ok')


if __name__ == '__main__':
    main()
