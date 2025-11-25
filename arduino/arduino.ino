#include <Arduino.h>
#include "LSM6DS3.h"
#include <SparkFun_Bio_Sensor_Hub_Library.h>
#include <Wire.h>
#include <bluefruit.h>

//*******************************************************************************************************************
// Watchdog Timer
#define WATCHDOG_TIMEOUT_SECONDS 10 // Reset if frozen for 10 seconds

//*******************************************************************************************************************
// ISR
volatile bool intFlag = false;
volatile int intCounter = 0;
#define SLEEP_TIME 100  // FIXED: Changed back to 100ms (10 Hz sampling)

//*******************************************************************************************************************
// IMU
#define IMU_ADDRESS 0x6A
LSM6DS3 myIMU(I2C_MODE, IMU_ADDRESS);
#define IMU_BUFFER_SIZE 20
#define IMU_SAMPLING_RATE 100

// FIXED: Back to single buffer (simpler, works with app)
int16_t accelBuffX[20];
int16_t accelBuffY[20];
int16_t accelBuffZ[20];

//*******************************************************************************************************************
// Sparkfun sensor board
#define BIOSENSOR_ADDRESS 0x55

// Reset pin, MFIO pin
int resPin = 7;
int mfioPin = 8;

#define BIOSENSOR_WIDTH 411 // Possible widths: 69, 118, 215, 411us
#define BIOSENSOR_SAMPLES 100 // Possible samples: 50, 100, 200, 400, 800, 1000, 1600, 3200 samples/second

int past_heartrate = 0;
uint8_t biosensorErrorCount = 0; // Track consecutive errors
#define MAX_BIOSENSOR_ERRORS 5 // Reset biosensor after 5 consecutive errors

SparkFun_Bio_Sensor_Hub bioHub(resPin, mfioPin);
bioData biohubData;
uint8_t biohubFifoData[6];

//*******************************************************************************************************************
// Battery monitoring
#define VBAT_PIN A0  // FIXED: Added definition
#define VBAT_DIVIDER 2.0
#define VBAT_MIN 3.0
#define VBAT_MAX 4.2  // FIXED: Changed back to 4.2V (standard LiPo max)

//*******************************************************************************************************************
// Bluetooth Services and Characteristics
BLEDis bledis;

// Battery Service (0x180F) - Custom implementation instead of BLEBas
BLEService batteryService = BLEService(UUID16_SVC_BATTERY);
BLECharacteristic batteryChar = BLECharacteristic(UUID16_CHR_BATTERY_LEVEL);

// Heart Rate Service (0x180D)
BLEService hrmService = BLEService(UUID16_SVC_HEART_RATE);
BLECharacteristic hrmMeasurement = BLECharacteristic(UUID16_CHR_HEART_RATE_MEASUREMENT);
BLECharacteristic bodySensorLocation = BLECharacteristic(UUID16_CHR_BODY_SENSOR_LOCATION);

// Pulse Oximeter Service (0x1822)
BLEService pulseOxService = BLEService(0x1822);
BLECharacteristic pulseOxChar = BLECharacteristic(0x2A5F);  // PLX Continuous Measurement
BLECharacteristic pulseOxFeatures = BLECharacteristic(0x2A60);  // PLX Features


// FIXED: Motion Service (0x1819) - SINGLE characteristic (app expects this!)
BLEService motionService = BLEService(0x1819);
BLECharacteristic accelChar = BLECharacteristic(0x2A5C);  // Standard accelerometer characteristic

// Time Sync Characteristic (custom UUID for receiving timestamp from phone)
BLECharacteristic timeSyncChar = BLECharacteristic("6E400010-B5A3-F393-E0A9-E50E24DCCA9E");

// Timestamp tracking
uint64_t baseTimestampMs = 0; // Unix milliseconds from phone at sync time
uint32_t baseMillis = 0; // millis() value when time was synced

// Tracking for comparison
unsigned long connectionStartTime = 0;

