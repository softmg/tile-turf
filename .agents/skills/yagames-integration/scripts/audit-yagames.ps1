param(
  [Parameter(Mandatory = $false)]
  [string]$Root = "."
)

$ErrorActionPreference = "Stop"
$resolvedRoot = (Resolve-Path -LiteralPath $Root).Path

function Write-Section([string]$Title) {
  Write-Output ""
  Write-Output "## $Title"
}

function Search-Project([string]$Pattern) {
  if (Get-Command rg -ErrorAction SilentlyContinue) {
    & rg -n -i --glob "!node_modules/**" --glob "!dist/**" --glob "!.git/**" --glob "!package-lock.json" --glob "!npm-shrinkwrap.json" --glob "!yarn.lock" --glob "!pnpm-lock.yaml" $Pattern $resolvedRoot
    if ($LASTEXITCODE -gt 1) {
      throw "rg failed with exit code $LASTEXITCODE"
    }
    return
  }

  Get-ChildItem -LiteralPath $resolvedRoot -Recurse -File |
    Where-Object {
      $_.FullName -notmatch "[\\/](node_modules|dist|\.git)[\\/]"
      -and $_.Name -notmatch "^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$"
    } |
    Select-String -Pattern $Pattern -CaseSensitive:$false |
    ForEach-Object {
      "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim()
    }
}

Write-Output "# Yandex Games integration audit"
Write-Output "Root: $resolvedRoot"

Write-Section "AGENTS.md"
$agentFiles = Get-ChildItem -LiteralPath $resolvedRoot -Recurse -Force -File -Filter "AGENTS.md" |
  Where-Object {
    $_.FullName -notmatch "[\\/](node_modules|dist|\.git)[\\/]"
  } |
  Select-Object -ExpandProperty FullName
if ($agentFiles) {
  $agentFiles
} else {
  Write-Output "No AGENTS.md files found."
}

Write-Section "SDK loader and initialization"
Search-Project "YaGames|sdk\.js|yandex\.ru/games/sdk|sdk\.games\.s3\.yandex|games\.s3\.yandex"

Write-Section "Game Ready and gameplay lifecycle"
Search-Project "LoadingAPI|GameplayAPI|game_api_pause|game_api_resume"

Write-Section "Player data and cloud saves"
Search-Project "getPlayer|setData|getData|setStats|getStats|incrementStats"

Write-Section "Localization"
Search-Project "environment\.i18n|navigator\.language|documentElement\.lang|<html lang"

Write-Section "Advertising"
Search-Project "showFullscreenAdv|showRewardedVideo|onRewarded|onOffline"

Write-Section "Leaderboards"
Search-Project "leaderboards|getLeaderboards|setLeaderboardScore|getLeaderboardEntries|isAvailableMethod"

Write-Section "Purchases"
Search-Project "getPayments|payments\.|getPurchases|consumePurchase|signed"

Write-Section "External services and CSP"
Search-Project "Content-Security-Policy|connect-src|https?://|BACKEND|API_URL"

Write-Section "Build scripts"
$packageJsonPath = Join-Path $resolvedRoot "package.json"
if (Test-Path -LiteralPath $packageJsonPath) {
  $package = Get-Content -LiteralPath $packageJsonPath -Raw | ConvertFrom-Json
  if ($package.scripts) {
    $package.scripts | ConvertTo-Json -Depth 4
  } else {
    Write-Output "No scripts object found in package.json."
  }
} else {
  Write-Output "No package.json found."
}

