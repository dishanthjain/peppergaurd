# 🌶️ PepperGuard

### Real-Time Monitoring for Safe Black Pepper Storage

PepperGuard is an IoT-enabled smart storage monitoring system designed to help black pepper farmers, warehouse operators, traders, and spice processors detect unsafe storage conditions before they lead to serious quality deterioration.

## 🚨 Problem

Dried black pepper is often stored for several months to wait for better market prices. High humidity, temperature fluctuations, poor ventilation, and hidden moisture pockets can create conditions that increase the risk of fungal growth, pest infestation, and quality loss.

Traditional manual inspections are periodic and may fail to identify problems early.

## 💡 Solution

PepperGuard continuously monitors storage conditions and converts sensor data into an easy-to-understand **environmental spoilage-risk score**.

The system provides:

* 🌡️ Temperature monitoring
* 💧 Humidity monitoring
* 📊 Real-time storage analytics
* ⚠️ Early-warning alerts
* 🧠 Environmental fungal-spoilage risk prediction
* 📦 Batch-level monitoring
* 📈 Historical trends and analytics
* 💡 Recommended actions for unsafe conditions

## 🖥️ MVP

The current MVP includes simulated real-time sensor data, allowing the complete system to be demonstrated without physical hardware.

### Risk Levels

| Score  | Status      |
| ------ | ----------- |
| 0–30   | 🟢 SAFE     |
| 31–60  | 🟡 WARNING  |
| 61–80  | 🟠 HIGH     |
| 81–100 | 🔴 CRITICAL |

The risk score considers factors such as humidity, temperature, humidity trends, and storage duration.

> **Note:** PepperGuard predicts environmental conditions associated with increased spoilage risk. It does not directly detect Aspergillus, aflatoxin, or other contaminants.

## 🏗️ System Architecture

```text
Temperature / Humidity Sensors
            ↓
           ESP32
            ↓
      Backend / API
            ↓
        Database
            ↓
       Risk Engine
            ↓
        Dashboard
            ↓
    Alerts & Recommendations
```

The MVP currently uses simulated sensor data, while the architecture is designed to support real ESP32-based sensors in future versions.

## 🛠️ Technology Stack

* React
* Vite
* JavaScript
* Node.js / Express
* MongoDB
* Recharts
* ESP32 + temperature/humidity sensors *(future hardware integration)*

## 📊 Key Dashboard Features

### Storage Overview

View the overall condition of monitored storage areas.

### Batch Monitoring

Track individual pepper batches including quantity, storage location, storage duration, temperature, humidity, and risk level.

### Alerts

Receive warnings when environmental conditions become unsafe.

### Analytics

Analyze historical temperature, humidity, and risk trends to identify developing problems.

## 🎯 Target Users

* Smallholder black pepper farmers
* Warehouse and godown operators
* Spice traders
* Spice processing companies
* Spice exporters
* Agricultural cooperatives

## 💼 Business Model

PepperGuard can follow a **Hardware + SaaS** model:

1. Affordable sensor hardware installed in storage facilities
2. Monthly subscription for monitoring and analytics
3. Premium features for warehouses, processors, and exporters

## 🚀 Future Scope

* Real ESP32 sensor integration
* SMS / WhatsApp alerts
* Mobile application
* Advanced machine-learning prediction
* Automated ventilation control
* Laboratory testing integration
* Multi-warehouse monitoring
* Expansion to other stored agricultural commodities

## 🌱 Impact

PepperGuard aims to help stakeholders identify unsafe storage conditions earlier, reduce avoidable post-harvest losses, protect product quality, and support safer spice supply chains.

## 👨‍💻 Project

**PepperGuard — Smart Storage Monitoring for Black Pepper**

Built as an MVP to address the challenge of real-time post-harvest storage monitoring.
