import prisma from './prisma';
import { DeviceType } from '../types/domain';

/** Fleet of industrial devices seeded on first boot. */
export const FLEET_DEVICES: { name: string; type: DeviceType }[] = [
  { name: 'Cooler-01', type: DeviceType.cooler },
  { name: 'Cooler-02', type: DeviceType.cooler },
  { name: 'Pump-01', type: DeviceType.pump },
  { name: 'Motor-01', type: DeviceType.motor },
  { name: 'Motor-02', type: DeviceType.motor },
];

/**
 * Ensure the five simulated fleet devices exist in the database.
 * Idempotent — safe to call on every server start.
 */
export async function seedDevices(): Promise<void> {
  for (const device of FLEET_DEVICES) {
    await prisma.device.upsert({
      where: { name: device.name },
      update: {},
      create: {
        name: device.name,
        type: device.type,
        status: 'healthy',
      },
    });
  }
  console.log(`[seed] Ensured ${FLEET_DEVICES.length} fleet devices exist`);
}
