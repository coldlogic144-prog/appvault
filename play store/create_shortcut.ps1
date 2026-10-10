$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [Environment]::GetFolderPath('Desktop')
$ShortcutPath = Join-Path -Path $DesktopPath -ChildPath "AppVault Admin.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "D:\web\mmmut\play store\Start AppVault Admin.bat"
$Shortcut.WorkingDirectory = "D:\web\mmmut\play store"
$Shortcut.IconLocation = "D:\web\mmmut\play store\appvault.ico,0"
$Shortcut.Description = "AppVault Admin Web Panel Launcher"
$Shortcut.Save()

$readBack = $WshShell.CreateShortcut($ShortcutPath)
Write-Host "Shortcut Verified:"
Write-Host "  Path:            " $readBack.FullName
Write-Host "  Target:          " $readBack.TargetPath
Write-Host "  Working Dir:     " $readBack.WorkingDirectory
Write-Host "  Icon Location:   " $readBack.IconLocation
Write-Host "  Description:     " $readBack.Description
