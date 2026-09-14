# PepperGuard

A professional, hardware-independent MVP for monitoring black pepper storage conditions and predicting **environmental fungal-spoilage risk**.

## Run locally

No installation or build step is required.

```bash
cd PepperGuard
python3 -m http.server 8080
```

Open `http://localhost:8080`.

## Included

- Live dashboard with SAFE / WARNING / HIGH / CRITICAL classification
- Automatic sensor simulation with Normal, Rising Humidity, and Critical scenarios
- Transparent risk scoring from humidity, temperature, humidity trend, and storage duration
- Batch management with browser persistence
- Alert generation, recommendations, and resolution workflow
- Humidity, temperature, and risk history charts
- CSV export
- Responsive mobile layout and dark-mode support
- Future ESP32 HTTP ingestion contract and sample firmware sketch

## Risk model (MVP)

The model is deliberately transparent and bounded from 0–100:

- Relative humidity: up to 50 points
- Temperature: up to 20 points
- Humidity trend: up to 15 points
- Storage duration: up to 15 points

Classification: 0–30 SAFE, 31–60 WARNING, 61–80 HIGH, 81–100 CRITICAL.

This score is a decision-support prototype, not a validated food-safety instrument. It does **not** detect Aspergillus, aflatoxin, pests, or contamination. Thresholds and sensor placement must be validated with post-harvest experts and reference instrumentation before field use.

## IoT path

The dashboard's internal reading format matches the documented `POST /api/v1/readings` payload on the IoT Integration page. A production implementation should add HTTPS, device identity, secure token rotation, persistent storage, retries/offline buffering, calibration metadata, and alert delivery.

See `firmware/pepperguard_esp32.ino` for a future-ready ESP32 sketch.
