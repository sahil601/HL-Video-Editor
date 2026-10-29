$sh = New-Object -ComObject WScript.Shell
$desktopLnk = "$env:USERPROFILE\OneDrive\Desktop\VNest Video Editor.lnk"
if (Test-Path $desktopLnk) {
    $sc = $sh.CreateShortcut($desktopLnk)
    Write-Host "Desktop Shortcut TargetPath:" $sc.TargetPath
    Write-Host "Desktop Shortcut WorkingDirectory:" $sc.WorkingDirectory
    Write-Host "Desktop Shortcut IconLocation:" $sc.IconLocation
} else {
    Write-Host "Desktop shortcut not found at $desktopLnk"
}

$startMenuLnk = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\VNest Video Editor.lnk"
if (Test-Path $startMenuLnk) {
    $sc2 = $sh.CreateShortcut($startMenuLnk)
    Write-Host "Start Menu Shortcut TargetPath:" $sc2.TargetPath
    Write-Host "Start Menu Shortcut WorkingDirectory:" $sc2.WorkingDirectory
    Write-Host "Start Menu Shortcut IconLocation:" $sc2.IconLocation
} else {
    Write-Host "Start menu shortcut not found at $startMenuLnk"
}
