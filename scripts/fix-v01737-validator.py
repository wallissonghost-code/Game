from pathlib import Path
p=Path('scripts/check-game.mjs')
s=p.read_text(encoding='utf-8')
s=s.replace('e.tier===1&&eliteOgreReady?eliteOgreFrames:ogreFrames','eliteOgreReady?eliteOgreFrames:ogreFrames')
s=s.replace('e.tier===2&&corruptedOgreReady?corruptedOgreFrames','corruptedOgreReady?corruptedOgreFrames')
s=s.replace('e.tier===2&&corruptedReady?corruptedOgreFrames','corruptedReady?corruptedOgreFrames')
p.write_text(s,encoding='utf-8')
print('v0.17.37 validators aligned')
