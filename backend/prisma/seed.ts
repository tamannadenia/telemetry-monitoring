import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FLEET = [
  { name: 'Cooler-01', type: 'cooler' },
  { name: 'Cooler-02', type: 'cooler' },
  { name: 'Pump-01', type: 'pump' },
  { name: 'Motor-01', type: 'motor' },
  { name: 'Motor-02', type: 'motor' },
];

async function main() {
  for (const device of FLEET) {
    await prisma.device.upsert({
      where: { name: device.name },
      update: {},
      create: { name: device.name, type: device.type, status: 'healthy' },
    });
  }
  console.log(`Seeded ${FLEET.length} devices`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
