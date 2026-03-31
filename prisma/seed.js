"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const gyms = [
    {
        name: "World Class Павелецкая",
        address: "ул. Кожевническая, 15, Москва",
        city: "Москва",
        region: "Москва",
        chainName: "World Class"
    },
    {
        name: "X-Fit Галактика",
        address: "ул. Типанова, 27/39, Санкт-Петербург",
        city: "Санкт-Петербург",
        region: "Санкт-Петербург",
        chainName: "X-Fit"
    },
    {
        name: "DDX Fitness Авиапарк",
        address: "Ходынский б-р, 4, Москва",
        city: "Москва",
        region: "Москва",
        chainName: "DDX Fitness"
    },
    {
        name: "Alex Fitness Галерея",
        address: "Лиговский пр-т, 30А, Санкт-Петербург",
        city: "Санкт-Петербург",
        region: "Санкт-Петербург",
        chainName: "Alex Fitness"
    },
    {
        name: "MetroFitness Центр",
        address: "ул. Малышева, 5, Екатеринбург",
        city: "Екатеринбург",
        region: "Свердловская область",
        chainName: "MetroFitness"
    }
];
async function main() {
    for (const gym of gyms) {
        await prisma.gym.create({
            data: gym
        });
    }
}
main()
    .then(async () => {
    await prisma.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
});
