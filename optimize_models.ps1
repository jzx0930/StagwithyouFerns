# 從每個模型的「未壓縮」子夾壓縮 → 上層 <屬名>.glb(網站載入的位置)
# Draco 幾何 + WebP 貼圖。由 Claude 產生。
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
$models = 'Platycerium','Pachypodium','Cactaceae','Agave','Caudex','Euphorbiaceae','Foliage','Succulent'
foreach ($g in $models) {
  $src = "models\$g\未壓縮\$g.glb"
  $dst = "models\$g\$g.glb"
  $tmp = "models\$g\$g.opt.glb"
  if (-not (Test-Path -LiteralPath $src)) { Write-Host "找不到 $src,跳過"; continue }
  Write-Host "--- $g ---"
  $before = (Get-Item -LiteralPath $src).Length
  & gltf-transform optimize $src $tmp --compress draco --texture-compress webp
  if (Test-Path -LiteralPath $tmp) {
    Move-Item -LiteralPath $tmp -Destination $dst -Force
    $after = (Get-Item -LiteralPath $dst).Length
    Write-Host ("  OK {0}: {1:N1}MB -> {2:N1}MB" -f $g, ($before/1MB), ($after/1MB))
  } else {
    Write-Host "  FAILED $g (原檔未動)"
  }
}
Write-Host ''
Write-Host '完成。到 GitHub Desktop commit + push(只會推上層壓縮後的 .glb;未壓縮夾已被 gitignore 不上傳)。'
Read-Host '按 Enter 關閉'
