param(
  [string]$BackupDir = "",
  [int]$KeepDays = 14
)

$ErrorActionPreference = "Stop"
$root = Resolve-Path (Join-Path $PSScriptRoot "..")
if ([string]::IsNullOrWhiteSpace($BackupDir)) {
  $BackupDir = Join-Path $root "backups"
}
if (!(Test-Path $BackupDir)) {
  New-Item -ItemType Directory -Path $BackupDir | Out-Null
}

$dbContainer = if ($env:DB_CONTAINER) { $env:DB_CONTAINER } else { "edem-db" }
$pgUser = if ($env:PG_USER) { $env:PG_USER } else { "postgres" }
$pgDb = if ($env:PG_DB) { $env:PG_DB } else { "vprok" }

$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$outFile = Join-Path $BackupDir "vprok-$ts.sql.gz"

Write-Host "Creating DB backup: $outFile (container=$dbContainer)"

$tmpSql = Join-Path $env:TEMP "vprok-$ts.sql"
docker exec $dbContainer pg_dump -U $pgUser -d $pgDb | Out-File -FilePath $tmpSql -Encoding utf8

$gzip = [System.IO.Compression.GzipStream]
$fileOut = [System.IO.File]::Create($outFile)
$gzOut = New-Object System.IO.Compression.GZipStream($fileOut, [System.IO.Compression.CompressionMode]::Compress)
$inBytes = [System.IO.File]::ReadAllBytes($tmpSql)
$gzOut.Write($inBytes, 0, $inBytes.Length)
$gzOut.Close()
$fileOut.Close()
Remove-Item $tmpSql -Force

Write-Host "Backup complete: $outFile"

$threshold = (Get-Date).AddDays(-$KeepDays)
Get-ChildItem -Path $BackupDir -Filter "vprok-*.sql.gz" -File |
  Where-Object { $_.LastWriteTime -lt $threshold } |
  Remove-Item -Force

Write-Host "Done"
