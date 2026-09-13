import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

type CardSeed = {
  name: string;
  type: string;
  power: number | null;
  description: string;
};

async function main() {
  const raw = fs.readFileSync(
    path.join(__dirname, 'cards-data.json'),
    'utf8',
  );
  const cards: CardSeed[] = JSON.parse(raw);

  // Wipe existing cards so the DB exactly matches cards-data.json (removes
  // cards that are no longer in the catalog).
  await prisma.card.deleteMany({});

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    await prisma.card.upsert({
      where: { id: i + 1 },
      update: {
        name: card.name,
        type: card.type as never,
        power: card.power as never,
        description: card.description,
      },
      create: {
        id: i + 1,
        name: card.name,
        type: card.type as never,
        power: card.power as never,
        description: card.description,
      },
    });
  }

  const { _count } = await prisma.card.aggregate({ _count: true });
  // eslint-disable-next-line no-console
  console.log(`Seeded card catalog: ${_count} cards in DB.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
