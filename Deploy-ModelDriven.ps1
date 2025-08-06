# Script triển khai PCF ImportFile cho Model-driven App
param(
    [Parameter(Mandatory=$true)]
    [string]$PublisherName,
    
    [Parameter(Mandatory=$true)] 
    [string]$PublisherPrefix,
    
    [Parameter(Mandatory=$true)]
    [string]$SolutionName,
    
    [Parameter(Mandatory=$false)]
    [string]$EnvironmentUrl
)

Write-Host "=== Triển khai PCF ImportFile cho Model-driven App ===" -ForegroundColor Green

# Bước 1: Build PCF Control
Write-Host "Bước 1: Building PCF Control..." -ForegroundColor Yellow
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Stopping deployment."
    exit 1
}

# Bước 2: Tạo Solution (nếu chưa có)
$solutionPath = "./Solutions/$SolutionName"
if (!(Test-Path $solutionPath)) {
    Write-Host "Bước 2: Tạo Solution mới..." -ForegroundColor Yellow
    
    New-Item -ItemType Directory -Path "./Solutions" -Force | Out-Null
    Set-Location "./Solutions"
    
    pac solution init --publisher-name $PublisherName --publisher-prefix $PublisherPrefix --outputDirectory $SolutionName
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Failed to create solution. Stopping deployment."
        Set-Location ".."
        exit 1
    }
    
    Set-Location $SolutionName
} else {
    Write-Host "Bước 2: Sử dụng Solution có sẵn..." -ForegroundColor Yellow
    Set-Location $solutionPath
}

# Bước 3: Add PCF reference to solution
Write-Host "Bước 3: Adding PCF reference..." -ForegroundColor Yellow
pac solution add-reference --path "../../"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to add PCF reference. Stopping deployment."
    Set-Location "../.."
    exit 1
}

# Bước 4: Build Solution
Write-Host "Bước 4: Building Solution..." -ForegroundColor Yellow
msbuild /p:configuration=Release

if ($LASTEXITCODE -ne 0) {
    Write-Error "Solution build failed. Stopping deployment."
    Set-Location "../.."
    exit 1
}

# Bước 5: Deploy (nếu có Environment URL)
if ($EnvironmentUrl) {
    Write-Host "Bước 5: Deploying to Environment: $EnvironmentUrl" -ForegroundColor Yellow
    
    $zipPath = "./bin/Release/$SolutionName.zip"
    if (Test-Path $zipPath) {
        pac solution import --path $zipPath --environment $EnvironmentUrl
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Deployment successful!" -ForegroundColor Green
        } else {
            Write-Error "❌ Deployment failed!"
        }
    } else {
        Write-Error "Solution zip file not found: $zipPath"
    }
} else {
    Write-Host "Bước 5: Skipping deployment (no environment URL provided)" -ForegroundColor Yellow
    $zipPath = "./bin/Release/$SolutionName.zip"
    if (Test-Path $zipPath) {
        Write-Host "✅ Solution package created: $zipPath" -ForegroundColor Green
        Write-Host "Manual import required in Power Platform Admin Center" -ForegroundColor Cyan
    }
}

# Quay về thư mục gốc
Set-Location "../.."

Write-Host "=== Deployment Script Completed ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Go to Power Apps Maker Portal" -ForegroundColor White
Write-Host "2. Navigate to your Model-driven App" -ForegroundColor White  
Write-Host "3. Edit the form where you want to add the control" -ForegroundColor White
Write-Host "4. Select the field and add ImportFile component" -ForegroundColor White
Write-Host "5. Configure the bound field property" -ForegroundColor White
Write-Host "6. Publish the app" -ForegroundColor White
