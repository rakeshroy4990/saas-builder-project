/**
 * BLE service UUIDs advertised by Spirofy (Cipla) hardware — from chrome://bluetooth-internals.
 * Device may appear as "Dr Swati Pandey" or similar, not always "Spirofy".
 */
export const SPIROFY_BLE_ADVERTISED_SERVICES: string[] = [
  '00001000-0000-1000-8000-00805f9b34fb',
  '0000110a-0000-1000-8000-00805f9b34fb',
  '0000110c-0000-1000-8000-00805f9b34fb',
  '0000110e-0000-1000-8000-00805f9b34fb',
  '0000110f-0000-1000-8000-00805f9b34fb',
  '0000111f-0000-1000-8000-00805f9b34fb',
  '00001132-0000-1000-8000-00805f9b34fb',
  '00001200-0000-1000-8000-00805f9b34fb',
  '00001203-0000-1000-8000-00805f9b34fb',
  '00001801-0000-1000-8000-00805f9b34fb',
  /** Likely Spirofy vendor data channels */
  '02030302-1d19-415f-86f2-22a2106a0a77',
  '1ff31936-572e-4b36-a2bf-b2409b1aa6f4'
];

/** Primary vendor services to probe first after GATT connect. */
export const SPIROFY_VENDOR_SERVICES: string[] = [
  '02030302-1d19-415f-86f2-22a2106a0a77',
  '1ff31936-572e-4b36-a2bf-b2409b1aa6f4',
  '00001200-0000-1000-8000-00805f9b34fb',
  '00001203-0000-1000-8000-00805f9b34fb',
  '00001000-0000-1000-8000-00805f9b34fb'
];
