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
uint16_t intCounter = 0;
uint32_t secondCounter = 0; 
#define SLEEP_TIME 10

//*******************************************************************************************************************
// IMU
#define IMU_ADDRESS 0x6A
LSM6DS3 myIMU(I2C_MODE, IMU_ADDRESS);
#define IMU_BUFFER_SIZE 20
#define IMU_SAMPLING_RATE 100

int16_t accelBuffX[20];
int16_t accelBuffY[20];
int16_t accelBuffZ[20];

// Stored buffers - updated only when intCounter resets (every 200ms)
int16_t accelStoredBuffX[20];
int16_t accelStoredBuffY[20];
int16_t accelStoredBuffZ[20];

// BLE transmission buffer (prepared on interrupt 13, sent on interrupt 14)
uint8_t accelBLEBuffer[124];

//*******************************************************************************************************************
// Sparkfun sensor board
#define BIOSENSOR_ADDRESS 0x55

// Reset pin, MFIO pin
int resPin = 7;
int mfioPin = 8;

#define BIOSENSOR_WIDTH 411 // Possible widths: 69, 118, 215, 411us
#define BIOSENSOR_SAMPLES 100 // Possible samples: 50, 100, 200, 400, 800, 1000, 1600, 3200 samples/second

uint8_t biosensorErrorCount = 0; // Track consecutive biohub errors
#define MAX_BIOSENSOR_ERRORS 10 // Reset biosensor after 10 consecutive errors

SparkFun_Bio_Sensor_Hub bioHub(resPin, mfioPin);
bioData biohubData;
uint8_t biohubFifoData[6]; // Stores data output from biohub FIFO recieved over I2C

//*******************************************************************************************************************
// Battery monitoring
#define PIN_VBAT          (32)  // D32/P0_31 battery voltage
#define PIN_VBAT_ENABLE   (14)  // D14/P0_14 LOW:read enable
#define PIN_HICHG         (22)  // D22/P0_13 charge current setting LOW:100mA HIGH:50mA
#define PIN_CHG           (23)  // D23 charge indicator LOW:charge HIGH:no charge
#define RESISTANCE_RATIO  2.961
#define VBAT_MIN          3.3
#define VBAT_MAX          4.2

// Battery data shared between interrupt 12 and 13
float vbat = 0.0;
int batteryLevel = 0;

//*******************************************************************************************************************
#define CONN_TX_POWER 4
#define ADVERTISING_TX_POWER -20

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

