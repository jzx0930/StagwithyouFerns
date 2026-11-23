// 把 JS 內容檔轉成 JSON(供匯入 Supabase 用):node tools/export_content.js > out.json
global.window = {};
require('../plant-notes.js'); require('../knowledge.js'); require('../sources.js'); require('../about.js');
process.stdout.write(JSON.stringify({
  notes: window.PLANT_NOTES, articles: window.SF_KNOWLEDGE, cats: window.SF_KNOWLEDGE_CATS,
  sources: window.PLANT_SOURCES, about: window.SF_ABOUT, aboutFont: window.SF_ABOUT_FONT || ''
}));
