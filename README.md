# ZyberSuite — Advanced Cybersecurity Toolkit

> A fully client-side, browser-based cybersecurity toolkit featuring 12 integrated modules for encryption, network analysis, file intelligence, and threat detection — with no backend, no data collection, and no tracking.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Modules](#modules)
- [Getting Started](#getting-started)
- [API Setup (VirusTotal)](#api-setup-virustotal)
- [Privacy & Security](#privacy--security)
- [Tech Stack](#tech-stack)
- [File Size Limits](#file-size-limits)
- [Project Structure](#project-structure)
- [Author](#author)

---

## Overview

ZyberSuite is a cybersecurity web application that runs entirely in your browser. It consolidates 12 security tools — spanning steganography, cryptography, network packet analysis, malware scanning, and more — into a unified, responsive interface.

No data ever touches a server (except optional VirusTotal API calls you explicitly trigger). Everything runs locally.

---

## Features

- **12 active security modules** in a single-page app
- **Zero backend** — all logic runs client-side in the browser
- **Dark/Light theme** toggle with persistent preference
- **Mobile-responsive** layout with sidebar navigation
- **Activity log** tracking operations and bytes processed
- **Live uptime & stats** dashboard
- **Toast notifications** for real-time user feedback
- **No ads, no analytics, no third-party tracking**

---

## Modules

### Encryption

| Module | Badge | Description |
|---|---|---|
| **Steganography** | `LSB` | Hide secret messages inside images using Least Significant Bit encoding. Supports encode and decode operations. Max file size: 10 MB. |
| **Phantom Emoji** | `ZWC` | Embed hidden data inside emoji strings using Zero-Width Characters — invisible to the naked eye. |
| **Crypto Toolkit** | — | 25+ classical and modern algorithms including AES, Playfair, Beaufort, Vigenère, Base64, JWT, and more. |

### Network

| Module | Description |
|---|---|
| **WiFi Analyzer** | Parse `.pcap` files and inspect WPA handshakes. Max file size: 50 MB. |
| **Packet Analyzer** | Deep-inspect network packet captures and protocol structures. |

### Intelligence

| Module | Badge | Description |
|---|---|---|
| **Password Checker** | `HIBP` | Check if a password has been exposed in known data breaches using the Have I Been Pwned API with k-anonymity (only the first 5 chars of a SHA-1 hash are sent). |
| **Password Generator** | `NEW` | Generate cryptographically strong, customisable passwords. |
| **Malware Scanner** | — | Compute SHA-256 file hashes and run heuristic analysis (entropy, YARA-style rules, PE header parsing) locally. Optionally submit hash to VirusTotal for a 70+ AV engine lookup. Max file size: 20 MB. |
| **URL Detector** | `VT` | Analyse URLs for phishing and malware indicators. With a VirusTotal API key, performs real-time multi-engine scanning. |

### File Tools

| Module | Badge | Description |
|---|---|---|
| **Log Analyzer** | `SIEM` | Parse and triage security logs with SIEM-style pattern detection. |
| **Metadata** | `EXIF` | Extract EXIF and embedded metadata from images and files. |
| **Secure Shredder** | — | Overwrite file data in-browser to simulate secure deletion before discarding. Max file size: 50 MB. |

---

## Getting Started

ZyberSuite is a static web application — no build step or server required.

### Option 1 — Open directly

```bash
# Clone the repository
git clone https://github.com/VenkataTeja02/ZyberSuite.git
cd ZyberSuite

# Open in browser
open index.html
```

### Option 2 — Serve locally (recommended for full feature support)

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js
npx serve .
```

Then navigate to `http://localhost:8080` in your browser.

> **Note:** Some browser APIs (Clipboard, File, Canvas) require either `localhost` or an HTTPS origin. Serving locally via a simple HTTP server is recommended over double-clicking `index.html`.

---

## API Setup (VirusTotal)

Two modules — **Malware Scanner** and **URL Detector** — can optionally use the [VirusTotal API](https://www.virustotal.com) for cloud-backed scanning across 70+ antivirus engines.

### How to get a free API key

1. Create a free account at [virustotal.com/gui/join-us](https://www.virustotal.com/gui/join-us)
2. Log in → click your avatar (top-right) → **API Key** tab → Copy your key
3. Open ZyberSuite → go to **API Setup** in the sidebar → paste your key → click **Save**

Your key is stored only in your browser's `localStorage` and is never sent anywhere except directly to VirusTotal when you explicitly trigger a scan.

### Without a key

Both modules still work using local heuristic analysis (entropy scoring, YARA-style patterns, PE header inspection) — just without the VirusTotal cloud lookup.

---

## Privacy & Security

ZyberSuite is built with a privacy-first architecture:

- **API key** — stored in `localStorage` only; never sent to any server except VirusTotal.
- **File content** — never leaves your browser during local analysis (entropy, YARA, PE parsing).
- **File hash** — sent to VirusTotal only when you explicitly click *Scan* with a VT key saved.
- **Password checks** — use k-anonymity: only the first 5 characters of a SHA-1 hash are sent to HIBP.
- **No analytics, no ads, no third-party tracking.**
- Content Security Policy (CSP) headers are set directly in the HTML to restrict resource loading.

---

## Tech Stack

| Layer | Technology |
|---|---|
| UI Framework | Vanilla HTML5 / CSS3 / JavaScript (ES2022, strict mode) |
| Styling | Tailwind CSS (CDN), custom CSS variables, glassmorphism |
| Fonts | Outfit (display), Space Mono (monospace) — Google Fonts |
| Icons | Font Awesome 6.5 |
| Crypto | CryptoJS 4.2.0 |
| Compression | Pako 2.1.0 |
| EXIF Parsing | ExifReader 4.14.1 |
| Threat Intel | Have I Been Pwned API (k-anonymity), VirusTotal API v3 |
| Architecture | Single-page app, no framework, no build toolchain |

---

## File Size Limits

| Module | Limit |
|---|---|
| Steganography | 10 MB |
| Malware Scanner | 20 MB |
| WiFi Analyzer (pcap) | 50 MB |
| Secure Shredder | 50 MB |

---

## Project Structure

```
ZyberSuite/
├── index.html      # App shell, sidebar navigation, all page sections
├── style.css       # Theme variables, glassmorphism, layout, animations
└── script.js       # All module logic, utilities, API calls (2100+ lines)
```

---

## Author

Built with 💜 by **Tej** ([@VenkataTeja02](https://github.com/VenkataTeja02))

- GitHub: [github.com/VenkataTeja02](https://github.com/VenkataTeja02)
- LinkedIn: [linkedin.com/in/venkatateja02](https://linkedin.com/in/venkatateja02)

---

> **Disclaimer:** ZyberSuite is intended for educational and personal security research purposes. Always obtain proper authorisation before scanning or analysing files, networks, or URLs that you do not own.
