# Wind Compare

Compares current and recent wind conditions between two Los Angeles-area locations:

- **Roscomare Rd** (Bel Air)
- **E. Greystone Ave** (Azusa/Duarte)

## Features

- Current sustained wind, gusts, and direction for both locations
- Bold "WINDIER" badge on the location with higher wind
- 24-hour line chart comparing sustained wind
- Expandable hourly history table with per-location color coding

## Data

Uses the [Open-Meteo API](https://open-meteo.com/) — free, no API key required, no data scrambling. Auto-refreshes every 15 minutes.

## Usage

Serve the files with any static HTTP server:

```
php -S localhost:8080
```

Or open `index.html` directly in a browser.
