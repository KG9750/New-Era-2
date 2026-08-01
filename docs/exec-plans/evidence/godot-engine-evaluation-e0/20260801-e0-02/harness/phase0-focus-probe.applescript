tell application "System Events"
  set previousFront to name of first application process whose frontmost is true
  tell application process "Finder" to set frontmost to true
  delay 0.5
  set probeFront to name of first application process whose frontmost is true
  tell application process previousFront to set frontmost to true
  delay 0.5
  set restoredFront to name of first application process whose frontmost is true
  return previousFront & "|" & probeFront & "|" & restoredFront
end tell
