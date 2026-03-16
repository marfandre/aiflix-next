# recalc-aspect-ratio.ps1
# Пересчитывает aspect_ratio для всех картинок в images_meta
# Скачивает заголовки изображений из Supabase Storage, определяет размеры, обновляет БД

$supabaseUrl = "https://tavfxeskxlqnfdzgfmnq.supabase.co"
$serviceKey  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRhdmZ4ZXNreGxxbmZkemdmbW5xIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1OTg1NDg1OSwiZXhwIjoyMDc1NDMwODU5fQ.EJcuobYzGF4TEwpQ2-ybyStlhzL7xb_W0YVfRw18jHI"
$bucket      = "images"

$headers = @{
    "apikey"        = $serviceKey
    "Authorization" = "Bearer $serviceKey"
    "Content-Type"  = "application/json"
}

# Функция: определить aspect ratio из width/height
function Get-AspectRatio([int]$w, [int]$h) {
    if ($w -le 0 -or $h -le 0) { return $null }

    $ratio = $w / $h

    # Стандартные соотношения
    $known = @(
        @{ name = "1:1";   value = 1.0 },
        @{ name = "4:3";   value = 4/3 },
        @{ name = "3:4";   value = 3/4 },
        @{ name = "16:9";  value = 16/9 },
        @{ name = "9:16";  value = 9/16 },
        @{ name = "3:2";   value = 3/2 },
        @{ name = "2:3";   value = 2/3 },
        @{ name = "21:9";  value = 21/9 },
        @{ name = "9:21";  value = 9/21 },
        @{ name = "5:4";   value = 5/4 },
        @{ name = "4:5";   value = 4/5 }
    )

    $best = $null
    $bestDiff = 999

    foreach ($k in $known) {
        $diff = [Math]::Abs($ratio - $k.value)
        if ($diff -lt $bestDiff) {
            $bestDiff = $diff
            $best = $k.name
        }
    }

    # Если разница > 5%, вычислить через GCD
    if ($bestDiff -gt 0.05) {
        $a = $w; $b = $h
        while ($b -ne 0) { $t = $b; $b = $a % $b; $a = $t }
        $gcd = $a
        $rw = $w / $gcd; $rh = $h / $gcd
        # Упрощаем если числа слишком большие
        if ($rw -gt 50 -or $rh -gt 50) {
            return "$([Math]::Round($ratio, 2)):1"
        }
        return "${rw}:${rh}"
    }

    return $best
}

# Функция: получить размеры PNG/JPEG из первых байт
function Get-ImageDimensions([byte[]]$data) {
    if ($data.Length -lt 24) { return $null }

    # PNG: сигнатура 137 80 78 71
    if ($data[0] -eq 137 -and $data[1] -eq 80 -and $data[2] -eq 78 -and $data[3] -eq 71) {
        $w = ($data[16] -shl 24) -bor ($data[17] -shl 16) -bor ($data[18] -shl 8) -bor $data[19]
        $h = ($data[20] -shl 24) -bor ($data[21] -shl 16) -bor ($data[22] -shl 8) -bor $data[23]
        return @{ width = $w; height = $h }
    }

    # JPEG: сигнатура FF D8
    if ($data[0] -eq 0xFF -and $data[1] -eq 0xD8) {
        $i = 2
        while ($i -lt $data.Length - 8) {
            if ($data[$i] -ne 0xFF) { $i++; continue }
            $marker = $data[$i + 1]
            # SOF markers: C0-C3, C5-C7, C9-CB, CD-CF
            if (($marker -ge 0xC0 -and $marker -le 0xC3) -or
                ($marker -ge 0xC5 -and $marker -le 0xC7) -or
                ($marker -ge 0xC9 -and $marker -le 0xCB) -or
                ($marker -ge 0xCD -and $marker -le 0xCF)) {
                $h = ($data[$i + 5] -shl 8) -bor $data[$i + 6]
                $w = ($data[$i + 7] -shl 8) -bor $data[$i + 8]
                return @{ width = $w; height = $h }
            }
            # Пропустить этот блок
            $blockLen = ($data[$i + 2] -shl 8) -bor $data[$i + 3]
            $i += 2 + $blockLen
        }
    }

    # WebP: RIFF....WEBP
    if ($data.Length -ge 30 -and
        $data[0] -eq 0x52 -and $data[1] -eq 0x49 -and $data[2] -eq 0x46 -and $data[3] -eq 0x46 -and
        $data[8] -eq 0x57 -and $data[9] -eq 0x45 -and $data[10] -eq 0x42 -and $data[11] -eq 0x50) {
        # VP8 (lossy)
        if ($data[12] -eq 0x56 -and $data[13] -eq 0x50 -and $data[14] -eq 0x38 -and $data[15] -eq 0x20) {
            $w = (($data[26]) -bor ($data[27] -shl 8)) -band 0x3FFF
            $h = (($data[28]) -bor ($data[29] -shl 8)) -band 0x3FFF
            return @{ width = $w; height = $h }
        }
    }

    return $null
}

