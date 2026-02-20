# Add firewall rules for Box Party Game server (port 3000 and Node.js).
# Run as Administrator: .\scripts\add-firewall-rules.ps1

$port = 3000
$ruleName = "Box Party Game ($port)"

Write-Host "Adding firewall rules for port $port and Node.js..." -ForegroundColor Cyan

Remove-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Node 3000" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Node.js Server" -ErrorAction SilentlyContinue
Remove-NetFirewallRule -DisplayName "Node.js Box Party" -ErrorAction SilentlyContinue

New-NetFirewallRule -DisplayName $ruleName -Direction Inbound -Protocol TCP -LocalPort $port -Action Allow -Profile Any | Out-Null
Write-Host "  [OK] Port $port allowed (all profiles)" -ForegroundColor Green

$nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if ($nodePath) {
  New-NetFirewallRule -DisplayName "Node.js Box Party" -Direction Inbound -Program $nodePath -Action Allow -Profile Any | Out-Null
  Write-Host "  [OK] Node.js: $nodePath" -ForegroundColor Green
} else {
  Write-Host "  [--] Node.js not found in PATH, skip program rule" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done. Start server: npm run dev:server" -ForegroundColor Cyan
Write-Host "On PC open in browser the URL from 'S telefona' line, then try from phone." -ForegroundColor Cyan
