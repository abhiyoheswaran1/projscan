Output docs/projscan-mission-proof.gif

Set Shell "bash"
Set FontSize 16
Set Width 1200
Set Height 720
Set Theme "Catppuccin Mocha"
Set TypingSpeed 35ms
Set Padding 16

Type "rm -rf .projscan/vhs-mission"
Enter
Sleep 500ms

Type "projscan start --save-mission .projscan/vhs-mission --intent 'is it safe to commit this change?'"
Enter
Sleep 10s

Type "projscan mission-proof --mission .projscan/vhs-mission --format markdown | sed -n '1,38p'"
Enter
Sleep 8s

Type "projscan start --mission .projscan/vhs-mission --handoff-prompt | sed -n '1,8p'"
Enter
Sleep 16s