Write-Host "`n=== Пересчёт Aspect Ratio для images_meta ===" -ForegroundColor Cyan
Write-Host ""

# Получаем все записи из images_meta
$allImages = @()
$offset = 0
$pageSize = 1000

do {
    $url = "$supabaseUrl/rest/v1/images_meta?select=id,path,aspect_ratio&order=created_at.desc&offset=$offset&limit=$pageSize"
    $page = Invoke-RestMethod -Uri $url -Headers $headers -Method Get
    if ($page.Count -eq 0) { break }
    $allImages += $page
    $offset += $pageSize
    Write-Host "  Загружено записей: $($allImages.Count)..." -ForegroundColor DarkGray
} while ($page.Count -eq $pageSize)

Write-Host "Всего картинок: $($allImages.Count)" -ForegroundColor White

$updated = 0
$skipped = 0
$failed  = 0
$total   = $allImages.Count

foreach ($img in $allImages) {
    $idx = $allImages.IndexOf($img) + 1
    $id   = $img.id
    $path = $img.path

    Write-Host "[$idx/$total] $path " -NoNewline

    if (-not $path) {
        Write-Host "SKIP (no path)" -ForegroundColor Yellow
        $skipped++
        continue
    }

    try {
        # Скачиваем первые 64KB картинки (достаточно для заголовков)
        $imgUrl = "$supabaseUrl/storage/v1/object/public/$bucket/$path"

        $webClient = New-Object System.Net.WebClient
        # Скачиваем полностью (для JPEG нужно больше данных для SOF маркера)
        $bytes = $webClient.DownloadData($imgUrl)

        $dims = Get-ImageDimensions $bytes

        if (-not $dims) {
            # Fallback: загрузить через System.Drawing
            try {
                Add-Type -AssemblyName System.Drawing
                $stream = New-Object System.IO.MemoryStream(,$bytes)
                $bitmap = [System.Drawing.Image]::FromStream($stream)
                $dims = @{ width = $bitmap.Width; height = $bitmap.Height }
                $bitmap.Dispose()
                $stream.Dispose()
            } catch {
                Write-Host "FAIL (can't read dimensions)" -ForegroundColor Red
                $failed++
                continue
            }
        }

        $ar = Get-AspectRatio $dims.width $dims.height

        if (-not $ar) {
            Write-Host "FAIL (bad dimensions: $($dims.width)x$($dims.height))" -ForegroundColor Red
            $failed++
            continue
        }

        # Обновляем в БД
        $updateUrl = "$supabaseUrl/rest/v1/images_meta?id=eq.$id"
        $body = @{ aspect_ratio = $ar } | ConvertTo-Json
        $updateHeaders = @{
            "apikey"        = $serviceKey
            "Authorization" = "Bearer $serviceKey"
            "Content-Type"  = "application/json"
            "Prefer"        = "return=minimal"
        }
        Invoke-RestMethod -Uri $updateUrl -Headers $updateHeaders -Method Patch -Body $body | Out-Null

        $oldAr = if ($img.aspect_ratio) { $img.aspect_ratio } else { "null" }
        Write-Host "$($dims.width)x$($dims.height) -> $ar (was: $oldAr)" -ForegroundColor Green
        $updated++

    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $failed++
    }
}

Write-Host "`n=== Готово ===" -ForegroundColor Cyan
Write-Host "Обновлено: $updated" -ForegroundColor Green
Write-Host "Пропущено: $skipped" -ForegroundColor Yellow
Write-Host "Ошибок:    $failed" -ForegroundColor Red