// Custom Accelerometer Service
BLEService customService = BLEService("6E400001-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic accelChar = BLECharacteristic("6E400002-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic miscDataChar = BLECharacteristic("6E400004-B5A3-F393-E0A9-E50E24DCCA9E");
BLECharacteristic controlChar = BLECharacteristic("6E400005-B5A3-F393-E0A9-E50E24DCCA9E");

// Tracking for comparison
unsigned long connectionStartTime = 0;

bool connectedFlag = false;

//*******************************************************************************************************************
// Initialization Functions

void initBatteryMonitoring() {
  // Battery monitoring pin configuration
  pinMode(PIN_VBAT, INPUT);
  pinMode(PIN_VBAT_ENABLE, OUTPUT);
  pinMode(PIN_HICHG, OUTPUT);
  pinMode(PIN_CHG, INPUT);  
  digitalWrite(PIN_VBAT_ENABLE, HIGH);  // Start with divider disabled to save power
  digitalWrite(PIN_HICHG, LOW); // 100 mA charge current
  Serial.println("Battery monitoring pins configured");
}

void initAccelerometer() {
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
}

uint8_t initBiosensor() {
  // Biosensor setup with error recovery
  Serial.println("Initializing MAX30101 biosensor...");

  if (bioHub.begin() == 0) {
    Serial.println("Biosensor started!");
  } 
  else {
    Serial.println("Failed to initialize biosensor -- returning");
    return 1;
  }

  Serial.println("Configuring Biosensor....");
  int error = bioHub.configBpm(MODE_ONE);
  if (error == 0) {
    Serial.println("Biosensor configured successfully.");
  } 
  else {
    Serial.print("Warning: Error configuring sensor: ");
    Serial.println(error);
    return 1;
  }

  // Enable host side accelerometer
  if (!enableHostSideAccelerometer()) {
    Serial.println("Failed to configure biosensor for host side accelerometer");
    return 1;
  } else {
    Serial.println("Biosensor configured for host side accelerometer");
  }

  // Set sample rate per second
  error = bioHub.setSampleRate(BIOSENSOR_SAMPLES);
  if (error != 0) {
    Serial.print("Warning: Could not set biosensor sample rate: ");
    Serial.println(error);
    return 1;
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
    return 1;
  } 
  else {
    Serial.print("Biosensor pulse width set to ");
    Serial.println(bioHub.readPulseWidth());
  }

  Serial.println("Loading biosensor buffer with initial data...");
  delay(4000);
  return 0;
}

void initBluetooth() {
  // Bluetooth Initialization
  Serial.println("Initializing Bluetooth...");

  Bluefruit.configPrphBandwidth(BANDWIDTH_MAX);
  Bluefruit.begin();
  Bluefruit.setTxPower(ADVERTISING_TX_POWER);
  Bluefruit.setName("XIAO Health Monitor");
  Bluefruit.autoConnLed(false); // Disable blinking blue LED when waiting for connection

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

  // Custom Accelerometer Service - Buffered data transmission
  customService.begin();

  accelChar.setProperties(CHR_PROPS_NOTIFY | CHR_PROPS_READ);
  accelChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  accelChar.setFixedLen(124);  // 4 bytes secondCounter + 120 bytes buffered accel data (3 * 20 * 2)
  accelChar.setCccdWriteCallback(cccd_callback);
  accelChar.begin();

  // Miscellaneous Data Characteristic (status, confidence, voltage, charging)
  miscDataChar.setProperties(CHR_PROPS_NOTIFY | CHR_PROPS_READ);
  miscDataChar.setPermission(SECMODE_OPEN, SECMODE_NO_ACCESS);
  miscDataChar.setFixedLen(5);  // 5 bytes: status, confidence, voltage_low, voltage_high, charging
  miscDataChar.setCccdWriteCallback(cccd_callback);
  miscDataChar.begin();

  // Control Characteristic (device control commands)
  controlChar.setProperties(CHR_PROPS_WRITE | CHR_PROPS_READ);
  controlChar.setPermission(SECMODE_OPEN, SECMODE_OPEN);
  controlChar.setFixedLen(2);  // 2 bytes: byte 0 = sensor reset flag, byte 1 = device reset flag
  controlChar.begin();

  // Advertising Setup
  Bluefruit.Advertising.addFlags(BLE_GAP_ADV_FLAGS_LE_ONLY_GENERAL_DISC_MODE);
  Bluefruit.Advertising.addTxPower();

  // Add ALL services to advertising
  Bluefruit.Advertising.addService(hrmService); // 0x180D
  Bluefruit.Advertising.addService(batteryService); // 0x180F
  Bluefruit.Advertising.addService(pulseOxService); // 0x1822

  Bluefruit.Advertising.addName();

  Bluefruit.Advertising.restartOnDisconnect(true);
  Bluefruit.Advertising.setInterval(32, 1600);
  Bluefruit.Advertising.setFastTimeout(30);
  Bluefruit.Advertising.start(0);
}

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
  initBatteryMonitoring();
  initAccelerometer();
  initBiosensor();
  initBluetooth();

  //************************************************************************************************************************************************************************************
  Serial.println("===========================================");
  Serial.println("Setup complete! Ready for connections.");
  Serial.println("All sensors operational:");
  Serial.println("- Heart Rate sensor");
  Serial.println("- SpO2 sensor");
  Serial.println("- Battery monitor");
  Serial.println("- Accelerometer");
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

    int16_t accelXRaw = myIMU.readRawAccelX();
    int16_t accelYRaw = myIMU.readRawAccelY();
    int16_t accelZRaw = myIMU.readRawAccelZ();

    accelBuffX[intCounter-1] = accelXRaw * 61 / 1000;
    accelBuffY[intCounter-1] = accelYRaw * 61 / 1000;
    accelBuffZ[intCounter-1] = accelZRaw * 61 / 1000;

    uint8_t biohubStatus = 0;
    switch (intCounter) {
      case 3:
        requestBiohubStatus();
        break;
      case 4:
        biohubStatus = readBiohubStatus();
        if (biohubStatus == 1) {
          biosensorErrorCount++;
          Serial.println("Failed to read biosensor");
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
          biosensorErrorCount++;
          Serial.println("Failed to read biosensor");
        } 
        else {
          biosensorErrorCount = 0; // Reset error counter on success
        }
        break;
      case 10:
        if (Bluefruit.connected() && secondCounter % 10 == 0) {
          sendHrmBLE();
        }
        break;
      case 11:
        if (Bluefruit.connected() && secondCounter % 10 == 0) {
          sendPulseOxBLE();
        }
        break;
      case 12:
        if (Bluefruit.connected() && secondCounter % 10 == 0) {
          readBatteryAndSendMisc();
        }
        break;
      case 13:
        if (Bluefruit.connected() && secondCounter % 10 == 0) {
          sendBatteryBLE();
        }
        break;
      case 14:
        prepareAccelerometerBuffer();
        break;
      case 15:
        sendAccelerometerBLE();
        break;                
      case 20:
        intCounter = 0;
        secondCounter++;
        
        // Copy raw buffer data to stored buffers
        for (int i = 0; i < 20; i++) {
          accelStoredBuffX[i] = accelBuffX[i];
          accelStoredBuffY[i] = accelBuffY[i];
          accelStoredBuffZ[i] = accelBuffZ[i];
        }
        sendAccelerometerDataToBiohub();
        
        // Check control characteristic for commands (only every 10 seconds)
        if (secondCounter % 10 == 0 && Bluefruit.connected()) {
          uint8_t controlData[2];
          uint16_t len = controlChar.read(controlData, 2);
          
          if (len >= 2) {
            // Check for sensor reset flag (byte 0)
            if (controlData[0] == 1) {
              Serial.println("Reset biosensor command received");
              controlData[0] = 0;
              controlChar.write(controlData, 2);
              initBiosensor();
            }
            
            // Check for device reset flag (byte 1)
            if (controlData[1] == 1) {
              Serial.println("System reset command received");
              controlData[1] = 0;
              controlChar.write(controlData, 2);
              delay(100);  // Small delay to allow serial to flush
              NVIC_SystemReset();
            }
          }
        }
        break;
      }

    if (intFlag == true) {
      Serial.print("Processing took too long at step: ");
      Serial.println(intCounter);
    }
    if (biosensorErrorCount > MAX_BIOSENSOR_ERRORS) {
      Serial.println("Too many biosensor errors - restarting biosensor...");
      if (initBiosensor() == 0) {
        Serial.println("Biosensor successfully reset - resuming program.");
        Serial.println("Loading biosensor buffer with initial data...");
        delay(4000);
      }
      else {
        Serial.println("Failed to restart biosensor - restarting system...");
        delay(1000); // Give serial time to flush
        NVIC_SystemReset(); // Restart the board
      }
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

  Serial.println("RTC initialized");
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
// Function to enable the biohub to receive accelerometer data
bool enableHostSideAccelerometer() {
  Serial.println("Configuring biosensor for host side accelerometer");

  uint8_t response;

  // Set FIFO threshold: Send command 0xAA 0x10 0x01 0x0F
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x10);  // Command family
  Wire.write(0x01);  // Command index
  Wire.write(0x0F);  // Threshold
  response = Wire.endTransmission();

  if (response != 0) {
    Serial.print("I2C transmission setting FIFO threshold: ");
    Serial.println(response);
    return false;
  }
  delay(45);

  // Read response: should be 0x00 for success
  Wire.requestFrom(BIOSENSOR_ADDRESS, 1);
  response = Wire.read();
  if (response != 0) {
    Serial.print("Failed to enable input FIFO for host accelerometer , response: ");
    Serial.println(response, HEX);
    return false;
  }

  // Enable MAX30101: Send command 0x AA 0x44 0x03 0x01
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x44);  // Command family
  Wire.write(0x03);  // Command index
  Wire.write(0x01);  // Enable
  response = Wire.endTransmission();

  if (response != 0) {
    Serial.print("I2C transmission enablinb MAX30101 threshold: ");
    Serial.println(response);
    return false;
  }
  delay(45);

  // Read response: should be 0x00 for success
  Wire.requestFrom(BIOSENSOR_ADDRESS, 1);
  response = Wire.read();
  if (response != 0) {
    Serial.print("Failed to enable MAX30101 , response: ");
    Serial.println(response, HEX);
    return false;
  }

  // Enable input FIFO: Send command 0xAA 0x44 0x04 0x01 0x01
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x44);  // Command family
  Wire.write(0x04);  // Command index
  Wire.write(0x01);  // Enable
  Wire.write(0x01);  // Parameter
  response = Wire.endTransmission();

  if (response != 0) {
    Serial.print("I2C transmission error enabling host accelerometer FIFO: ");
    Serial.println(response);
    return false;
  }
  delay(45);

  // Read response: should be 0x00 for success
  Wire.requestFrom(BIOSENSOR_ADDRESS, 1);
  response = Wire.read();
  if (response != 0) {
    Serial.print("Failed to enable input FIFO for host accelerometer , response: ");
    Serial.println(response, HEX);
    return false;
  }

  // Enable MaximFast algorithm: Send command 0xAA 0x52 0x02 0x01
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x52);  // Command family
  Wire.write(0x02);  // Command index
  Wire.write(0x01);  // Enable
  response = Wire.endTransmission();

  if (response != 0) {
    Serial.print("I2C transmission error enabling MaximFast algorithm: ");
    Serial.println(response);
    return false;
  }
  delay(45);

  // Read response: should be 0x00 for success
  Wire.requestFrom(BIOSENSOR_ADDRESS, 1);
  response = Wire.read();
  if (response != 0) {
    Serial.print("Failed to enable MaximFast algorithm mode , response: ");
    Serial.println(response, HEX);
    return false;
  }

  return true;
}

