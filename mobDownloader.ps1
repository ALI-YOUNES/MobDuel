# ============================================================
# MOB DUEL - AUTOMATIC MOB IMAGE DOWNLOADER
# ============================================================

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------
# CONFIGURATION
# ------------------------------------------------------------

$jsonPath  = ".\mob_duel_cards.json"
$outputDir = ".\public\cards"

$apiUrl = "https://minecraft.wiki/api.php"

# Your 4 allowed non-vanilla entities
$nonVanilla = @(
    "Herobrine",
    "Null",
    "Entity 303",
    "Wither Storm"
)

# ------------------------------------------------------------
# CREATE OUTPUT DIRECTORY
# ------------------------------------------------------------

New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

# ------------------------------------------------------------
# CHECK JSON
# ------------------------------------------------------------

if (-not (Test-Path $jsonPath)) {
    Write-Host ""
    Write-Host "ERROR: JSON file not found:"
    Write-Host $jsonPath
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "============================================"
Write-Host "       MOB DUEL IMAGE DOWNLOADER"
Write-Host "============================================"
Write-Host ""

Write-Host "Loading JSON..."

try {
    $data = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
}
catch {
    Write-Host "ERROR: Could not read JSON."
    Write-Host $_.Exception.Message
    exit 1
}

# ------------------------------------------------------------
# GET MOB CARDS
# ------------------------------------------------------------

$mobs = @()

if ($null -ne $data.mobCards) {

    $mobs = @($data.mobCards)

}
elseif ($null -ne $data.cards) {

    $mobs = @(
        $data.cards | Where-Object {
            $_.category -eq "Mob" -or
            $_.category -eq "mob" -or
            $_.category -eq "MOB"
        }
    )

}
else {

    Write-Host ""
    Write-Host "ERROR: Could not find mobCards or cards in JSON."
    exit 1
}

Write-Host "Found $($mobs.Count) Mob cards."
Write-Host ""

# ------------------------------------------------------------
# HELPER - SAFE FILE NAME
# ------------------------------------------------------------

function Get-SafeFileName {
    param(
        [string]$Name
    )

    $fileName = $Name.ToLower()

    # Replace common symbols
    $fileName = $fileName -replace "&", "and"
    $fileName = $fileName -replace "'", ""
    $fileName = $fileName -replace '"', ""
    $fileName = $fileName -replace "/", "_"
    $fileName = $fileName -replace "\\", "_"
    $fileName = $fileName -replace ":", ""
    $fileName = $fileName -replace "\?", ""
    $fileName = $fileName -replace "!", ""
    $fileName = $fileName -replace ",", ""
    $fileName = $fileName -replace "\.", ""
    $fileName = $fileName -replace "\(", ""
    $fileName = $fileName -replace "\)", ""
    $fileName = $fileName -replace "\[", ""
    $fileName = $fileName -replace "\]", ""

    # Spaces -> underscores
    $fileName = $fileName -replace "\s+", "_"

    # Remove anything remaining that isn't safe
    $fileName = $fileName -replace "[^a-zA-Z0-9_-]", ""

    return "$fileName.png"
}

# ------------------------------------------------------------
# HELPER - SEARCH WIKI
# ------------------------------------------------------------

function Search-MinecraftWikiFile {
    param(
        [string]$MobName
    )

    $queries = @(
        "$MobName mob",
        "$MobName render",
        "$MobName image",
        "$MobName"
    )

    foreach ($searchText in $queries) {

        Write-Host "  Searching: $searchText"

        $encodedSearch = [uri]::EscapeDataString($searchText)

        $url = "$apiUrl?action=query&format=json&list=search&srsearch=$encodedSearch&srnamespace=6&srlimit=20"

        try {
            $response = Invoke-RestMethod `
                -Uri $url `
                -Method Get `
                -Headers @{
                    "User-Agent" = "MobDuelDownloader/1.0"
                }
        }
        catch {
            Write-Warning "  Search request failed."
            continue
        }

        if ($null -eq $response.query.search) {
            continue
        }

        # Prefer exact PNG result
        foreach ($result in $response.query.search) {

            $title = [string]$result.title

            if ($title -match "\.png$") {
                return $title
            }
        }

        # If no PNG found, take first image result
        $first = $response.query.search | Select-Object -First 1

        if ($null -ne $first) {
            return [string]$first.title
        }
    }

    return $null
}

# ------------------------------------------------------------
# HELPER - GET IMAGE URL
# ------------------------------------------------------------

function Get-MinecraftImageUrl {
    param(
        [string]$FileTitle
    )

    $encodedTitle = [uri]::EscapeDataString($FileTitle)

    $url = "$apiUrl?action=query&format=json&prop=imageinfo&iiprop=url&titles=$encodedTitle"

    try {

        $response = Invoke-RestMethod `
            -Uri $url `
            -Method Get `
            -Headers @{
                "User-Agent" = "MobDuelDownloader/1.0"
            }

    }
    catch {
        return $null
    }

    if ($null -eq $response.query.pages) {
        return $null
    }

    foreach ($page in $response.query.pages.PSObject.Properties.Value) {

        if ($null -eq $page.imageinfo) {
            continue
        }

        if ($page.imageinfo.Count -eq 0) {
            continue
        }

        return [string]$page.imageinfo[0].url
    }

    return $null
}

# ------------------------------------------------------------
# DOWNLOAD IMAGE
# ------------------------------------------------------------

function Download-Image {
    param(
        [string]$Url,
        [string]$Destination
    )

    try {

        Invoke-WebRequest `
            -Uri $Url `
            -OutFile $Destination `
            -Headers @{
                "User-Agent" = "MobDuelDownloader/1.0"
            }

        return $true

    }
    catch {

        Write-Warning "  Download failed: $($_.Exception.Message)"
        return $false
    }
}

# ------------------------------------------------------------
# COUNTERS
# ------------------------------------------------------------

$downloaded = 0
$skipped    = 0
$failed     = 0
$nonVanillaCount = 0

# ------------------------------------------------------------
# DOWNLOAD LOOP
# ------------------------------------------------------------

foreach ($mob in $mobs) {

    $mobName = [string]$mob.name

    if ([string]::IsNullOrWhiteSpace($mobName)) {
        continue
    }

    Write-Host ""
    Write-Host "--------------------------------------------"
    Write-Host "Mob: $mobName"

    # --------------------------------------------------------
    # NON-VANILLA
    # --------------------------------------------------------

    if ($nonVanilla -contains $mobName) {

        Write-Host "  NON-VANILLA -> skipped"
        $nonVanillaCount++

        continue
    }

    # --------------------------------------------------------
    # OUTPUT FILE
    # --------------------------------------------------------

    $fileName = Get-SafeFileName $mobName
    $destination = Join-Path $outputDir $fileName

    Write-Host "  File: $fileName"

    # --------------------------------------------------------
    # ALREADY EXISTS
    # --------------------------------------------------------

    if (Test-Path $destination) {

        Write-Host "  Already exists -> skipped"
        $skipped++

        continue
    }

    # --------------------------------------------------------
    # SEARCH
    # --------------------------------------------------------

    $fileTitle = Search-MinecraftWikiFile $mobName

    if ([string]::IsNullOrWhiteSpace($fileTitle)) {

        Write-Warning "  No image file found."
        $failed++

        continue
    }

    Write-Host "  Found: $fileTitle"

    # --------------------------------------------------------
    # IMAGE URL
    # --------------------------------------------------------

    $imageUrl = Get-MinecraftImageUrl $fileTitle

    if ([string]::IsNullOrWhiteSpace($imageUrl)) {

        Write-Warning "  Could not get image URL."
        $failed++

        continue
    }

    Write-Host "  URL: $imageUrl"

    # --------------------------------------------------------
    # ONLY ACCEPT IMAGE FILES
    # --------------------------------------------------------

    if ($imageUrl -notmatch "\.(png|jpg|jpeg|webp)(\?.*)?$") {

        Write-Warning "  Result is not a supported image."
        $failed++

        continue
    }

    # --------------------------------------------------------
    # DOWNLOAD
    # --------------------------------------------------------

    if (Download-Image -Url $imageUrl -Destination $destination) {

        Write-Host "  Downloaded successfully."
        $downloaded++

    }
    else {

        $failed++
    }

    # --------------------------------------------------------
    # SMALL DELAY
    # --------------------------------------------------------

    Start-Sleep -Milliseconds 700
}

# ------------------------------------------------------------
# SUMMARY
# ------------------------------------------------------------

Write-Host ""
Write-Host ""
Write-Host "============================================"
Write-Host "                 FINISHED"
Write-Host "============================================"
Write-Host "Downloaded       : $downloaded"
Write-Host "Already existed  : $skipped"
Write-Host "Failed           : $failed"
Write-Host "Non-vanilla      : $nonVanillaCount"
Write-Host "Output directory : $outputDir"
Write-Host "============================================"
Write-Host ""

if (Test-Path $outputDir) {

    Write-Host "Images currently in folder:"
    Write-Host ""

    Get-ChildItem $outputDir -File |
        Sort-Object Name |
        ForEach-Object {
            Write-Host "  $($_.Name)"
        }
}

Write-Host ""