; Refuse install, upgrade and uninstall while the app is running. Never kill it.
; nsProcess 603 means absent; all errors fail closed, including silent installation.
!macro customCheckAppRunning
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 != 603
    ${IfNot} ${Silent}
      MessageBox MB_OK|MB_ICONEXCLAMATION "请先退出橘子洛克王国工具，再重试安装或卸载。无法确认程序已退出时，本操作会停止。$\r$\nPlease close the application before installing or uninstalling."
    ${EndIf}
    SetErrorLevel 2
    Quit
  ${EndIf}
!macroend
