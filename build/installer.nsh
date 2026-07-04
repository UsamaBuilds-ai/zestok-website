!macro customInit
  DetailPrint "Cleaning up previous Stock Management installations..."

  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-Process -Name \"Stock Management\" -ErrorAction SilentlyContinue | Stop-Process -Force"'
  Pop $0
  Sleep 1000

  Delete "$DESKTOP\Stock Management.lnk"
  RMDir /r "$SMPROGRAMS\Stock Management"

  WriteRegStr SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" KeepShortcuts "false"

  ${If} ${FileExists} "$PROGRAMFILES\Stock Management"
    RMDir /r "$PROGRAMFILES\Stock Management"
  ${EndIf}
  ${If} ${FileExists} "$LOCALAPPDATA\Programs\Stock Management"
    RMDir /r "$LOCALAPPDATA\Programs\Stock Management"
  ${EndIf}
  ${If} ${FileExists} "$LOCALAPPDATA\stock-management-updater"
    RMDir /r "$LOCALAPPDATA\stock-management-updater"
  ${EndIf}
!macroend

!macro customCheckAppRunning
  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-Process -Name \"Stock Management\" -ErrorAction SilentlyContinue | Stop-Process -Force"'
  Pop $0
  Sleep 500
!macroend

!macro customUnInit
  nsExec::ExecToStack 'powershell -NoProfile -Command "Get-Process -Name \"Stock Management\" -ErrorAction SilentlyContinue | Stop-Process -Force"'
  Pop $0
  Sleep 1000
!macroend
