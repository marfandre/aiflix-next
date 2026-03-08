$apiUrl = "http://localhost:3000/api/videos/reextract-colors"
$body = @{
    all = $true
} | ConvertTo-Json

Write-Host "Starting color re-extraction for all videos..." -ForegroundColor Cyan
Write-Host "Target URL: $apiUrl" -ForegroundColor DarkGray

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Body $body -ContentType "application/json"
    
    if ($response.ok -eq $true) {
        Write-Host "`nSuccess!" -ForegroundColor Green
        Write-Host "Total videos processed: $($response.total)"
        Write-Host "Succeeded: $($response.succeeded)" -ForegroundColor Green
        Write-Host "Failed: $($response.failed)" -ForegroundColor Red
        
        Write-Host "`nDetailed Results:" -ForegroundColor Yellow
        $response.results | ForEach-Object {
            $status = if ($_.ok) { "OK ($($_.fullFrames) frames)" } else { "FAIL ($($_.error))" }
            Write-Host "Video ID: $($_.filmId) | Duration: $($_.duration)s | Status: $status"
        }
    } else {
        Write-Host "`nError during processing:" -ForegroundColor Red
        Write-Host $response.error
    }
} catch {
    Write-Host "`nFailed to connect to the API or an error occurred." -ForegroundColor Red
    Write-Host $_.Exception.Message
    
    if ($_.ErrorDetails) {
        Write-Host "Response Body: $($_.ErrorDetails.Message)" -ForegroundColor DarkGray
    }
}
