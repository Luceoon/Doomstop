![Mozilla Add-on Rating](https://img.shields.io/amo/rating/doomstop)
![Mozilla Add-on Downloads](https://img.shields.io/amo/dw/doomstop)


# Doomstop (Firefox)

A lightweight Firefox extension that tracks your active doomscroll session and prompts when your configured limit is reached.

Tracked patterns include:
- YouTube Shorts (`youtube.com/shorts/...`)
- TikTok (`tiktok.com/...`)
- Instagram Reels (`instagram.com/reel/...` or `instagram.com/reels/...`)
- Facebook Reels (`facebook.com/reel/...`)
- and some more

## Load in Firefox

1. Open Firefox and go to `about:debugging`.
2. Select **This Firefox**.
3. Click **Load Temporary Add-on...**.
4. Choose the `manifest.json` file from this folder.

## Behavior

- The extension checks your currently active tab once per second.
- If the tab URL matches a tracked short-form feed, it adds 1 second to the current session counter.
- If no short-form feed is watched actively for 10 seconds, the session counter resets to 0.
- You can choose the alarm limit in the popup: 1, 3, 5, 8, or 10 minutes.
- When the session reaches the selected limit, a notification and on-page prompt appear.
- If you choose to take a break in the prompt, the tab is redirected to `about:blank`.

## Notes

- The counter is session-based, not daily.
- You can reset the current session manually from the popup.
- Temporary add-ons are removed when Firefox is closed.

## AI Disclaimer
It's more "just-for-fun" project and the code is 99% written by claude ai agent.
So project structure and code quality may not be the best.