param(
    [Parameter(Mandatory = $true)]
    [string]$OutputDir,

    [Parameter(Mandatory = $true)]
    [string]$RuGameplayUrl,

    [Parameter(Mandatory = $true)]
    [string]$RuOverviewUrl,

    [Parameter(Mandatory = $true)]
    [string]$EnGameplayUrl,

    [Parameter(Mandatory = $true)]
    [string]$EnOverviewUrl,

    [ValidateSet("landscape", "portrait")]
    [string]$Orientation = "landscape",

    [string]$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe",

    [int]$TimeoutMs = 7000,

    [int]$VirtualTimeBudgetMs = 15000,

    [int]$GameplayMinBytes = 120000,

    [int]$MaxAttempts = 6
)

$ErrorActionPreference = "Stop"

if (!(Test-Path -LiteralPath $ChromePath)) {
    throw "Chrome executable not found: $ChromePath"
}

$dimensions = if ($Orientation -eq "portrait") {
    @{ Width = 1080; Height = 1920 }
} else {
    @{ Width = 1920; Height = 1080 }
}

$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDir)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$shots = @(
    @{ Name = "ru-01-gameplay.jpg"; Url = $RuGameplayUrl; IsGameplay = $true },
    @{ Name = "ru-02-level-map.jpg"; Url = $RuOverviewUrl; IsGameplay = $false },
    @{ Name = "en-01-gameplay.jpg"; Url = $EnGameplayUrl; IsGameplay = $true },
    @{ Name = "en-02-level-map.jpg"; Url = $EnOverviewUrl; IsGameplay = $false }
)

function Invoke-Screenshot {
    param(
        [string]$Url,
        [string]$Target
    )

    $profile = Join-Path $env:TEMP ("yagames-aso-" + [guid]::NewGuid().ToString("N"))
    try {
        $previousErrorActionPreference = $ErrorActionPreference
        try {
            $ErrorActionPreference = "Continue"
            & $ChromePath `
                --headless=new `
                --disable-gpu `
                --hide-scrollbars `
                "--window-size=$($dimensions.Width),$($dimensions.Height)" `
                "--timeout=$TimeoutMs" `
                "--virtual-time-budget=$VirtualTimeBudgetMs" `
                --run-all-compositor-stages-before-draw `
                "--user-data-dir=$profile" `
                "--screenshot=$Target" `
                --screenshot-quality=95 `
                $Url 2>$null | Out-Null
        } finally {
            $ErrorActionPreference = $previousErrorActionPreference
        }

        $deadline = (Get-Date).AddSeconds(20)
        while (!(Test-Path -LiteralPath $Target) -and (Get-Date) -lt $deadline) {
            Start-Sleep -Milliseconds 250
        }
        if (!(Test-Path -LiteralPath $Target)) {
            throw "Screenshot was not created: $Target"
        }
    } finally {
        Remove-Item -LiteralPath $profile -Recurse -Force -ErrorAction SilentlyContinue
    }
}

foreach ($shot in $shots) {
    $target = Join-Path $resolvedOutput $shot.Name
    $attempt = 0
    do {
        $attempt += 1
        Remove-Item -LiteralPath $target -Force -ErrorAction SilentlyContinue
        Invoke-Screenshot -Url $shot.Url -Target $target
        $size = (Get-Item -LiteralPath $target).Length
    } while ($shot.IsGameplay -and $size -lt $GameplayMinBytes -and $attempt -lt $MaxAttempts)

    if ($shot.IsGameplay -and $size -lt $GameplayMinBytes) {
        Write-Warning "$($shot.Name) stayed below the gameplay size threshold. Inspect it manually."
    }
}

Add-Type -AssemblyName System.Drawing
Get-ChildItem -LiteralPath $resolvedOutput -Filter "*.jpg" | Sort-Object Name | ForEach-Object {
    $image = [System.Drawing.Image]::FromFile($_.FullName)
    try {
        if ($image.Width -ne $dimensions.Width -or $image.Height -ne $dimensions.Height) {
            throw "Unexpected dimensions for $($_.Name): $($image.Width)x$($image.Height)"
        }
        if ($image.PixelFormat -ne [System.Drawing.Imaging.PixelFormat]::Format24bppRgb) {
            throw "Unexpected pixel format for $($_.Name): $($image.PixelFormat)"
        }
        [pscustomobject]@{
            Name = $_.Name
            Width = $image.Width
            Height = $image.Height
            PixelFormat = $image.PixelFormat
            Bytes = $_.Length
        }
    } finally {
        $image.Dispose()
    }
}

Write-Host ""
Write-Host "Inspect every generated image visually before publication."