bool connectedFlag = false;

//*******************************************************************************************************************
void setup() {

// Serial port initialization
Serial.begin(115200);
  while (!Serial && millis() < 5000); // Wait max 5 seconds for serial

  Serial.println("Serial initialized");

  // Initialize Watchdog Timer for stability
  initWatchdog();
  Serial.println("Watchdog timer initialized (10 second timeout)");

  // I2C initialization
  Wire.begin();
  Wire.setClock(400000); // 400kHz I2C speed for reliability
  Serial.println("I2C initialized at 400kHz");

  // RTC initialization
  initRTC(32768 * SLEEP_TIME / 1000);
  Serial.println("RTC initialized");

  //*************************************************************************************
  // Configure accelerometer
  myIMU.settings.accelEnabled = 1;
  myIMU.settings.accelRange = 2; // ±2g
  myIMU.settings.accelSampleRate = 104; // 104 Hz

  // Disable other sensors
  myIMU.settings.gyroEnabled = 0;
  myIMU.settings.tempEnabled = 0;

  // Initialize IMU
  if (myIMU.begin() != 0) {
    Serial.println("Failed to initialize IMU - stopping");
    while (1);
  } 
  else {
    Serial.println("IMU initialized successfully!");
  }

  //************************************************************************************************************************************************************************************
  // Biosensor setup with error recovery
  Serial.println("Initializing MAX30101 biosensor...");

  if (bioHub.begin() == 0) {
    Serial.println("Biosensor started!");
  } 
  else {
    Serial.println("Failed to initialize biosensor - stopping");
    while (1);
  }

  Serial.println("Configuring Biosensor....");
  int error = bioHub.configBpm(MODE_ONE);
  if (error == 0) {
    Serial.println("Biosensor configured successfully.");
  } 
  else {
    Serial.print("Warning: Error configuring sensor: ");
    Serial.println(error);
  }

  // FIXED: Disabled host side accelerometer (causes freezing)
  // if (!enableHostSideAccelerometer()) {
  //   Serial.println("Failed to configure biosensor for host side accelerometer");
  // } else {
  //   Serial.println("Biosensor configured for host side accelerometer");
  // }

  // Set sample rate per second
  error = bioHub.setSampleRate(BIOSENSOR_SAMPLES);
  if (error != 0) {
    Serial.print("Warning: Could not set biosensor sample rate: ");
    Serial.println(error);
  } 
  else {
    Serial.print("Biosensor sample rate set to ");
    Serial.println(bioHub.readSampleRate());
  }

  // Set pulse width
  error = bioHub.setPulseWidth(BIOSENSOR_WIDTH);
  if (error != 0) {
    Serial.print("Warning: Could not set biosensor pulse width: ");
    Serial.println(error);
  } 
  else {
    Serial.print("Biosensor pulse width set to ");
    Serial.println(bioHub.readPulseWidth());
  }

  //************************************************************************************************************************************************************************************
  // Bluetooth Initialization

  Serial.println("Initializing Bluetooth...");

  Bluefruit.configPrphBandwidth(BANDWIDTH_MAX);
  Bluefruit.begin();
  Bluefruit.setTxPower(4);
  Bluefruit.setName("HeartRate_SpO2_Accel");

  // Set low power mode to prevent deep sleep that kills BLE connection
  sd_power_mode_set(NRF_POWER_MODE_LOWPWR);

  Bluefruit.Periph.setConnectCallback(connect_callback);
  Bluefruit.Periph.setDisconnectCallback(disconnect_callback);

  // Device Information Service
  bledis.setManufacturer("SeedStudio");
  bledis.setModel("XIAO_nRF52840");
  bledis.begin();
  Serial.println("Device Information Service started");

  // Battery Service (0x180F) - Custom implementation
  batteryService.begin();

  batteryChar.setProperties(CHR_PROPS_NOTIFY | CHR_PROPS_READ);
  batteryChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  batteryChar.setFixedLen(1);
  batteryChar.setCccdWriteCallback(cccd_callback);
  batteryChar.begin();
  batteryChar.write8(93); // Initial value
  Serial.println("Battery Service (0x180F) started");

  // Heart Rate Service (0x180D)
  hrmService.begin();

  hrmMeasurement.setProperties(CHR_PROPS_NOTIFY);
  hrmMeasurement.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  hrmMeasurement.setFixedLen(2);
  hrmMeasurement.setCccdWriteCallback(cccd_callback);
  hrmMeasurement.begin();

  bodySensorLocation.setProperties(CHR_PROPS_READ);
  bodySensorLocation.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  bodySensorLocation.setFixedLen(1);
  bodySensorLocation.begin();
  bodySensorLocation.write16(0); // Other location
  Serial.println("Heart Rate Service (0x180D) started");

  // Pulse Oximeter Service (0x1822)
  pulseOxService.begin();

  pulseOxChar.setProperties(CHR_PROPS_NOTIFY);
  pulseOxChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  pulseOxChar.setFixedLen(5);  // Flags(1) + SpO2(2) + HR(2)
  pulseOxChar.setCccdWriteCallback(cccd_callback);
  pulseOxChar.begin();

  pulseOxFeatures.setProperties(CHR_PROPS_READ);
  pulseOxFeatures.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  pulseOxFeatures.setFixedLen(2);
  pulseOxFeatures.begin();
  pulseOxFeatures.write16(0); // No extra features


  Serial.println("Pulse Oximeter Service (0x1822) started");

  // FIXED: Motion Service (0x1819) - Single characteristic with 14-byte format
  motionService.begin();

  accelChar.setProperties(CHR_PROPS_NOTIFY | CHR_PROPS_READ);
  accelChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  accelChar.setFixedLen(14);  // 8 bytes timestamp + 6 bytes accel data
  accelChar.setCccdWriteCallback(cccd_callback);
  accelChar.begin();

  Serial.println("Motion Service (0x1819) started");

  // Time Sync Characteristic (writable - phone sends timestamp here)
  timeSyncChar.setProperties(CHR_PROPS_WRITE);
  timeSyncChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
  timeSyncChar.setFixedLen(8); // 8 bytes for 64-bit timestamp
  timeSyncChar.setWriteCallback(timesync_callback);
  timeSyncChar.begin();
  Serial.println("Time Sync Characteristic started");  // FIXED: Typo corrected

  // Advertising Setup
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();

  // Add ALL services to advertising
  Bluefruit.Advertising.addService(hrmService); // 0x180D
  Bluefruit.Advertising.addService(batteryService); // 0x180F
  Bluefruit.Advertising.addService(pulseOxService); // 0x1822
  Bluefruit.Advertising.addService(motionService); // 0x1819

  Bluefruit.Advertising.addName();

  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 244);
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);

  Serial.println("Advertising started with all services");
  Serial.println(" - Heart Rate (0x180D)");
  Serial.println(" - Battery (0x180F)");
  Serial.println(" - Pulse Oximeter (0x1822)");
  Serial.println(" - Motion (0x1819) - 14-byte format");

  // Print address
  Serial.print("Device address: ");
  uint8_t addr[6];
  Bluefruit.getAddr(addr);
  for (int i = 5; i >= 0; i--) {
    if (addr[i] < 16) {
      Serial.print("0");
      Serial.print(addr[i], HEX);
    }
    if (i > 0) Serial.print(":");
  }
  Serial.println("");

  //************************************************************************************************************************************************************************************
  Serial.println("Loading biosensor buffer with initial data...");
  delay(4000);

  Serial.println("===========================================");
  Serial.println("Setup complete! Ready for connections.");
  Serial.println("All sensors operational:");
  Serial.println("- Heart Rate sensor");
  Serial.println("- SpO2 sensor");
  Serial.println("- Battery monitor");
  Serial.println("- Accelerometer");
  Serial.println("- Timestamp support");
  Serial.println("Waiting for React Native app connection...");
  Serial.println("===========================================");
}

