// suits: 0 - diamonds, 1 - hearts, 2 - clubs, 3 - spades
// rank: 11 - jack, 12 - queen, 13 - king, 14 - ace


class Card {
	constructor (title, card_id, modifier, suit, rank) {
		this.title = title;
		this.card_id = card_id;
		this.modifier = modifier;
		this.suit = suit;
		this.rank = rank;
	}
}


class ScofieldCard extends Card {
	constructor (suit, rank) {
		super('Скофилд', 0, true, suit, rank);
	}
}

class RageCard extends Card {
	constructor (suit, rank) {
		super('Ярость', 1, true, suit, rank);
	}
}

class RemigtonCard extends Card {
	constructor (suit, rank) {
		super('Ремингтон', 2, true, suit, rank);
	}
}

class CarabinCard extends Card {
	constructor (suit, rank) {
		super('Карабин', 3, true, suit, rank);
	}
}

class VinchesterCard extends Card {
	constructor (suit, rank) {
		super('Винчестер', 4, true, suit, rank);
	}
}

class BangCard extends Card {
	constructor (suit, rank) {
		super('Бах!', 5, false, suit, rank);
	}
}

class MissCard extends Card {
	constructor (suit, rank) {
		super('Промах', 6, false, suit, rank);
	}
}

class StagecoachCard extends Card {
	constructor (suit, rank) {
		super('Дилижанс', 7, false, suit, rank);
	}
}

class FargoCard extends Card {
	constructor (suit, rank) {
		super('Уэллс-Фарго', 8, false, suit, rank);
	}
}

class BeerCard extends Card {
	constructor (suit, rank) {
		super('Пиво', 9, false, suit, rank);
	}
}

class GatlingCard extends Card {
	constructor (suit, rank) {
		super('Гатлинг', 10, false, suit, rank);
	}
}

class PanicCard extends Card {
	constructor (suit, rank) {
		super('Паника!', 11, false, suit, rank);
	}
}

class CheatCard extends Card {
	constructor (suit, rank) {
		super('Плутовка Кэт', 12, false, suit, rank);
	}
}

class SaloonCard extends Card {
	constructor (suit, rank) {
		super('Салун', 13, false, suit, rank);
	}
}

class DuelCard extends Card {
	constructor (suit, rank) {
		super('Дуэль', 14, false, suit, rank);
	}
}

class ShopCard extends Card {
	constructor (suit, rank) {
		super('Магазин', 15, false, suit, rank);
	}
}

class IndiansCard extends Card {
	constructor (suit, rank) {
		super('Индейцы', 16, false, suit, rank);
	}
}

class PrisonCard extends Card {
	constructor (suit, rank) {
		super('Тюрьма', 17, true, suit, rank);
	}
}

class DynamiteCard extends Card {
	constructor (suit, rank) {
		super('Динамит', 18, true, suit, rank);
	}
}

class BarrelCard extends Card {
	constructor (suit, rank) {
		super('Бочка', 19, true, suit, rank);
	}
}

class AimCard extends Card {
	constructor (suit, rank) {
		super('Аппалуза', 20, true, suit, rank);
	}
}

class MustangCard extends Card {
	constructor (suit, rank) {
		super('Мустанг', 21, true, suit, rank);
	}
}






export { Card, ScofieldCard, RageCard, RemigtonCard, CarabinCard, VinchesterCard, BangCard, MissCard, StagecoachCard, FargoCard, BeerCard as BearCard,
		 PanicCard, GatlingCard, CheatCard, SaloonCard, DuelCard, ShopCard, IndiansCard, PrisonCard, BarrelCard, DynamiteCard, AimCard, MustangCard }