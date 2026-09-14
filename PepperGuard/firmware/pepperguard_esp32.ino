/* PepperGuard future integration example
 * Hardware: ESP32 + SHT31
 * Libraries: WiFi, HTTPClient, Adafruit SHT31
 * Replace placeholders before use. Use TLS certificate validation in production.
 */
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>

const char* WIFI_SSID = "YOUR_WIFI";
const char* WIFI_PASSWORD = "YOUR_PASSWORD";
const char* API_URL = "https://your-domain.example/api/v1/readings";
const char* DEVICE_TOKEN = "YOUR_DEVICE_TOKEN";
const char* DEVICE_ID = "ESP32-ZONE-A-01";
const char* BATCH_ID = "B-012";
Adafruit_SHT31 sensor = Adafruit_SHT31();

void setup() {
  Serial.begin(115200);
  Wire.begin();
  if (!sensor.begin(0x44)) {
    Serial.println("SHT31 not detected");
    while (true) delay(1000);
  }
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) delay(500);
}

void loop() {
  float temperature = sensor.readTemperature();
  float humidity = sensor.readHumidity();
  if (!isnan(temperature) && !isnan(humidity) && WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(API_URL);
    http.addHeader("Content-Type", "application/json");
    http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
    String payload = String("{\"deviceId\":\"") + DEVICE_ID +
      "\",\"batchId\":\"" + BATCH_ID +
      "\",\"temperatureC\":" + String(temperature, 1) +
      ",\"humidityPct\":" + String(humidity, 1) + "}";
    int responseCode = http.POST(payload);
    Serial.printf("Reading sent: HTTP %d\n", responseCode);
    http.end();
  }
  delay(300000); // 5-minute sample interval
}
