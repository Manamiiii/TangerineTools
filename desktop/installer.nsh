; Builder resolves the registered path before this hook. Only a fresh install
; receives the family directory. Explicit /D remains available for isolation.
!macro refuseUnsafeDirectory
  ${IfNot} ${Silent}
    MessageBox MB_OK|MB_ICONEXCLAMATION "无法确认本工具安装目录的归属，请检查安装登记和目标路径。"
  ${EndIf}
  SetErrorLevel 3
  Quit
!macroend

!macro validateProductDirectory
  ; NSIS GetFullPathName requires an existing target. Windows can also
  ; normalize the path of a product directory before its first install.
  System::Call 'kernel32::GetFullPathNameW(w "$INSTDIR", i ${NSIS_MAX_STRLEN}, w .r2, p 0) i.r3'
  ${If} $3 == 0
  ${OrIf} $3 >= ${NSIS_MAX_STRLEN}
    !insertmacro refuseUnsafeDirectory
  ${EndIf}
  StrCpy $R2 "$2"
  ; Program maintenance must never target the shared data tree, including a
  ; product-named child selected explicitly with /D or damaged registration.
  ReadEnvStr $R7 LOCALAPPDATA
  StrLen $R8 "$R7\Tangerine\Data\"
  StrCpy $R9 "$R2\" $R8
  ${If} $R9 == "$R7\Tangerine\Data\"
    !insertmacro refuseUnsafeDirectory
  ${EndIf}
  ${If} ${FileExists} "$R2\."
    GetFullPathName $R2 "$2"
    System::Call 'kernel32::GetFileAttributesW(w "$R2") i.r3'
    IntOp $3 $3 & 0x400
    ${If} $3 != 0
      !insertmacro refuseUnsafeDirectory
    ${EndIf}
  ${EndIf}
  ${GetFileName} "$R2" $R3
  ${If} $R3 == ""
  ${OrIf} $R3 == "Programs"
  ${OrIf} $R3 == "Tangerine"
  ${OrIf} $R3 == "Apps"
  ${OrIf} $R3 == "Data"
    !insertmacro refuseUnsafeDirectory
  ${EndIf}
  StrCpy $INSTDIR "$R2"
!macroend

!macro selectProductDirectory
  ${If} $installMode != "CurrentUser"
    !insertmacro refuseUnsafeDirectory
  ${EndIf}
  ReadRegStr $R4 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ReadRegStr $R5 HKCU "${UNINSTALL_REGISTRY_KEY}" UninstallString
  !insertmacro GetDParameter $R0
  ${If} $R4 != ""
    StrCpy $INSTDIR "$R4"
    !insertmacro validateProductDirectory
    ${If} $R5 != '"$INSTDIR\${UNINSTALL_FILENAME}" /currentuser'
    ${OrIfNot} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    ${OrIfNot} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
      !insertmacro refuseUnsafeDirectory
    ${EndIf}
    ${If} $R0 != ""
    ${AndIf} $R0 != $INSTDIR
      !insertmacro refuseUnsafeDirectory
    ${EndIf}
  ${Else}
    ${If} $R5 != ""
      !insertmacro refuseUnsafeDirectory
    ${EndIf}
    ${If} $R0 == ""
      ReadEnvStr $R7 LOCALAPPDATA
      ${If} $R7 == ""
        !insertmacro refuseUnsafeDirectory
      ${EndIf}
      StrCpy $INSTDIR "$R7\Tangerine\Apps\${APP_FILENAME}"
    ${Else}
      StrCpy $INSTDIR "$R0"
    ${EndIf}
    !insertmacro validateProductDirectory
    ${If} $R3 != "${APP_FILENAME}"
    ${OrIf} ${FileExists} "$INSTDIR\*.*"
      !insertmacro refuseUnsafeDirectory
    ${EndIf}
  ${EndIf}
!macroend

!macro customInit
  !insertmacro selectProductDirectory
!macroend

; The assisted wizard can recompute the default when displaying its mode
; page. This application has a single supported mode, already initialized.
!macro customInstallMode
  Abort
!macroend

!macro customUnInstall
  !insertmacro validateProductDirectory
  ReadRegStr $R4 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $R4 != $INSTDIR
  ${OrIfNot} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    !insertmacro refuseUnsafeDirectory
  ${EndIf}
!macroend
!include "running-guard.nsh"