//**************************************************************************************************************
// Function to send accelerometer data to biohub
uint8_t sendAccelerometerDataToBiohub() {
  // Send command header: 0xAA 0x14 0x00
  Wire.beginTransmission(BIOSENSOR_ADDRESS);  // 7-bit address
  Wire.write(0x14);                           // Command family
  Wire.write(0x00);                           // Command index

  // Send 20 samples (each sample is 6 bytes: 2 bytes each for X, Y, Z)
  for (size_t i = 0; i < 20; i++) {
    int16_t x, y, z;

    x = accelBuffX[i];
    y = accelBuffY[i];
    z = accelBuffZ[i];

    // Send X value (MSB first)
    Wire.write((x >> 8) & 0xFF);
    Wire.write(x & 0xFF);

    // Send Y value (MSB first)
    Wire.write((y >> 8) & 0xFF);
    Wire.write(y & 0xFF);

    // Send Z value (MSB first)
    Wire.write((z >> 8) & 0xFF);
    Wire.write(z & 0xFF);
  }

  uint8_t response = Wire.endTransmission();
  if (response != 0) {
    //Serial.print("I2C error writing accelerometer data to Biohub: ");
    //Serial.println(response);
  }
  return response;
}

//**************************************************************************************************************
// Biosensor communication functions with error handling
void requestBiohubStatus() {
  Wire.beginTransmission(BIOSENSOR_ADDRESS);
  Wire.write(0x00);
  Wire.write(0x00);
  uint8_t error = Wire.endTransmission();
  if (error != 0) {
    //Serial.print("I2C error requesting status: ");
    //Serial.println(error);
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

// Extract 
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
  Serial.print("【connect_callback】 conn_Handle : ");
  Serial.println(conn_handle, HEX);

  // Get the reference to current connection
  BLEConnection* connection = Bluefruit.Connection(conn_handle);

  Serial.println();
  // request PHY changed to 2MB (2Mbit/sec moduration) 1 --> 2
  Serial.print("Request to change PHY : "); Serial.print(connection->getPHY());
  connection->requestPHY();
  delayMicroseconds(1000000);  // delay a bit for all the request to complete
  Serial.print(" --> "); Serial.println(connection->getPHY());

  // request to update data length  27 --> 251
  Serial.print("Request to change Data Length : "); Serial.print(connection->getDataLength());
  connection->requestDataLengthUpdate();
  delayMicroseconds(1000000);  // delay a bit for all the request to complete
  Serial.print(" --> "); Serial.println(connection->getDataLength());
    
  // request mtu exchange 23 --> 247
  Serial.print("Request to change MTU : "); Serial.print(connection->getMtu());
  connection->requestMtuExchange(127);  // max 247
  delayMicroseconds(1000000);  // delay a bit for all the request to complete
  Serial.print(" --> "); Serial.println(connection->getMtu());

  // request connection interval  16(20mS) --> 16(20mS)
  Serial.print("Request to change Interval : "); Serial.print(connection->getConnectionInterval());
//  connection->requestConnectionParameter(16); // 20mS(in unit of 1.25) default 20mS
  delayMicroseconds(1000000);  // delay a bit for all the request to complete
  Serial.print(" --> "); Serial.println(connection->getConnectionInterval());

  Bluefruit.setTxPower(CONN_TX_POWER);

  char central_name[32] = { 0 };
  connection->getPeerName(central_name, sizeof(central_name));
  Serial.print("【connect_callback】 Connected to ");
  Serial.println(central_name);

  connectedFlag = true;
  connectionStartTime = millis(); // Record connection time for timestamp tracking
  Serial.print("Connection timestamp set at millis: ");
  Serial.println(connectionStartTime);
}

void disconnect_callback(uint16_t conn_handle, uint8_t reason) {
  (void)conn_handle;
  (void)reason;

  Serial.print("Disconnected, reason = 0x");
  Serial.println(reason, HEX);

  Bluefruit.setTxPower(ADVERTISING_TX_POWER);

  Serial.println("Advertising restarted - ready for new connection");

  connectedFlag = false;
  biosensorErrorCount = 0; // Reset error counter on disconnect
}

//**************************************************************************************************************
// BLE DATA SENDING FUNCTIONS - All sensors working

void sendHrmBLE() {
  // Send heart rate with contact detection flag
  uint8_t hrm_flags = (biohubData.status == 3) ? 0b00000110 : 0b00000010;
  uint8_t hrm_val = (uint8_t)biohubData.heartRate;

  uint8_t hrmData[2] = { hrm_flags, hrm_val };
  hrmMeasurement.notify(hrmData, 2);
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

  // Print combined sensor data with single timestamp
  unsigned long timestamp = millis() - connectionStartTime;
  
  Serial.print("TIMESTAMP_MS: ");
  Serial.print(timestamp);
  Serial.print(" | HR: ");
  Serial.print((uint8_t)biohubData.heartRate);
  Serial.print(" | SpO2: ");
  Serial.println(spO2_value);
}

// Interrupt 12: Read battery voltage and send misc data
void readBatteryAndSendMisc() {
  // Calculate battery level
#ifdef PIN_VBAT
  // Enable battery voltage reading by setting P0.14 LOW (output sink)
  digitalWrite(PIN_VBAT_ENABLE, LOW);
  delayMicroseconds(100);  // Wait for voltage to settle
  
  // Read battery voltage
  vbat = analogRead(PIN_VBAT) * 3.3 / 1024.0 * RESISTANCE_RATIO;
  batteryLevel = (int)((vbat - VBAT_MIN) / (VBAT_MAX - VBAT_MIN) * 100.0);
  batteryLevel = constrain(batteryLevel, 0, 100);
  
  // Disable voltage divider to save power
  digitalWrite(PIN_VBAT_ENABLE, HIGH);
#else
  vbat = 3.7;
  batteryLevel = 100;  // Default if no battery pin
#endif

  // Read charging status (HIGH = not charging, LOW = charging)
  uint8_t chargingStatus = digitalRead(PIN_CHG);
  uint8_t isCharging = (chargingStatus == LOW);
  
  // Send miscellaneous data (status, confidence, voltage, charging)
  // Convert voltage to uint16 (scale to 0-65535, representing 0-5V range for better resolution)
  uint16_t voltageScaled = (uint16_t)(vbat * 13107.0); // 65535/5 = 13107
  uint8_t miscData[5] = {
    biohubData.status,                     // Byte 0: Status (0-3)
    biohubData.confidence,                 // Byte 1: Confidence (0-100)
    (uint8_t)(voltageScaled & 0xFF),       // Byte 2: Voltage low byte
    (uint8_t)((voltageScaled >> 8) & 0xFF),// Byte 3: Voltage high byte
    isCharging                     // Byte 4: Charging (1=charging, 0=not charging)
  };
  miscDataChar.notify(miscData, 5);

  Serial.print("Misc - Status: ");
  Serial.print(biohubData.status);
  Serial.print(", Confidence: ");
  Serial.print(biohubData.confidence);
  Serial.print("%, Voltage: ");
  Serial.print(vbat, 2);
  Serial.print("V, Charging: ");
  Serial.println(isCharging ? "YES" : "NO");
}

// Interrupt 13: Send battery level (uses data from interrupt 12)
void sendBatteryBLE() {
  // Send battery level (calculated in interrupt 12)
  uint8_t batteryData[1] = { (uint8_t)batteryLevel };
  batteryChar.notify(batteryData, 1);

  Serial.print("Battery: ");
  Serial.print(batteryLevel);
  Serial.print("% (");
  Serial.print(vbat, 2);
  Serial.println("V)");
}

// FIXED: Completely rewritten to match app's 14-byte format expectation
// Prepare accelerometer data buffer (called on interrupt 13)
// Packs 124 bytes: secondCounter + 20 samples × 3 axes into accelBLEBuffer
void prepareAccelerometerBuffer() {
  // Pack into 124-byte array:
  // Bytes 0-3: secondCounter (uint32_t, little-endian)
  // Bytes 4-43: accelStoredBuffX[20] (20 * int16_t = 40 bytes, little-endian)
  // Bytes 44-83: accelStoredBuffY[20] (40 bytes, little-endian)
  // Bytes 84-123: accelStoredBuffZ[20] (40 bytes, little-endian)

  // Pack secondCounter (4 bytes, little-endian)
  accelBLEBuffer[0] = secondCounter & 0xFF;
  accelBLEBuffer[1] = (secondCounter >> 8) & 0xFF;
  accelBLEBuffer[2] = (secondCounter >> 16) & 0xFF;
  accelBLEBuffer[3] = (secondCounter >> 24) & 0xFF;

  // Pack accelStoredBuffX[20] (bytes 4-43)
  for (int i = 0; i < 20; i++) {
    int16_t val = accelStoredBuffX[i];
    accelBLEBuffer[4 + i * 2] = val & 0xFF;
    accelBLEBuffer[4 + i * 2 + 1] = (val >> 8) & 0xFF;
  }

  // Pack accelStoredBuffY[20] (bytes 44-83)
  for (int i = 0; i < 20; i++) {
    int16_t val = accelStoredBuffY[i];
    accelBLEBuffer[44 + i * 2] = val & 0xFF;
    accelBLEBuffer[44 + i * 2 + 1] = (val >> 8) & 0xFF;
  }

  // Pack accelStoredBuffZ[20] (bytes 84-123)
  for (int i = 0; i < 20; i++) {
    int16_t val = accelStoredBuffZ[i];
    accelBLEBuffer[84 + i * 2] = val & 0xFF;
    accelBLEBuffer[84 + i * 2 + 1] = (val >> 8) & 0xFF;
  }
}

// Send accelerometer data via BLE (called on interrupt 14)
// Transmits the prepared accelBLEBuffer via BLE notification
void sendAccelerometerBLE() {
  // Send via custom characteristic
  accelChar.notify(accelBLEBuffer, 124);
}
 