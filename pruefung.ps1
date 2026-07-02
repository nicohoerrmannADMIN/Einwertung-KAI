# Einwertung-KAI Gesundheits-Check
# Prueft Datenbank + Datei-Speicher. Start per Doppelklick auf pruefung.bat

$SB  = "https://jtlblbgxzbxjplamdpiu.supabase.co"
$KEY = "sb_publishable_XZaNy8RC0iATbuq2IVJ0Qg_9qNDsMBd"
$H   = @{ "apikey" = $KEY; "Authorization" = "Bearer $KEY" }
$fehler = 0

function Check($name, $block) {
    try {
        & $block | Out-Null
        Write-Host ("  OK      " + $name) -ForegroundColor Green
    } catch {
        Write-Host ("  FEHLER  " + $name) -ForegroundColor Red
        Write-Host ("          " + $_.Exception.Message) -ForegroundColor DarkGray
        $script:fehler++
    }
}

Write-Host ""
Write-Host "Einwertung-KAI Gesundheits-Check" -ForegroundColor Cyan
Write-Host "--------------------------------"

Check "Datenbank erreichbar (mandant_data)" {
    Invoke-RestMethod -Uri "$SB/rest/v1/mandant_data?select=mandant_id&limit=1" -Headers $H -TimeoutSec 15
}

$testPfad = "_diag/pruefung_$(Get-Date -Format yyyyMMdd_HHmmss).txt"

Check "Datei-Upload (Bucket mandant-files)" {
    Invoke-RestMethod -Method Post -Uri "$SB/storage/v1/object/mandant-files/$testPfad" `
        -Headers ($H + @{ "x-upsert" = "true" }) -ContentType "text/plain" -Body "check" -TimeoutSec 15
}

Check "Datei oeffentlich abrufbar" {
    Invoke-RestMethod -Uri "$SB/storage/v1/object/public/mandant-files/$testPfad" -TimeoutSec 15
}

Check "Datei loeschen" {
    Invoke-RestMethod -Method Delete -Uri "$SB/storage/v1/object/mandant-files/$testPfad" -Headers $H -TimeoutSec 15
}

Write-Host "--------------------------------"
if ($fehler -eq 0) {
    Write-Host "Alles in Ordnung - das Portal funktioniert." -ForegroundColor Green
} else {
    Write-Host "$fehler Problem(e) gefunden! Siehe WARTUNG.md fuer Loesungen." -ForegroundColor Red
    Write-Host "Dashboard: https://supabase.com/dashboard/project/jtlblbgxzbxjplamdpiu"
}
Write-Host ""