void loop() {
  // Pet the watchdog to prevent reset
  feedWatchdog();

  // Sleep
  __WFI();
  __SEV();
  __WFI();

  if (intFlag) {
    intFlag = false;
    intCounter += 1;

    // FIXED: Read raw accelerometer data (no scaling here)
    accelBuffX[intCounter - 1] = myIMU.readRawAccelX();
    accelBuffY[intCounter - 1] = myIMU.readRawAccelY();
    accelBuffZ[intCounter - 1] = myIMU.readRawAccelZ();

    uint8_t biohubStatus = 0;
    switch (intCounter) {
      case 2:
        // Skip - no host-side accelerometer
        break;
      case 3:
        requestBiohubStatus();
        break;
      case 4:
        biohubStatus = readBiohubStatus();
        if (biohubStatus == 1) {
          biosensorErrorCount++;
          Serial.print("Biosensor I2C error (");
          Serial.print(biosensorErrorCount);
          Serial.println("/5)");

          // Reset biosensor if too many errors
          if (biosensorErrorCount >= MAX_BIOSENSOR_ERRORS) {
            Serial.println("Resetting biosensor due to repeated errors...");
            resetBiosensor();
            biosensorErrorCount = 0;
          }
        } 
        else {
          biosensorErrorCount = 0; // Reset error counter on success
        }
        break;
      case 5:
        requestBiohubNumFifoSamples();
        break;
      case 6:
        readBiohubNumFifoSamples();
        break;
      case 7:
        requestBiohubData();
        break;
      case 8:
        biohubStatus = readBiohubData();
        if (biohubStatus == 1) {
          Serial.println("Failed to read biosensor data - will retry");
        } 
        else {
          // Successfully read data
          //Serial.print("HR: ");
          //Serial.print(biohubData.heartRate);
          //Serial.print(" | SpO2: ");
          //Serial.print(biohubData.oxygen);
          //Serial.print(" | Status: ");
          //Serial.println(biohubData.status);
        }
        break;
      case 10:
        if (Bluefruit.connected()) {
          // Send ALL sensor data (working at 1 Hz = once per second)
          sendHrmBLE(); // Heart rate
          sendPulseOxBLE(); // SpO2
          sendBatteryBLE(); // Battery level
          sendAccelerometerBLE(); // Accelerometer with timestamp
        }
        break;
      case 20:
        intCounter = 0; // Reset every 2 seconds
        break;
      }

    if (intFlag == true) {
      Serial.print("Processing took too long at step: ");
      Serial.println(intCounter);
    }
  }
}

