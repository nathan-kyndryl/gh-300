param(
    [int]$Port = 8000
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Resolve-Path (Join-Path $ScriptDir "..")
$Url = "http://127.0.0.1:$Port/docs/"

if (Get-Command py -ErrorAction SilentlyContinue) {
    $PythonCommand = "py"
    $PythonArgs = @("-3", "-m", "http.server", "$Port", "--bind", "127.0.0.1")
} elseif (Get-Command python -ErrorAction SilentlyContinue) {
    $PythonCommand = "python"
    $PythonArgs = @("-m", "http.server", "$Port", "--bind", "127.0.0.1")
} else {
    Write-Error "Python is required to start the local exam server."
    exit 1
}

Write-Host "Serving GH-300 practice exam at $Url"
Write-Host "Press Ctrl+C to stop the server."

try {
    Start-Process $Url | Out-Null
} catch {
    Write-Warning "Could not open the browser automatically. Open $Url manually."
}

Push-Location $RepoRoot
try {
    & $PythonCommand @PythonArgs
} finally {
    Pop-Location
}
