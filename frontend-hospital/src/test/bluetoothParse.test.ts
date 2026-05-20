import { describe, expect, it } from 'vitest';
import { parseDeviceData } from '@bluetooth/bluetooth/bluetoothService';

function bufferToDataView(bytes: number[]): DataView {
  const ab = new ArrayBuffer(bytes.length);
  const view = new Uint8Array(ab);
  bytes.forEach((b, i) => {
    view[i] = b;
  });
  return new DataView(ab);
}

describe('parseDeviceData', () => {
  it('parses spirometer packet', () => {
    const dv = bufferToDataView([0, 0x2c, 0x01, 0x5e, 0x01, 0xa4, 0x01]);
    const m = parseDeviceData('GENERIC_SPIROMETER', dv);
    expect(m.fev1).toBeCloseTo(3.0, 1);
    expect(m.fvc).toBeCloseTo(3.5, 1);
    expect(m.pef).toBe(420);
  });

  it('parses oximeter packet', () => {
    const dv = bufferToDataView([0, 98, 0x58, 0x02, 0]);
    const m = parseDeviceData('GENERIC_OXIMETER', dv);
    expect(m.spo2).toBe(98);
    expect(m.pulse_rate).toBe(600);
  });

  it('parses glucometer packet', () => {
    const dv = bufferToDataView([0, 0x20, 0x01]);
    const m = parseDeviceData('GENERIC_GLUCOMETER', dv);
    expect(m.glucose_level).toBe(288);
  });

  it('parses thermometer packet', () => {
    const dv = bufferToDataView([0, 0x25, 0x01]);
    const m = parseDeviceData('GENERIC_THERMOMETER', dv);
    expect(m.temperature_celsius).toBeCloseTo(2.93, 1);
  });
});
