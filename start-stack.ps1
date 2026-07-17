Write-Host "Starting Selbo stack..." -ForegroundColor Cyan

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\Projects\agoratest\ingestion; bun run dev" -WindowStyle Minimized
Write-Host "  [1/3] Ingestion started" -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd D:\Projects\agoratest\start; bun run dev" -WindowStyle Minimized
Write-Host "  [2/3] TanStack Start started (localhost:44100)" -ForegroundColor Green

Write-Host "  [3/3] Shadow trader starting (localhost:3001)..." -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop shadow trader. Close other windows manually." -ForegroundColor Yellow
Write-Host ""

bun scripts/shadow-trader.ts
