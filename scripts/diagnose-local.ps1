$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$backendEnv = Join-Path $root "backend\.env"
$requiredBackendEnv = @(
  "DATABASE_URL",
  "JWT_ACCESS_SECRET",
  "PRIVATE_FILES_DIR",
  "FRONTEND_ORIGIN"
)

function Write-Check {
  param(
    [string]$Name,
    [bool]$Ok,
    [string]$Detail = ""
  )

  $status = if ($Ok) { "OK" } else { "WARN" }
  $line = "[$status] $Name"
  if ($Detail) { $line = "$line - $Detail" }
  Write-Host $line
}

function Read-DotEnv {
  param([string]$Path)

  $values = @{}
  if (-not (Test-Path $Path)) { return $values }

  Get-Content $Path | ForEach-Object {
    if ($_ -match "^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$") {
      $key = $Matches[1]
      $value = $Matches[2].Trim().Trim('"').Trim("'")
      $values[$key] = $value
    }
  }

  return $values
}

function Test-Command {
  param([string]$Name)
  $command = Get-Command $Name -ErrorAction SilentlyContinue
  Write-Check $Name ([bool]$command) $(if ($command) { $command.Source } else { "introuvable dans PATH" })
}

function Test-Port {
  param([int]$Port, [string]$Label)
  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  Write-Check $Label ([bool]$listener) $(if ($listener) { "port $Port ecoute, PID $($listener.OwningProcess)" } else { "port $Port libre/non ecoute" })
}

Write-Host "Diagnostic local Windows - Personal Platform"
Write-Host "Racine: $root"
Write-Host ""

Write-Host "Outils"
Test-Command "node"
Test-Command "npm"
Test-Command "git"
Test-Command "pg_dump"
Test-Command "pg_restore"
Write-Host ""

Write-Host "Fichiers"
Write-Check "backend\.env" (Test-Path $backendEnv) $backendEnv
Write-Check "backend\node_modules" (Test-Path (Join-Path $root "backend\node_modules"))
Write-Check "frontend\node_modules" (Test-Path (Join-Path $root "frontend\node_modules"))
Write-Host ""

$envValues = Read-DotEnv $backendEnv
Write-Host "Variables backend"
foreach ($key in $requiredBackendEnv) {
  Write-Check $key $envValues.ContainsKey($key)
}
Write-Check "SMTP configure" ($envValues.ContainsKey("SMTP_HOST") -and $envValues["SMTP_HOST"]) $(if ($envValues.ContainsKey("SMTP_HOST")) { "SMTP_HOST present" } else { "optionnel" })
Write-Check "SIGNUP_INVITE_CODE configure" ($envValues.ContainsKey("SIGNUP_INVITE_CODE") -and $envValues["SIGNUP_INVITE_CODE"]) "optionnel"
Write-Host ""

Write-Host "Ports locaux"
Test-Port 3000 "Backend Nest"
Test-Port 5173 "Frontend Vite"
Test-Port 5432 "PostgreSQL local"
Write-Host ""

Write-Host "Database Prisma"
if ($envValues.ContainsKey("DATABASE_URL") -and $envValues["DATABASE_URL"]) {
  Push-Location (Join-Path $root "backend")
  try {
    npm run prisma:generate | Out-Null
    Write-Check "Prisma generate" $true

    $script = @"
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
prisma.`$queryRawUnsafe('SELECT 1').then(() => {
  console.log('DB_OK');
}).finally(() => prisma.`$disconnect());
"@
    $env:DATABASE_URL = $envValues["DATABASE_URL"]
    $dbResult = $script | node -
    $dbOk = [bool]($dbResult -match "DB_OK")
    Write-Check "Connexion PostgreSQL" $dbOk
  } catch {
    Write-Check "Connexion PostgreSQL" $false $_.Exception.Message
  } finally {
    Pop-Location
  }
} else {
  Write-Check "Connexion PostgreSQL" $false "DATABASE_URL manquant"
}
Write-Host ""

Write-Host "Scripts npm"
Push-Location $root
try {
  npm run | Out-Null
  Write-Check "package racine" $true
} catch {
  Write-Check "package racine" $false $_.Exception.Message
} finally {
  Pop-Location
}

Write-Host ""
Write-Host "Diagnostic termine."
