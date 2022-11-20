import { AimCard, BangCard, BarrelCard, BearCard, CarabinCard, Card, CheatCard, DuelCard, DynamiteCard, FargoCard, GatlingCard, IndiansCard, MissCard, MustangCard, PanicCard, PrisonCard, RageCard, RemigtonCard, SaloonCard, ScofieldCard, ShopCard, StagecoachCard, VinchesterCard } from './card.js';

function shuffle(array_input) {
	let array = Object.assign([], array_input);
	let currentIndex = array.length, randomIndex;

	while (currentIndex != 0) {
		randomIndex = Math.floor(Math.random() * currentIndex);
		currentIndex--;
		[array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
	}

	return array;
}

// const characters = [
// 	{ "name": "Неуловимый Джо", "health": 3 },
// 	// { "name": "Киллер Слэб", "health": 4},
// 	{ "name": "Джанго", "health": 3 },
// 	{ "name": "Хладнокровная Рози", "health": 4 },
// 	// { "name": "Кит Карсон", "health": 4 },
// 	// { "name": "Бедствие Жанет", "health": 4 },
// 	// { "name": "Педро Рамирез", "health": 4 },
// 	{ "name": "Сюзи Лафайет", "health": 4 },
// 	// { "name": "Блэк Джек", "health": 4 },
// 	{ "name": "Том Кетчум", "health": 4 },
// 	{ "name": "Большой Змей", "health": 4 },
// 	{ "name": "Бутч Кессиди", "health": 4 },
// 	{ "name": "Джесси Джеймс", "health": 4 },
// 	// { "name": "Джордоннас", "health": 4 },
// 	{ "name": "Малыш Билли", "health": 4 },
// 	{ "name": "Счатливчик Люк", "health": 4 }
// ];

const characters = [
	{ "name": "Неуловимый Джо", "health": 10 },
	// { "name": "Киллер Слэб", "health": 4},
	{ "name": "Джанго", "health": 1 },
	{ "name": "Хладнокровная Рози", "health": 1 },
	// { "name": "Кит Карсон", "health": 4 },
	// { "name": "Бедствие Жанет", "health": 4 },
	// { "name": "Педро Рамирез", "health": 4 },
	{ "name": "Сюзи Лафайет", "health": 1 },
	// { "name": "Блэк Джек", "health": 4 },
	{ "name": "Том Кетчум", "health": 1 },
	{ "name": "Большой Змей", "health": 1 },
	{ "name": "Бутч Кессиди", "health": 1 },
	{ "name": "Джесси Джеймс", "health": 1 },
	// { "name": "Джордоннас", "health": 4 },
	{ "name": "Малыш Билли", "health": 1 },
	{ "name": "Счатливчик Люк", "health": 1 }
];

const bans = [2, 5, 5, 5, 15, 15, 15, 30, 30, 30, 60];

const cards = [
	new IndiansCard(0, 14),
	new IndiansCard(0, 13),
	new PrisonCard(3, 10),
	new DuelCard(3, 11),
	new DuelCard(0, 12),
	new DuelCard(2, 8),
	new PrisonCard(3, 11),
	new PrisonCard(1, 4),

	new PanicCard(1, 14),
	new PanicCard(1, 12),
	new PanicCard(0, 8),
	new PanicCard(1, 11),

	new CheatCard(1, 13),
	new CheatCard(0, 11),
	new CheatCard(0, 9),
	new CheatCard(0, 10),

	new BearCard(1, 11),
	new BearCard(1, 10),
	new BearCard(1, 8),
	new BearCard(1, 9),
	new BearCard(1, 6),
	new BearCard(1, 7),

	new MissCard(2, 3),
	new MissCard(2, 14),
	new MissCard(2, 10),
	new MissCard(3, 2),
	new MissCard(3, 4),
	new MissCard(3, 8),
	new MissCard(3, 3),
	new MissCard(3, 5),
	new MissCard(3, 7),
	new MissCard(3, 6),
	new MissCard(3, 12),
	new MissCard(3, 13),

	new ShopCard(3, 12),
	new ShopCard(2, 9),
	new RageCard(2, 10),
	new BarrelCard(3, 12),
	new BarrelCard(3, 13),
	new RageCard(3, 10),
	new ScofieldCard(2, 12),
	new ScofieldCard(2, 11),
	new ScofieldCard(2, 13),

	new BangCard(2, 7),
	new BangCard(0, 9),
	new BangCard(0, 0), // ! ----------------------------------------------------- ! //
	new BangCard(1, 12),
	new BangCard(0, 12),
	new BangCard(0, 6),
	new BangCard(0, 7),
	new BangCard(2, 9),
	new BangCard(0, 8),
	new BangCard(2, 8),
	new BangCard(0, 10),
	new BangCard(0, 5),
	new BangCard(1, 13),
	new BangCard(0, 13),
	new BangCard(2, 6),
	new BangCard(0, 3),
	new BangCard(2, 3),
	new BangCard(0, 11),
	new BangCard(2, 2),
	new BangCard(0, 14),
	new BangCard(0, 2),
	new BangCard(1, 14),
	new BangCard(3, 14),
	new BangCard(2, 4),
	new BangCard(0, 4),

	new MustangCard(1, 9),
	new MustangCard(1, 8),
	new StagecoachCard(3, 9),
	new StagecoachCard(3, 9),

	new DynamiteCard(1, 2),
	new RemigtonCard(2, 13),
	new VinchesterCard(3, 8),
	new AimCard(3, 14),
	new CarabinCard(2, 14),
	new FargoCard(1, 3),
	new GatlingCard(1, 10),
	new SaloonCard(1, 5),
];

const roles = [0, 1, 2, 3, 3, 3];

export { shuffle, characters, cards, roles, bans }