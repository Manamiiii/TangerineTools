param([switch]$NoOpenBrowser, [scriptblock]$OnProgress)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$siteUrl = 'http://localhost:5188'
if (-not $NoOpenBrowser -and -not $OnProgress) {
    . (Join-Path $PSScriptRoot 'startup_window.ps1')
    $opened = Show-TangerineStartup -AppName 'TangerineTools' -ServiceLauncher $PSCommandPath `
        -StartupParameters @{NoOpenBrowser=$true} -IconFile (Join-Path $projectRoot 'public\icons\tangerine-tools.ico') `
        -OnReady { Start-Process $siteUrl }
    if (-not $opened) { exit 1 }
    exit 0
}
function Report-StartupProgress([string]$Stage) {
    if ($OnProgress) { & $OnProgress $Stage | Out-Null }
    else { Write-Host "Startup: $Stage" }
}
Report-StartupProgress 'checking-files'
$logDirectory = Join-Path $projectRoot 'artifacts\launcher'
New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null
$mutex = New-Object Threading.Mutex($false, 'Local\TangerineTools-5188')
$held = $false
function Test-AppReady {
    try {
        $response = Invoke-WebRequest -Uri $siteUrl -UseBasicParsing -TimeoutSec 2
        return $response.StatusCode -eq 200 -and $response.Content -match '<title>TangerineTools '
    } catch { return $false }
}
try {
    Report-StartupProgress 'waiting-lock'
    try { $held = $mutex.WaitOne(30000) } catch [Threading.AbandonedMutexException] { $held = $true }
    if (-not $held) { throw 'Another TangerineTools launch is still in progress. Please try again shortly.' }
    Report-StartupProgress 'checking-service'
    if (-not (Test-AppReady)) {
        $listener = Get-NetTCPConnection -LocalPort 5188 -State Listen -ErrorAction SilentlyContinue
        if ($listener) { throw 'Port 5188 is occupied by another service. Close that service before launching TangerineTools.' }
        $nodePath = (Get-Command node -ErrorAction Stop).Source
        $vitePath = Join-Path $projectRoot 'node_modules\vite\bin\vite.js'
        if (-not (Test-Path -LiteralPath $vitePath)) { throw 'Dependencies are missing. Run npm ci in the TangerineTools project first.' }
        Report-StartupProgress 'starting-review'
        $process = Start-Process -FilePath $nodePath -ArgumentList @(('"{0}"' -f $vitePath), '--port', '5188', '--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logDirectory 'server.output.log') -RedirectStandardError (Join-Path $logDirectory 'server.error.log') -PassThru
        Report-StartupProgress 'waiting-review'
        $ready = $false
        for ($attempt = 0; $attempt -lt 40; $attempt++) {
            if (Test-AppReady) { $ready = $true; break }
            $process.Refresh()
            if ($process.HasExited) { break }
            Start-Sleep -Milliseconds 500
        }
        if (-not $ready) { throw "TangerineTools could not start. See logs in $logDirectory" }
    }
    Report-StartupProgress 'ready'
    if (-not $NoOpenBrowser) { Start-Process $siteUrl }
} catch {
    $_ | Out-String | Set-Content -LiteralPath (Join-Path $logDirectory 'launcher.error.log')
    if (-not $NoOpenBrowser) {
        $notice = New-Object -ComObject WScript.Shell
        $null = $notice.Popup($_.Exception.Message, 0, 'TangerineTools', 16)
    }
    throw
} finally {
    if ($held) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}