Write-Section "ZIP packaging and Git ignore"
Search-Project "build:zip|package:yagames|release:yagames|Compress-Archive|DD\.MM\.YYYY|dd\.MM\.yyyy|HH-mm|\.zip"
$gitignorePath = Join-Path $resolvedRoot ".gitignore"
if (Test-Path -LiteralPath $gitignorePath) {
  Select-String -LiteralPath $gitignorePath -Pattern "\.zip" -CaseSensitive:$false |
    ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
} else {
  Write-Output "No .gitignore found. Generated release ZIP archives must be ignored explicitly."
}
$latestArchive = Get-ChildItem -LiteralPath $resolvedRoot -File -Filter "*.zip" |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1
if ($latestArchive) {
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip = [System.IO.Compression.ZipFile]::OpenRead($latestArchive.FullName)
  try {
    Write-Output "Latest archive: $($latestArchive.FullName)"
    $windowsPaths = $zip.Entries | Where-Object { $_.FullName.Contains("\") }
    if ($windowsPaths) {
      Write-Output "WARNING: ZIP entry names contain Windows backslashes. Browser asset URLs use forward slashes and can return 404 after upload."
    }
    $rootIndex = $zip.Entries | Where-Object { $_.FullName -eq "index.html" }
    if (-not $rootIndex) {
      Write-Output "WARNING: ZIP archive does not contain index.html at archive root."
    }
  } finally {
    $zip.Dispose()
  }
}

Write-Section "Bundler asset base"
$bundlerConfigs = Get-ChildItem -LiteralPath $resolvedRoot -Force -File |
  Where-Object {
    $_.Name -match "^(vite|webpack|rollup|parcel|rspack)\.config\." -or
    $_.Name -eq ".parcelrc"
  }
if ($bundlerConfigs) {
  foreach ($config in $bundlerConfigs) {
    Write-Output $config.FullName
    Select-String -LiteralPath $config.FullName -Pattern "base\s*:|publicPath|assetPrefix|publicUrl|public-url|distDir|outDir|outputPath" -CaseSensitive:$false |
      ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
  }
} else {
  Write-Output "No common bundler config found. Inspect the project's build tool configuration manually."
}

if (Test-Path -LiteralPath $packageJsonPath) {
  Select-String -LiteralPath $packageJsonPath -Pattern '"(homepage|publicPath|assetPrefix|publicUrl|distDir|outDir|outputPath|targets)"\s*:' -CaseSensitive:$false |
    ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
}

Write-Section "Built index candidates and asset paths"
$outputDirectoryNames = @("dist", "build", "out", "public")
$builtIndexPaths = foreach ($directoryName in $outputDirectoryNames) {
  $indexPath = Join-Path $resolvedRoot "$directoryName\index.html"
  if (Test-Path -LiteralPath $indexPath) {
    $indexPath
  }
}
if ($builtIndexPaths) {
  foreach ($indexPath in $builtIndexPaths) {
    Write-Output $indexPath
    Select-String -LiteralPath $indexPath -Pattern '(src|href)="[^"]+"' -AllMatches |
      ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
    if (Select-String -LiteralPath $indexPath -Pattern '(src|href)="/assets/' -Quiet) {
      Write-Output "WARNING: Root /assets URLs can return 404 after archive upload. Prefer relative ./assets URLs."
    }
  }
} else {
  Write-Output "No index.html found in common output directories: dist, build, out, public."
  Write-Output "Run the production build, then inspect the configured output directory manually if it uses a custom name."
}

Write-Section "Built output URLs"
$outputDirectories = foreach ($directoryName in $outputDirectoryNames) {
  $directoryPath = Join-Path $resolvedRoot $directoryName
  if (Test-Path -LiteralPath $directoryPath -PathType Container) {
    Get-Item -LiteralPath $directoryPath
  }
}
if ($outputDirectories) {
  foreach ($directory in $outputDirectories) {
    Write-Output $directory.FullName
    $textFiles = Get-ChildItem -LiteralPath $directory.FullName -Recurse -File |
      Where-Object { $_.Extension -in @(".html", ".css", ".js", ".json", ".map", ".webmanifest") }
    $externalUrls = $textFiles | Select-String -Pattern 'https?://[^"''\s)]+' -CaseSensitive:$false -AllMatches
    foreach ($match in $externalUrls) {
      foreach ($url in $match.Matches.Value) {
        "{0}:{1}:{2}" -f $match.Path, $match.LineNumber, $url
      }
    }
    $rootRelativeUrls = $textFiles |
      Select-String -Pattern '(?:(?:src|href)=["'']|url\(["'']?)/(?!sdk\.js(?:["'')]|$))[^/]' -Quiet |
      Where-Object { $_ }
    if ($rootRelativeUrls) {
      Write-Output "WARNING: Built output contains root-relative URLs. Confirm that every URL resolves correctly inside the uploaded archive."
    }
    $serviceStorageUrls = $textFiles | Select-String -Pattern 'https?://[^"''\s)]*games\.s3\.yandex\.net' -CaseSensitive:$false
    if ($serviceStorageUrls) {
      Write-Output "WARNING: Built output contains absolute Yandex service-storage URLs. Inspect whether they belong in the uploaded archive."
      foreach ($match in $serviceStorageUrls) {
        foreach ($url in $match.Matches.Value) {
          "{0}:{1}:{2}" -f $match.Path, $match.LineNumber, $url
        }
      }
    }
  }
} else {
  Write-Output "No common build output directory found. Inspect the configured output directory manually."
}

Write-Section "Environment files"
$envFiles = Get-ChildItem -LiteralPath $resolvedRoot -Force -File |
  Where-Object { $_.Name -match "^\.env" }
if ($envFiles) {
  foreach ($file in $envFiles) {
    Write-Output $file.FullName
    Select-String -LiteralPath $file.FullName -Pattern "BACKEND|API_URL|YANDEX" -CaseSensitive:$false |
      ForEach-Object { "{0}:{1}:{2}" -f $_.Path, $_.LineNumber, $_.Line.Trim() }
  }
} else {
  Write-Output "No .env* files found."
}