//**************************************************************************************************************
// Watchdog functions
void initWatchdog() {
  // Configure WDT
  NRF_WDT->CONFIG = 0x01; // Configure WDT to run when CPU is asleep
  NRF_WDT->CRV = WATCHDOG_TIMEOUT_SECONDS * 32768; // Timeout in seconds (32768 Hz clock)
  NRF_WDT->RREN |= 0x01; // Enable reload register 0

  // Enable WDT
  NRF_WDT->TASKS_START = 1;
}

void feedWatchdog() {
  NRF_WDT->RR[0] = 0x6E524635; // Reload value
}

//**************************************************************************************************************
// Reset biosensor after errors
void resetBiosensor() {
  // Try to reinitialize the biosensor
  delay(100);

  if (bioHub.begin() == 0) {
    Serial.println("Biosensor reinitialized successfully");

    // Reconfigure
    int error = bioHub.configBpm(MODE_ONE);
    if (error == 0) {
      Serial.println("Biosensor reconfigured");
    }

    bioHub.setSampleRate(BIOSENSOR_SAMPLES);
    bioHub.setPulseWidth(BIOSENSOR_WIDTH);
  } 
  else {
    Serial.println("Failed to reinitialize biosensor - will retry later");
  }
}

//**************************************************************************************************************
// CCCD callback - called when client subscribes/unsubscribes to notifications
void cccd_callback(uint16_t conn_hdl, BLECharacteristic* chr, uint16_t cccd_value) {
  if (chr->uuid == hrmMeasurement.uuid) {
    Serial.print("Heart Rate CCCD updated: ");
  } 
  else if (chr->uuid == pulseOxChar.uuid) {
    Serial.print("SpO2 CCCD updated: ");
  } 
  else if (chr->uuid == batteryChar.uuid) {
    Serial.print("Battery CCCD updated: ");
  } 
  else if (chr->uuid == accelChar.uuid) {
    Serial.print("Accelerometer CCCD updated: ");
  }

  if (cccd_value & BLE_GATT_HVX_NOTIFICATION) {
    Serial.println("Notifications ENABLED");
  } 
  else {
    Serial.println("Notifications DISABLED");
  }
}

