$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$modelsRoot = Join-Path $projectRoot "public\models"
$backupRoot = Join-Path $projectRoot ".tmp\map-model-originals"
New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null

$modelFiles = Get-ChildItem -LiteralPath $modelsRoot -Recurse -File -Filter "*.glb" | Where-Object { $_.Name -notlike "*.optimizing.glb" }
foreach ($modelFile in $modelFiles) {
	$relativePath = $modelFile.FullName.Substring($modelsRoot.Length).TrimStart([IO.Path]::DirectorySeparatorChar)
	$backupPath = Join-Path $backupRoot $relativePath
	$backupDirectory = Split-Path -Parent $backupPath
	New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
	if (-not (Test-Path -LiteralPath $backupPath)) {
		Copy-Item -LiteralPath $modelFile.FullName -Destination $backupPath
	}
	$sourceBytes = (Get-Item -LiteralPath $backupPath).Length
	$optimizedBytes = (Get-Item -LiteralPath $modelFile.FullName).Length
	if ($optimizedBytes -lt ($sourceBytes * 0.25)) {
		Write-Host "  Already optimized ($([math]::Round($optimizedBytes / 1KB)) KB)"
		continue
	}

	$tempPath = Join-Path $modelFile.DirectoryName "$($modelFile.BaseName).optimizing.glb"
	Write-Host "Optimizing $relativePath"
	& npm exec --yes --package=@gltf-transform/cli -- gltf-transform optimize $backupPath $tempPath --texture-compress webp --texture-size 1024 --compress meshopt --simplify false --instance false --join false
	if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $tempPath)) {
		Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
		throw "Optimization failed for $relativePath"
	}
	try {
		Copy-Item -LiteralPath $tempPath -Destination $modelFile.FullName -Force
	} catch {
		Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
		Write-Warning "Could not replace $relativePath; the asset may be in use."
		continue
	}
	Remove-Item -LiteralPath $tempPath -Force
	$optimizedBytes = (Get-Item -LiteralPath $modelFile.FullName).Length
	Write-Host ("  {0:N1} MiB -> {1:N1} MiB" -f ($sourceBytes / 1MB), ($optimizedBytes / 1MB))
}
