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

Type "projscan start --save-mission .projscan/vhs-mission --intent 'what can projscan read?' --quiet"
Enter
Sleep 30s

Type "sh .projscan/vhs-mission/review.sh | sed -n '1,34p'"
Enter
Sleep 8s

Type "projscan mission-proof --mission .projscan/vhs-mission --format markdown --quiet | sed -n '1,32p'"
Enter
Sleep 10s

Type "projscan start --mission .projscan/vhs-mission --review-gate --quiet | sed -n '1,24p'"
Enter
Sleep 24s