//**************************************************************************************************************
// RTC initialization
void initRTC(unsigned long count30) {
  NRF_CLOCK->TASKS_LFCLKSTOP = 1;
  NRF_CLOCK->LFCLKSRC = 1;
  NRF_CLOCK->TASKS_LFCLKSTART = 1;
  while (NRF_CLOCK->LFCLKSTAT != 0x10001);

  NRF_RTC2->TASKS_STOP = 1;
  NRF_RTC2->TASKS_CLEAR = 1;
  NRF_RTC2->PRESCALER = 0;
  NRF_RTC2->CC[0] = count30;
  NRF_RTC2->INTENSET = 0x10000;
  NRF_RTC2->EVTENCLR = 0x10000;
  NVIC_SetPriority(RTC2_IRQn, 3);
  NVIC_EnableIRQ(RTC2_IRQn);
  NRF_RTC2->TASKS_START = 1;
}

//**************************************************************************************************************
// RTC interrupt handler
extern "C" void RTC2_IRQHandler(void) {
  if ((NRF_RTC2->EVENTS_COMPARE[0] != 0) && ((NRF_RTC2->INTENSET & 0x10000) != 0)) {
    NRF_RTC2->EVENTS_COMPARE[0] = 0;
    NRF_RTC2->TASKS_CLEAR = 1;
    intFlag = true;
  }
}

//**************************************************************************************************************
// Biosensor communication functions with error handling
void requestBiohubStatus() {
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x00);
  Wire.write(0x00);
  uint8_t error = Wire.endTransmission();
  if (error != 0) {
    Serial.print("I2C error requesting status: ");
    Serial.println(error);
  }
}

uint8_t readBiohubStatus() {
  Wire.requestFrom(BIOSENSOR_ADDRESS, static_cast<uint8_t>(2));
  if (Wire.available() >= 2) {
    uint8_t statusByte = Wire.read();
    uint8_t responseByte = Wire.read();
    return statusByte;
  }
  return 1; // Error
}

void requestBiohubNumFifoSamples() {
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x12);
  Wire.write(0x00);
  Wire.endTransmission();
}

uint8_t readBiohubNumFifoSamples() {
  Wire.requestFrom(BIOSENSOR_ADDRESS, static_cast<uint8_t>(2));
  if (Wire.available() >= 2) {
    uint8_t statusByte = Wire.read();
    uint8_t responseByte = Wire.read();
    return responseByte;
  }
  return 0;
}

void requestBiohubData() {
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x12);
  Wire.write(0x01);
  Wire.endTransmission();
}

uint8_t readBiohubData() {
  Wire.requestFrom(BIOSENSOR_ADDRESS, static_cast<uint8_t>(7));
  if (Wire.available() >= 7) {
    uint8_t statusByte = Wire.read();
    for (size_t i = 0; i < 6; i++) {
      biohubFifoData[i] = Wire.read();
    }
    if (statusByte == 0) {
      formatBiohubData();
      return 0; // Success
    }
  }
  return 1; // Error
}

