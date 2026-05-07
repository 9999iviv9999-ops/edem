$ErrorActionPreference = "SilentlyContinue"
function DirSizeMB([string]$p) {
  if (-not (Test-Path $p)) { return 0 }
  $sum = (Get-ChildItem $p -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
  if ($null -eq $sum) { return 0 }
  return [math]::Round($sum / 1MB, 1)
}

$root = "c:\Users\administrator\edem-backend"
$rows = @(
  @{ n = "repo/node_modules"; p = "$root\node_modules" },
  @{ n = "web/node_modules"; p = "$root\web\node_modules" },
  @{ n = "edem-web/node_modules"; p = "$root\edem-web\node_modules" },
  @{ n = "nft-web/node_modules"; p = "$root\nft-web\node_modules" },
  @{ n = "contracts/node_modules"; p = "$root\contracts\node_modules" },
  @{ n = "mobile/node_modules"; p = "$root\mobile\node_modules" },
  @{ n = "web/dist"; p = "$root\web\dist" },
  @{ n = "edem-web/dist"; p = "$root\edem-web\dist" },
  @{ n = "nft-web/dist"; p = "$root\nft-web\dist" },
  @{ n = "repo/dist"; p = "$root\dist" },
  @{ n = "contracts/cache"; p = "$root\contracts\cache" },
  @{ n = "contracts/artifacts"; p = "$root\contracts\artifacts" }
)

Write-Host "=== edem-backend (MB) ===" -ForegroundColor Cyan
foreach ($r in $rows) {
  $mb = DirSizeMB $r.p
  if ($mb -gt 0) { Write-Host ("{0,-26} {1,10} MB  {2}" -f $r.n, $mb, $r.p) }
}

$cursor = "c:\Users\administrator\.cursor"
if (Test-Path $cursor) {
  Write-Host "`n=== .cursor (MB) ===" -ForegroundColor Cyan
  Get-ChildItem $cursor -Directory | ForEach-Object {
    $mb = DirSizeMB $_.FullName
    if ($mb -gt 50) { Write-Host ("{0,-26} {1,10} MB" -f $_.Name, $mb) }
  }
}

$npmCache = npm config get cache 2>$null
if (-not $npmCache -or $npmCache -eq "undefined") {
  $npmCache = Join-Path $env:LOCALAPPDATA "npm-cache"
}
if (Test-Path $npmCache) {
  $mb = DirSizeMB $npmCache
  Write-Host "`nnpm cache ($npmCache)" -ForegroundColor Cyan
  Write-Host ("{0:N1} MB" -f $mb)
}

$temp = $env:TEMP
if (Test-Path $temp) {
  $mb = DirSizeMB $temp
  Write-Host "`n`%TEMP% ($temp)" -ForegroundColor Cyan
  Write-Host ("{0:N1} MB" -f $mb)
}
