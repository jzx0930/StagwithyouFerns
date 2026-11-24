/* ===== 動態後端設定(Supabase;與 PlantDex 同一個專案、資料在獨立的 swf schema)=====
   enabled:false = 網站照舊讀 data.json 與各 JS 內容檔(靜態模式)
   enabled:true  = 先從資料庫讀;讀不到(逾時/錯誤/沒資料)自動退回靜態檔,網站不會空白
   anonKey 是「公開金鑰」,放在前端是正常設計,安全靠資料庫的 RLS 權限。
   千萬不要把 service_role 金鑰放進這個檔或任何會推上 GitHub 的檔案。
   改完把 index.html 的 config/supabase.js?v= 數字 +1。
*/
window.SWF_BACKEND = {
  enabled: true,
  url: 'https://ouyfbhpkkpotsvnxtfrx.supabase.co',
  anonKey: 'sb_publishable_hwQaCPZbA_utfrfvsqE0cQ_GpowCaxH',
  schema: 'swf',
  timeoutMs: 6000,
  repo: 'jzx0930/StagwithyouFerns'   // 後台「立即同步」按鈕要開的 GitHub repo
};