void formatBiohubData() {
biohubData.heartRate = (uint16_t(biohubFifoData[0]) << 8);
biohubData.heartRate |= (biohubFifoData[1]);
biohubData.heartRate /= 10;

biohubData.confidence = biohubFifoData[2];

biohubData.oxygen = uint16_t(biohubFifoData[3]) << 8;
biohubData.oxygen |= biohubFifoData[4];
biohubData.oxygen /= 10;

biohubData.status = biohubFifoData[5];
}

//**************************************************************************************************************
// Bluetooth callback functions
void connect_callback(uint16_t conn_handle) {
  BLEConnection* connection = Bluefruit.Connection(conn_handle);

  char central_name[32] = { 0 };
  connection->getPeerName(central_name, sizeof(central_name));

  Serial.print("Connected to ");
  Serial.println(central_name);
  Serial.println("All sensors now transmitting data:");
  Serial.println("- Heart Rate");
  Serial.println("- SpO2");
  Serial.println("- Battery Level");
  Serial.println("- Accelerometer");

  connectionStartTime = millis();

  connectedFlag = true;
}

void disconnect_callback(uint16_t conn_handle, uint8_t reason) {
  (void)conn_handle;
  (void)reason;

  Serial.print("Disconnected, reason = 0x");
  Serial.println(reason, HEX);
  Serial.println("Advertising restarted - ready for new connection");

  connectedFlag = false;
  biosensorErrorCount = 0; // Reset error counter on disconnect
}

//**************************************************************************************************************
// Time sync callback - called when phone writes timestamp
void timesync_callback(uint16_t conn_hdl, BLECharacteristic* chr, uint8_t* data, uint16_t len) {
  if (len == 8) {
    // Read 8-byte timestamp (little-endian format)
    baseTimestampMs = 0;
    for (int i = 0; i < 8; i++) {
      baseTimestampMs |= ((uint64_t)data[i]) << (i * 8);
    }
    baseMillis = millis();

    Serial.print("Time synced! Unix timestamp: ");
    Serial.print((uint32_t)(baseTimestampMs / 1000));
    Serial.println(" seconds");
  } 
  else {
    Serial.print("Invalid time sync data length: ");
    Serial.println(len);
  }
}

//**************************************************************************************************************
// Get current timestamp in milliseconds (handles millis() overflow)
uint64_t getCurrentTimestamp() {
  if (baseTimestampMs == 0) {
    // Not synced yet - return 0 (app will use phone time)
    return 0;
  }

  // Handle millis() overflow safely
  uint32_t currentMillis = millis();
  uint32_t elapsed;

  if (currentMillis >= baseMillis) {
    // Normal case: no overflow
    elapsed = currentMillis - baseMillis;
  } 
  else {
    // Overflow occurred
    elapsed = (0xFFFFFFFF - baseMillis) + currentMillis + 1;
  }

  return baseTimestampMs + elapsed;
}

//**************************************************************************************************************
// BLE DATA SENDING FUNCTIONS - All sensors working

void sendHrmBLE() {
  // Send heart rate with contact detection flag
  uint8_t hrm_flags = (biohubData.status == 3) ? 0b00000110 : 0b00000010;
  uint8_t hrm_val = (uint8_t)biohubData.heartRate;

  uint8_t hrmData[2] = { hrm_flags, hrm_val };
  hrmMeasurement.notify(hrmData, 2);

  Serial.print("HR: ");
  Serial.print(hrm_val);
  Serial.print(" BPM (Contact: ");
  Serial.print((biohubData.status == 3) ? "YES" : "NO");
  Serial.println(")");
}

