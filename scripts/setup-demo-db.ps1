[CmdletBinding()]
param(
  [string]$EnvironmentFile = ".env.demo",
  [string]$ContainerName = "innov-postgres",
  [string]$PostgresUser = "postgres",
  [switch]$SkipCreate
)

$ErrorActionPreference = "Stop"
$DemoDatabaseName = "innovation_demo"
$DevelopmentDatabaseName = "innovation_platform"

function Initialize-DemoEnvironmentFile {
  param([string]$Path)

  if (Test-Path -LiteralPath $Path) { return }

  $template = Join-Path $PSScriptRoot "..\.env.demo.example"
  if (-not (Test-Path -LiteralPath $template)) {
    throw "Demo environment template '$template' was not found."
  }

  $content = Get-Content -Raw -LiteralPath $template -Encoding UTF8
  $generatedSecret = [guid]::NewGuid().ToString("N") + [guid]::NewGuid().ToString("N")
  $content = $content.Replace("replace-with-a-long-random-demo-secret", $generatedSecret)
  Set-Content -LiteralPath $Path -Value $content -Encoding UTF8
  Write-Host "Created local demo environment '$Path' from .env.demo.example."
}

function Read-EnvironmentFile {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Environment file '$Path' was not found."
  }

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
    $parts = $trimmed -split "=", 2
    if ($parts.Count -ne 2) { continue }
    $values[$parts[0].Trim()] = $parts[1].Trim().Trim('"').Trim("'")
  }
  return $values
}

Initialize-DemoEnvironmentFile -Path $EnvironmentFile
$environment = Read-EnvironmentFile -Path $EnvironmentFile
$databaseUrl = $environment["DATABASE_URL"]
if (-not $databaseUrl) {
  throw "DATABASE_URL is missing from '$EnvironmentFile'."
}

try {
  $uri = [Uri]$databaseUrl
} catch {
  throw "DATABASE_URL in '$EnvironmentFile' is not a valid PostgreSQL URL."
}

$targetDatabase = $uri.AbsolutePath.Trim("/")
if ($targetDatabase -eq $DevelopmentDatabaseName) {
  throw "Refusing to use the development database '$DevelopmentDatabaseName'."
}
if ($targetDatabase -ne $DemoDatabaseName) {
  throw "Demo setup only permits the database '$DemoDatabaseName'; received '$targetDatabase'."
}

if (-not $SkipCreate) {
  if (-not $ContainerName) {
    throw "ContainerName is required for local Docker setup. Run: docker ps --format '{{.Names}} {{.Image}} {{.Ports}}'"
  }

  $runningContainer = docker ps --filter "name=^/$ContainerName$" --format "{{.Names}}"
  if ($LASTEXITCODE -ne 0 -or $runningContainer -ne $ContainerName) {
    throw "Docker container '$ContainerName' is not running."
  }

  $exists = docker exec $ContainerName psql -U $PostgresUser -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DemoDatabaseName'"
  if ($LASTEXITCODE -ne 0) {
    throw "Could not inspect PostgreSQL databases in '$ContainerName'. Check PostgresUser."
  }

  if (($exists | Out-String).Trim() -ne "1") {
    Write-Host "Creating dedicated database '$DemoDatabaseName'..."
    docker exec $ContainerName createdb -U $PostgresUser $DemoDatabaseName
    if ($LASTEXITCODE -ne 0) { throw "Failed to create '$DemoDatabaseName'." }
  } else {
    Write-Host "Database '$DemoDatabaseName' already exists; no database was recreated."
  }
}

foreach ($entry in $environment.GetEnumerator()) {
  Set-Item -Path "Env:$($entry.Key)" -Value $entry.Value
}

Write-Host "Applying migrations to '$DemoDatabaseName'..."
& npm.cmd run db:deploy
if ($LASTEXITCODE -ne 0) { throw "Prisma migration deployment failed." }

Write-Host "Applying the idempotent stakeholder demo seed..."
& npm.cmd run db:seed
if ($LASTEXITCODE -ne 0) { throw "Demo seed failed." }

Write-Host "Demo database is ready. This process did not target '$DevelopmentDatabaseName'."
