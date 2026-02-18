# Notification Sounds

This directory contains audio files for notification alerts.

## Required Files

- `notification.mp3` - Default notification sound for new messages

## How to Add Notification Sound

1. Download a free notification sound from:
   - [Freesound.org](https://freesound.org/) (Creative Commons)
   - [Zapsplat.com](https://www.zapsplat.com/) (Free with attribution)
   - [Mixkit.co](https://mixkit.co/free-sound-effects/) (Free for commercial use)

2. Rename the file to `notification.mp3`

3. Place it in this directory (`apps/wc-booking/public/sounds/`)

4. The notification system will automatically use it

## Recommended Sound Characteristics

- **Duration**: 0.5-2 seconds
- **Format**: MP3 (for best browser compatibility)
- **Volume**: Moderate (the app sets volume to 50%)
- **Type**: Subtle notification tone (not jarring)

## Fallback Behavior

If `notification.mp3` is not found, the notification system will:
- Still show browser notifications (if enabled)
- Skip the sound playback (no error shown to user)
- Log a warning in the console (development only)

