!macro customInit
  nsExec::Exec 'taskkill /F /IM "Stock Management.exe"'
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "Stock Management.exe"'
!macroend
