# App Icons

This directory contains app icons for the RentSimple PWA. You need to generate the following files:

## Required Icons

### Standard Icons

- `icon-192.png` - 192x192 PNG icon (standard size)
- `icon-192-maskable.png` - 192x192 PNG icon with safe zone for maskable display
- `icon-512.png` - 512x512 PNG icon (splash screen size)
- `icon-512-maskable.png` - 512x512 PNG icon with safe zone for maskable display

### Shortcut Icons

- `shortcut-dashboard-192.png` - 192x192 PNG icon for Dashboard shortcut
- `shortcut-properties-192.png` - 192x192 PNG icon for Properties shortcut
- `shortcut-maintenance-192.png` - 192x192 PNG icon for Maintenance shortcut

### Screenshots

- `screenshot-narrow.png` - 540x720 PNG screenshot (mobile view)
- `screenshot-wide.png` - 1280x720 PNG screenshot (tablet view)

## Maskable Icons

Maskable icons are used by some Android devices to apply icon shapes. They should have the logo centered in a safe zone. The safe zone is a circle with a radius of 40% of the image size.

## How to Generate

You can generate these icons using:

1. **Online**: [PWA Builder Image Generator](https://www.pwabuilder.com/imageGenerator)
2. **CLI**: `npx pwa-asset-generator [image] [output-dir]`
3. **Design tools**: Figma, Adobe XD, Sketch, etc.

## Template

Start with a 512x512 PNG with the RentSimple logo and brand colors (#003366 theme color).
