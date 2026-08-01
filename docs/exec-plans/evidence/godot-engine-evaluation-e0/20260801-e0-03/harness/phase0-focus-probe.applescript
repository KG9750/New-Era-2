tell application "System Events"
  set beforeName to name of first application process whose frontmost is true
end tell
tell application "Finder" to activate
delay 0.5
tell application "System Events"
  set probeName to name of first application process whose frontmost is true
end tell
tell application "ChatGPT" to activate
delay 0.5
tell application "System Events"
  set restoredName to name of first application process whose frontmost is true
end tell
return beforeName & "|" & probeName & "|" & restoredName

