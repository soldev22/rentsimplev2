# RentSimple PWA Setup

## Overview

RentSimple has been converted to a Progressive Web App (PWA), enabling users to:

- Install the app on mobile devices (iOS & Android)
- Access it offline with cached content
- Receive push notifications
- Add shortcuts to home screen

## What's Included

### 1. **Service Worker** (`public/sw.js`)

- Handles offline caching with cache-first strategy for assets
- Uses network-first strategy for API calls
- Automatically updates content when online
- Cleans up old cache versions

### 2. **Web App Manifest** (`public/manifest.json`)

- Defines app metadata (name, icons, colors, theme)
- Enables home screen installation
- Configures app shortcuts (Dashboard, Properties, Maintenance)
- Sets display mode to "standalone" (full-screen app experience)

### 3. **PWA Components**

- `components/pwa/ServiceWorkerRegister.tsx` - Registers and manages the service worker
- `components/pwa/PWAInstallPrompt.tsx` - Shows install prompt when available (iOS & Android)

### 4. **Meta Tags** (in `app/layout.tsx`)

- Apple mobile web app configuration
- Theme color and status bar styling
- Viewport configuration for mobile devices
- Mobile web app capable detection

### 5. **Offline Page** (`app/offline/page.tsx`)

- Fallback page shown when offline (currently unused but available)

## How It Works

### Installation Flow

**Android:**

1. User visits RentSimple in Chrome/Edge
2. Browser shows "Install" prompt
3. User clicks "Install"
4. App is added to home screen and installed

**iOS:**

1. User visits RentSimple in Safari
2. User taps Share → Add to Home Screen
3. App appears on home screen
4. Tapping it opens the PWA in standalone mode

### Offline Support

1. Service worker caches assets on first visit
2. If user goes offline:
   - Assets (JS, CSS, images) load from cache
   - API calls show cached responses if available
   - User can still navigate cached pages
3. When back online:
   - Service worker fetches fresh data
   - Cache is updated automatically

### App Shortcuts

Users can long-press the app icon to access quick shortcuts:

- **Dashboard** - Go to main dashboard
- **Properties** - View properties
- **Maintenance** - View maintenance requests

## Installation for Users

### Android

1. Open RentSimple in Chrome/Edge/Firefox
2. Look for the "Install" button/prompt
3. Tap "Install"
4. App is now on your home screen

### iOS

1. Open RentSimple in Safari
2. Tap the Share button (box with arrow)
3. Tap "Add to Home Screen"
4. Tap "Add"
5. App is now on your home screen

## App Icons

To make the app production-ready, you need to generate app icons:

**Required icons in `public/icons/`:**

- `icon-192.png` - 192x192 standard icon
- `icon-192-maskable.png` - 192x192 maskable icon
- `icon-512.png` - 512x512 splash screen icon
- `icon-512-maskable.png` - 512x512 maskable icon
- `shortcut-*.png` - Shortcut icons (192x192 each)
- `screenshot-*.png` - Screenshots for app stores

**Generate icons using:**

```bash
npx pwa-asset-generator logo.png ./public/icons/
```

Or use: [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)

## Service Worker Configuration

The service worker uses two caching strategies:

### Cache-First (for assets)

- Check cache first, use cached version if available
- Fall back to network if not cached
- Good for: JS, CSS, images, fonts

### Network-First (for API)

- Try to fetch fresh data from network
- Fall back to cache if offline
- Good for: API calls, dynamic content

## Configuration

### Enable/Disable in Development

By default, service workers are not registered in development mode. To test:

```bash
NEXT_PUBLIC_FORCE_SW=1 npm run dev
```

Or in production:

```bash
npm run build
npm run start
```

### Update Checking

The service worker checks for updates every 60 seconds. To manually trigger:

```javascript
navigator.serviceWorker.controller?.postMessage({
  type: 'SKIP_WAITING'
})
```

## Browser Support

| Feature            | Chrome | Edge | Firefox | Safari | iOS Safari |
| ------------------ | ------ | ---- | ------- | ------ | ---------- |
| PWA Install        | ✅     | ✅   | ✅      | ❌     | ⚠️ Limited |
| Service Worker     | ✅     | ✅   | ✅      | ✅     | ✅         |
| Offline Support    | ✅     | ✅   | ✅      | ✅     | ✅         |
| Add to Home Screen | ✅     | ✅   | ✅      | ✅     | ✅         |
| Push Notifications | ✅     | ✅   | ✅      | ❌     | ❌         |

## Debugging

### Check Service Worker Status

Open DevTools and go to Application → Service Workers:

- Shows registered service workers
- Displays scope and status
- Option to unregister or skip waiting

### Check Cache

Go to Application → Cache Storage:

- See what's cached
- Check cache size
- Manually delete cache entries

### Console Logs

Service worker logs appear in:

1. Main app console (messages from UI)
2. Service Worker console (in DevTools Application tab)

## Performance Impact

- **Build time**: No change (we removed next-pwa which had build overhead)
- **Bundle size**: +minimal (service worker is small)
- **Runtime**: Negligible impact, service worker runs in background

## Next Steps

1. **Generate app icons** - Use PWA Builder or design tools
2. **Test on devices** - Install on iOS and Android
3. **Add push notifications** - Implement Web Push API (optional)
4. **Monitor analytics** - Track app installs and usage
5. **Create install ads** - Guide users to install the PWA

## Troubleshooting

### Service Worker not registering

- Check browser console for errors
- Verify `/public/sw.js` exists
- Ensure HTTPS is enabled (required in production)
- Try clearing cache and restarting browser

### Offline not working

- Verify service worker is registered
- Check Application tab → Cache Storage
- Service worker must be uninterrupted during install

### Push notifications not working

- iOS Safari doesn't support Web Push (iOS 16+)
- Android requires opt-in from user
- HTTPS is required
- Some ad blockers interfere

## Resources

- [MDN: PWA Documentation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Web.dev: PWA Checklist](https://web.dev/pwa-checklist/)
- [PWA Builder](https://www.pwabuilder.com/)
- [Service Workers API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
