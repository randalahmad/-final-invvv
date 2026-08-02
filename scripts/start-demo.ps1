[CmdletBinding()]
param(
  [ValidateSet("dev", "start")]
  [string]$Mode = "dev",
  [string]$EnvironmentFile = ".env.demo",
  [string]$ContainerName = "innov-postgres",
  [string]$PostgresUser = "postgres",
  [switch]$SkipCreate
)

$ErrorActionPreference = "Stop"

& (Join-Path $PSScriptRoot "setup-demo-db.ps1") `
  -EnvironmentFile $EnvironmentFile `
  -ContainerName $ContainerName `
  -PostgresUser $PostgresUser `
  -SkipCreate:$SkipCreate

$databaseUrl = (Get-Item Env:DATABASE_URL).Value
$databaseName = ([Uri]$databaseUrl).AbsolutePath.Trim("/")
if ($databaseName -ne "innovation_demo") {
  throw "Refusing to start demo mode with database '$databaseName'."
}

Write-Host "Verified demo target: database '$databaseName' from '$EnvironmentFile'."
Write-Host "Starting Next.js in '$Mode' mode. Process variables override values discovered in .env."

if ($Mode -eq "start") {
  Write-Host "Building the production application with the verified demo environment..."
  & npm.cmd run build
  if ($LASTEXITCODE -ne 0) {
    throw "Production build failed with code $LASTEXITCODE."
  }
}

$nextMode = if ($Mode -eq "dev") { "dev" } else { "start" }
& node (Join-Path $PSScriptRoot "..\node_modules\next\dist\bin\next") $nextMode
if ($LASTEXITCODE -ne 0) {
  throw "Next.js '$nextMode' exited with code $LASTEXITCODE."
}