void sendPulseOxBLE() {
  // Send PLX Continuous Measurement data
  // Format: [Flags(1), SpO2(2 LE), PulseRate(2 LE)]
  
  // Flag fields
  // Bit 0 - SpO2PR-Fast field is present
  // Bit 1 - SpO2PR-Slow field is present
  // Bit 2 - Measurement Status field is present
  // Bit 3 - Device and Sensor Status field is present
  // Bit 4 - Pulse Amplitude Index field is present
  // Bits 5-7 - reserved for future use
  uint8_t pulseOx_flags = 0x00;  // No special fields present
  
  uint16_t spO2_value = (uint16_t)biohubData.oxygen;  // SpO2 percentage (0-100)
  uint16_t pulseRate_value = (uint16_t)biohubData.heartRate;  // Pulse rate in bpm

  uint8_t pulseOx_data[5];
  pulseOx_data[0] = pulseOx_flags;
  
  // SpO2 in little endian (LSB, MSB)
  pulseOx_data[1] = (uint8_t)(spO2_value & 0xFF);
  pulseOx_data[2] = (uint8_t)((spO2_value >> 8) & 0xFF);
  
  // Pulse Rate in little endian (LSB, MSB)
  pulseOx_data[3] = (uint8_t)(pulseRate_value & 0xFF);
  pulseOx_data[4] = (uint8_t)((pulseRate_value >> 8) & 0xFF);

  pulseOxChar.notify(pulseOx_data, 5);

  Serial.print("SpO2: ");
  Serial.print(spO2_value);
  Serial.println("%");
}

void sendBatteryBLE() {
  // Calculate battery level
  #ifdef VBAT_PIN
    float vbat = analogRead(VBAT_PIN) * 3.3 / 1024.0 * VBAT_DIVIDER;
    int batteryLevel = (int)((vbat - VBAT_MIN) / (VBAT_MAX - VBAT_MIN) * 100.0);
    batteryLevel = constrain(batteryLevel, 0, 100);
  #else
    int batteryLevel = 93; // Default if no battery pin
  #endif

  uint8_t batteryData[1] = { (uint8_t)batteryLevel };
  batteryChar.notify(batteryData, 1);

  Serial.print("Battery: ");
  Serial.print(batteryLevel);
  Serial.println("%");
}

// FIXED: Completely rewritten to match app's 14-byte format expectation
void sendAccelerometerBLE() {
  // Get current timestamp
  uint64_t timestamp = getCurrentTimestamp();

  // Use latest reading from buffer
  int16_t x = accelBuffX[intCounter - 1];
  int16_t y = accelBuffY[intCounter - 1];
  int16_t z = accelBuffZ[intCounter - 1];

  // Pack into 14-byte array: 8 bytes timestamp + 6 bytes accel data (LSB first)
  uint8_t accelData[14];

  // Timestamp (8 bytes, little-endian)
  for (int i = 0; i < 8; i++) {
    accelData[i] = (timestamp >> (i * 8)) & 0xFF;
  }

  // Accelerometer data (6 bytes, LSB first - raw values)
  accelData[8] = x & 0xFF;
  accelData[9] = (x >> 8) & 0xFF;
  accelData[10] = y & 0xFF;
  accelData[11] = (y >> 8) & 0xFF;
  accelData[12] = z & 0xFF;
  accelData[13] = (z >> 8) & 0xFF;

  // Send via single characteristic
  accelChar.notify(accelData, 14);

  // Convert raw values to g for debugging (±2g range = 16384 per g)
  float xG = x / 16384.0;
  float yG = y / 16384.0;
  float zG = z / 16384.0;
  float magnitude = sqrt(xG * xG + yG * yG + zG * zG);

  Serial.print("Accel: X=");
  Serial.print(xG, 2);
  Serial.print("g Y=");
  Serial.print(yG, 2);
  Serial.print("g Z=");
  Serial.print(zG, 2);
  Serial.print("g Mag=");
  Serial.print(magnitude, 2);
  Serial.println("g");
  Serial.print("Timestamp: ");
  Serial.println(millis() - connectionStartTime);
}
 