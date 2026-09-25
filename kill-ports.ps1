# Script: kill-ports.ps1 - Kill tất cả process trên các port của tool rồi restart server
Write-Host "=== Dang kill cac process tren port 5000, 5173, 5174 ===" -ForegroundColor Yellow

$targetPorts = @(5000, 5173, 5174)

foreach ($port in $targetPorts) {
    $lines = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    foreach ($line in $lines) {
        $parts = ($line -replace '\s+', ' ').Trim().Split(' ')
        $pid = $parts[-1]
        if ($pid -match '^\d+$' -and [int]$pid -gt 0) {
            Write-Host "  Kill PID $pid tren port $port..." -ForegroundColor Red
            taskkill /F /PID $pid 2>$null | Out-Null
        }
    }
}

Start-Sleep -Seconds 1

# Verify
Write-Host ""
Write-Host "=== Kiem tra ports sau khi kill ===" -ForegroundColor Cyan
$stillInUse = $false
foreach ($port in $targetPorts) {
    $check = netstat -ano | Select-String ":$port\s" | Select-String "LISTENING"
    if ($check) {
        Write-Host "  Port $port van con bi chiem!" -ForegroundColor Red
        $stillInUse = $true
    } else {
        Write-Host "  Port $port: FREE ✓" -ForegroundColor Green
    }
}

if (-not $stillInUse) {
    Write-Host ""
    Write-Host "=== Tat ca ports da duoc giai phong. Hay chay: npm run dev ===" -ForegroundColor Green
}
