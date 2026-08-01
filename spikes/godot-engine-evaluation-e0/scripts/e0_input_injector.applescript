on run argv
  if (count of argv) is not 1 then error "expected exact target process name" number 64
  set targetProcessName to item 1 of argv
  tell application "System Events"
    if not (exists application process targetProcessName) then error "target process absent" number 65
    tell application process targetProcessName to set frontmost to true
    delay 1.0
    repeat with keyName in {"d", "s", "a", "w"}
      key down keyName
      delay 0.1
      key up keyName
      delay 0.25
    end repeat
  end tell
end run
