/**
 * Interactive Hardware & RF/ML Lab Widgets — Barrel Module
 * Re-exports all interactive lab mounters from focused ES submodules.
 * Pure ES Module — zero build step, zero external dependencies.
 */

export { mountSmartSquelch } from "./widgets/smart-squelch.js";
export { mountOokDecoder } from "./widgets/ook-decoder.js";
export { mountNfcInspector } from "./widgets/nfc-inspector.js";
export { mountSignalClassifier } from "./widgets/signal-classifier.js";
export { mountFoxhuntRadar } from "./widgets/foxhunt-radar.js";
export { mountIrLab } from "./widgets/ir-lab.js";
export { mountAudioSpectrumLab } from "./widgets/audio-spectrum-lab.js";
export { mountAudioAnomalyLab } from "./widgets/audio-anomaly-lab.js";
export { mountAudioDopplerLab } from "./widgets/audio-doppler-lab.js";
export { mountBtBleLab } from "./widgets/bt-ble-lab.js";
export { mountWifiRfLab } from "./widgets/wifi-rf-lab.js";
export { mountImuSensorLab } from "./widgets/imu-sensor-lab.js";
export { mountBusLogicLab } from "./widgets/bus-logic-lab.js";
export { mountESP32S3Lab } from "./widgets/esp32-s3-lab.js";
