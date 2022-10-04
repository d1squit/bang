import { characters } from './utils.js';

class Player {
	constructor (character_id, user, player_id, health, role, cards, modifiers) {
		this.character = Object.assign({}, characters[character_id]);
		this.character.id = character_id;
		this.user = user;

		this.player_id = player_id;
		this.health = health;
		this.role = role;

		if (this.role == 0) {
			this.character.health++;
			this.health++;
		}

		this.cards = cards;
		this.modifiers = modifiers;
		this.dead = false;
		this.distances = [];
		this.weapon = null;
	}

	addModifier (modifier) { return modifier.modifier ? this.modifiers.push(modifier) : false; }

	createMessage () {
		return new Promise((resolve, reject) => {
			resolve({
				character: this.character,
				user: this.user,
				player_id: this.player_id,
				health: this.health,
				sheriff: this.role == 0,
				cards: this.cards.length,
				modifiers: this.modifiers,
				dead: this.dead,
				distances: this.distances,
				weapon: this.weapon
			});
		});
	}

	createBotMessage () {
		return new Promise((resolve, reject) => {
			resolve({
				character: this.character,
				user: this.user,
				player_id: this.player_id,
				health: this.health,
				sheriff: this.role == 0,
				cards: this.cards.length,
				bot_cards: this.cards,
				modifiers: this.modifiers,
				dead: this.dead,
				distances: this.distances,
				weapon: this.weapon
			});
		});
	}
}

export { Player };