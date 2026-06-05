$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$envFile = Join-Path $root "backend\.env"
$backupDir = Join-Path $root "backups"

if (-not (Test-Path $envFile)) {
  throw "backend\.env introuvable. Impossible de lire DATABASE_URL."
}

$databaseUrl = $null
Get-Content $envFile | ForEach-Object {
  if ($_ -match "^\s*DATABASE_URL\s*=\s*(.+)\s*$") {
    $databaseUrl = $Matches[1].Trim().Trim('"').Trim("'")
  }
}

if (-not $databaseUrl) {
  throw "DATABASE_URL introuvable dans backend\.env."
}

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) {
  throw "pg_dump introuvable. Installe PostgreSQL client tools ou ajoute pg_dump au PATH."
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$output = Join-Path $backupDir "postgres-$timestamp.dump"

pg_dump $databaseUrl --format=custom --file=$output

Write-Host "Sauvegarde PostgreSQL creee: $output"
