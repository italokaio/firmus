# Sobe o MinIO local para desenvolvimento.
#
# Importante: o binário e os dados do MinIO ficam FORA da pasta do projeto
# (que está dentro do OneDrive). O OneDrive intercepta/trava arquivos abertos
# continuamente por processos como o MinIO (e quase travou o Postgres também),
# corrompendo o storage. Por isso usamos $env:LOCALAPPDATA, que não é sincronizado.
#
# Uso: powershell -ExecutionPolicy Bypass -File infra/start-minio.ps1

$ToolsDir = "$env:LOCALAPPDATA\leilao-erp-tools"
$MinioExe = "$ToolsDir\minio.exe"
$McExe = "$ToolsDir\mc.exe"
$DataDir = "$ToolsDir\minio-data"

if (-not (Test-Path $MinioExe)) {
    Write-Host "Baixando MinIO server..."
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
    Invoke-WebRequest -Uri "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile $MinioExe -UserAgent "Mozilla/5.0"
}
if (-not (Test-Path $McExe)) {
    Write-Host "Baixando MinIO client (mc)..."
    Invoke-WebRequest -Uri "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile $McExe -UserAgent "Mozilla/5.0"
}
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

if (Get-Process minio -ErrorAction SilentlyContinue) {
    Write-Host "MinIO já está em execução."
} else {
    $env:MINIO_ROOT_USER = "leilao"
    $env:MINIO_ROOT_PASSWORD = "leilao12345"
    $env:MINIO_API_CORS_ALLOW_ORIGIN = "http://localhost:3002"
    Start-Process -FilePath $MinioExe `
        -ArgumentList @("server", $DataDir, "--address", ":9000", "--console-address", ":9001") `
        -WindowStyle Hidden `
        -RedirectStandardOutput "$ToolsDir\minio-out.log" `
        -RedirectStandardError "$ToolsDir\minio-err.log"
    Start-Sleep -Seconds 3
    Write-Host "MinIO iniciado (API :9000, console :9001)."
}

& $McExe alias set local http://127.0.0.1:9000 leilao leilao12345 2>&1 | Out-Null
& $McExe mb --ignore-existing local/leilao-erp-dev
Write-Host "Bucket 'leilao-erp-dev' pronto."
