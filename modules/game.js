import { Player } from './player.js';
import { characters, shuffle, cards, roles } from './utils.js';
import { BangCard, BarrelCard, MissCard, SaloonCard, ScofieldCard, ShopCard } from './card.js';

const getActivePlayers = (room) => room.players.filter(p => p.dead == false);

const changeTurn = (io, room) => {
	clearInterval(room.timeout.interval);

	room.history.push([]);

	const cards_delta = room.players[room.turn].cards.length - room.players[room.turn].health;

	if (cards_delta > 0) {
		for (let i = 0; i < cards_delta; i++) {
			const randomCardIndex = Math.floor(Math.random() * room.players[room.turn].cards.length);

			room.destroyed.push(room.players[room.turn].cards[randomCardIndex]);
			io.to(room.id).emit('accept-card', room.turn, room.players[room.turn].cards[randomCardIndex], randomCardIndex, room.turn, 'remove');
			room.players[room.turn].cards.splice(randomCardIndex, 1);
			io.to(room.players[room.turn].user.id).emit('player', room.players[room.turn]);
		}
	}

	const players = getActivePlayers(room);
	const index = players.findIndex(player => player.player_id == room.turn);
	if (index == players.length - 1) room.turn = players[0].player_id;
	else room.turn = players[index + 1].player_id;

	if (room.players[room.turn].character.id == 4) {
		if (room.shuffled.length >= 3) room.choose_cards = room.shuffled.splice(room.shuffled.length - 3, 3);
		else {
			checkShuffled(io, room);
			room.choose_cards = room.shuffled.splice(room.shuffled.length - 3, 3);
		}

		room.choose_cards.forEach(card => room.destroyed.push(card));

		io.to(room.players[room.turn].user.id).emit('choose-from-three', room.turn, room.choose_cards);
	} else if (room.players[room.turn].character.id == 6) {
		if (room.destroyed_choosed) {
			room.players[room.turn].cards.push(room.destroyed.splice(room.destroyed.length - 1, 1)[0]);
			setTimeout(() => io.to(room.id).emit('splice-destroyed', room.turn), 600);
			sendNewCards(io, room, room.turn, 1);
		} else sendNewCards(io, room, room.turn, 2);
	} else if (room.players[room.turn].character.id == 12) {
		if (room.player_choosed == -1 || room.player_choosed == room.turn) sendNewCards(io, room, room.turn, 2);
		else {
			const choosedPlayer = room.players[getActivePlayers(room)[room.player_choosed].player_id];
			const randomCardIndex = Math.floor(Math.random() * choosedPlayer.cards.length);
			const randomCard = choosedPlayer.cards.splice(randomCardIndex, 1)[0];

			room.players[room.turn].cards.push(randomCard);
			io.to(room.players[choosedPlayer.player_id].user.id).emit('player', room.players[choosedPlayer.player_id]);
			setTimeout(() => io.to(room.id).emit('accept-card', getActivePlayers(room)[room.player_choosed].player_id, randomCard, randomCardIndex, room.turn, 'transfer'), 600);
			
			sendNewCards(io, room, room.turn, 1);
		}
	} else if (room.players[room.turn].character.id == 8) {
		sendNewCards(io, room, room.turn, 1);
		let checkCard = null;
		if (room.shuffled.length >= 1) checkCard = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
		else {
			checkShuffled(io, room);
			checkCard = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
		}

		io.to(room.id).emit('show-card', checkCard);
		room.players[room.turn].cards.push(checkCard);
		if (checkCard.suit == 0 || checkCard.suit == 1) sendNewCards(io, room, room.turn, 1);
	} else sendNewCards(io, room, room.turn, 2);

	const count = [];
	room.players.forEach(player => count.push(player.cards.length));
	io.to(room.id).emit('update-cards-count', count);

	sendTurn(io, room);
	sendWait(io, room, room.turn, 60, true);
}

const checkShuffled = (io, room) => {
	if (room.shuffled.length == 0) {
		room.shuffled = shuffle(room.destroyed);
		room.destroyed = [];
		io.to(room.id).emit('table', { card_count: room.shuffled.length });
		io.to(room.id).emit('clear-destroyed');
	} else shuffle(room.destroyed).forEach(card => room.shuffled.push(card));
}

const sendNewCards = (io, room, player_id, count) => {
	for (let i = 0; i < count; i++) room.players[player_id].cards.push(room.shuffled[room.shuffled.length - i - 1]);
	if (room.shuffled.length >= count) room.shuffled.splice(room.shuffled.length - count, count);
	else {
		checkShuffled(io, room);
		room.shuffled.splice(room.shuffled.length - count, count);
	}
	io.to(room.id).emit('table', { card_count: room.shuffled.length });
	io.to(room.players[player_id].user.id).emit('player', room.players[player_id]);
}

const sendTurn = (io, room) => {
	io.to(room.id).emit('turn', room.turn);
	room.turn_cards = [];
}

const sendWait = (io, room, player_id, time, new_turn) => {
	room.wait = player_id;
	room.timeout.time = time;
	room.health_cards = 0;

	if (new_turn) {
		getActivePlayers(room).forEach(player => {
			if (player.health <= 0) kickPlayer(io, room, player);
			if (room.turn == player.player_id) {
				player.modifiers.forEach((modifier, mod_index) => {
					if (modifier.card_id == 18) {
						if (room.shuffled >= 1) room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
						else {
							checkShuffled(io, room);
							room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
						}

						room.destroyed.push(room.check_card);
		
						if (room.players[player_id].character.id == 15) {
							if (room.shuffled >= 1) room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
							else {
								checkShuffled(io, room);
								room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
							}
							room.destroyed.push(room.second_check_card);
							io.to(room.id).emit('check-card', player_id, room.check_card, room.second_check_card);
						} else io.to(room.id).emit('check-card', player_id, room.check_card, null);
						
						setTimeout(() => {
							if (room.check_card.suit == 3 && room.check_card.rank >= 2 && room.check_card.rank <= 9) {
								setTimeout(() => {
									io.to(room.id).emit('destroy-modifier', room.players[player.player_id].modifiers[mod_index], player);
									player.modifiers.splice(mod_index, 1);
	
									if (room.players[room.wait].health >= 3) {
										io.to(room.id).emit('set-health', room.players[room.wait].player_id, room.players[room.wait].character.health, room.players[room.wait].health -= 3);
										
										(function kickTick () {
											getActivePlayers(room).forEach(player => {
												if (player.health <= 0) {
													kickPlayer(io, room, player);
													kickTick();
													return;
												}
											});
										})();
	
										
									} else kickPlayer(io, room, room.players[room.wait]);
	
	
									const modifiers = [];
									room.players.forEach(player => modifiers.push(player.modifiers));
									io.to(room.id).emit('update-modifiers', modifiers);
	
								}, 500);
							} else {
								try { room.players[getActivePlayers(room)[player.player_id + 1].player_id].addModifier(modifier); }
								catch (e) { room.players[getActivePlayers(room)[0].player_id].addModifier(modifier); }
								room.players[player.player_id].modifiers.splice(mod_index, 1);
								
								const modifiers = [];
								room.players.forEach(player => modifiers.push(player.modifiers));
								io.to(room.id).emit('update-modifiers', modifiers);
							}
							io.to(room.id).emit('table', { card_count: room.shuffled.length });
						}, 1000);
					} else if (modifier.card_id == 17) {
						if (room.shuffled >= 1) room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
						else {
							checkShuffled(io, room);
							room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
						}
						room.destroyed.push(room.check_card);
		
						if (room.players[player_id].character.id == 15) {
							if (room.shuffled >= 1) room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
							else {
								checkShuffled(io, room);
								room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
							}
							room.destroyed.push(room.second_check_card);
							io.to(room.id).emit('check-card', player_id, room.check_card, room.second_check_card);
						} else io.to(room.id).emit('check-card', player_id, room.check_card, null);
		
						if (room.check_card.suit != 1) io.to(player.user.id).emit('turn-end');
						else {
							setTimeout(() => {
								player.createMessage().then(message => {
									io.to(room.id).emit('destroy-modifier', player.modifiers[mod_index], message);
									player.modifiers.splice(mod_index, 1);
				
									const modifiers = [];
									room.players.forEach(player => modifiers.push(player.modifiers));
									io.to(room.id).emit('update-modifiers', modifiers);
						
									io.to(room.id).emit('table', { card_count: room.shuffled.length });
								});
							}, 500);
						}
					}
				});
			}
		});
	}

	clearInterval(room.timeout.interval);

	let interval = time;
	room.timeout.interval = setInterval(() => {
		io.to(room.id).emit('wait', player_id, interval, new_turn);
		if (interval <= 0) {
			if (new_turn) {
				io.to(room.id).emit('set-health', room.players[room.turn].player_id, room.players[room.turn].character.health, --room.players[room.turn].health);
				healthModifiers(io, room);
				changeTurn(io, room);
			} else sendWait(io, room, room.turn, 60, true);
		}
		room.timeout.time--;
		interval--;
		if (room.botFlag) clearInterval(room.timeout.interval);
	}, 1000);
}

const sendDistances = (io, room, player, modifier=null) => {
	const player_index = getActivePlayers(room).findIndex(p => p.player_id == player.player_id);
	const divide = Math.ceil(getActivePlayers(room).length / 2);
	let distances = [];

	if (player_index < getActivePlayers(room).length / 2) {
		getActivePlayers(room).forEach((player, index) => {
			if (index < player_index + divide) distances.push(Math.abs(player_index - index));
			else distances.push(Math.abs(index - getActivePlayers(room).length) + player_index);

			if (player.character.id == 0) distances[distances.length - 1] += 1;
		});
	} else {
		getActivePlayers(room).forEach((player, index) => {
			if (index > player_index - divide) distances.push(Math.abs(player_index - index));
			else distances.push(Math.abs(index) + Math.abs(getActivePlayers(room).length - player_index));
			
			if (player.character.id == 0) distances[distances.length - 1] += 1;
		});
	}

	if (modifier) distances.forEach((distance, index) => distances[index] = modifier(distance, index));
	if (player.character.id == 3) distances.forEach((distance, index) => distances[index] = distance > 1 ? distance - 1 : distance);

	room.players[player.player_id].distances = distances;
	io.to(player.user.id).emit('distances', distances);
}

const kickPlayer = (io, room, player) => {
	const foundPlayer = room.players.findIndex(player => player.character.id == 10);

	if (~foundPlayer) {
		player.cards.forEach((card, index) => {
			room.players[foundPlayer].cards.push(room.players[player.player_id].cards[index]);
		});
		player.modifiers.forEach((modifier, index) => {
			room.players[foundPlayer].cards.push(room.players[player.player_id].modifiers[index]);
		});
		io.to(room.players[foundPlayer].user.id).emit('player', room.players[foundPlayer]);
	} else {
		player.cards.forEach((card, index) => {
			room.destroyed.push(room.players[player.player_id].cards[index]);
		});
	}

	const count = [];
	room.players.forEach(player => count.push(player.cards.length));
	io.to(room.id).emit('update-cards-count', count);
	

	if (player.player_id == room.turn) changeTurn(io, room);
	if (player.player_id == room.wait) sendWait(io, room, room.turn, room.timeout.time, true);

	io.to(room.id).emit('kick', player);
	room.players[room.players.findIndex(p => p.player_id == player.player_id)].dead = true;

	getActivePlayers(room).forEach(player => sendDistances(io, room, player));
}

const healthModifiers = (io, room) => {
	if (room.players[room.wait].character.id == 2 && !room.botFlag) {
		const randomCardIndex = Math.floor(Math.random() * room.players[room.turn].cards.length);
		const randomCard = room.players[room.turn].cards[randomCardIndex];

		io.to(room.id).emit('accept-card', room.turn, randomCard, randomCardIndex, room.wait, 'transfer');

		room.players[room.wait].cards.push(randomCard);
		room.players[room.turn].cards.splice(randomCardIndex, 1);
		io.to(room.players[room.turn].user.id).emit('player', room.players[room.turn]);
		io.to(room.players[room.wait].user.id).emit('player', room.players[room.wait]);
	} else if (room.players[room.wait].character.id == 11) {
		sendNewCards(io, room, room.players[room.wait].player_id, 1);
	}

	const count = [];
	room.players.forEach(player => count.push(player.cards.length));
	io.to(room.id).emit('update-cards-count', count);
}

export const initGame = (io, socket, room) => {
	const promises = [];

	room.shuffled = shuffle(cards);
	room.destroyed = [];

	io.to(room.id).emit('room-id', room.id);
	
	if (room.botFlag) {
		room.shuffled[room.shuffled.length - 1] = new BangCard(2, 7);
		room.shuffled[room.shuffled.length - 2] = new BangCard(0, 9);
		room.shuffled[room.shuffled.length - 3] = new MissCard(3, 6);
		room.shuffled[room.shuffled.length - 4] = new BarrelCard(2, 4);

		for (let i = 5; i <= 20; i += 2) {
			room.shuffled[room.shuffled.length - i] = new BangCard(2, 7);
			room.shuffled[room.shuffled.length - i - 1] = new BangCard(0, 9);
		}


		[3, 3, 0].forEach((role, index) => {
			let character_id = 9;
			if (index == 1) character_id = 1;
			else if (index == 2) character_id = 2;

			room.turn = 0;
			const player = new Player(character_id, { name: room.users[index].name, rating: room.users[index].rating, id: room.sockets[index] }, index, characters[character_id].health, role, [], []);
				
			for (let i = 0; i < player.health; i++) {
				player.cards.push(room.shuffled[room.shuffled.length - 1]);
				room.shuffled.pop();
			}
			
			promises.push(player.createBotMessage());
			room.players.push(player);
		});
	} else {
		room.shuffled[room.shuffled.length - 1] = new BangCard(3, 6);
		// shuffle(roles).forEach((role, index) => {
		[3, 3, 0].forEach((role, index) => {
			const character_id = index;
			room.turn = 0;
			const player = new Player(character_id, { name: room.users[index].username, rating: room.users[index].rating, photo: room.users[index].photo, gameId: room.users[index].gameId, id: room.users[index].socketId }, index, characters[character_id].health, role, [], []);
			
			for (let i = 0; i < player.health; i++) {
				player.cards.push(room.shuffled[room.shuffled.length - 1]);
				room.shuffled.pop();
			}
			promises.push(player.createMessage());
			room.players.push(player);
		});
	}
	

	Promise.all(promises).then(players => {
		io.to(room.id).emit('board', players);
		io.to(room.id).emit('table', { card_count: room.shuffled.length, last_card: null });

		room.players.forEach(player => {
			player.shootDistance = 1;
			player.weapon = null;
			io.to(player.user.id).emit('player', player);
		});

		getActivePlayers(room).forEach(player => {
			sendDistances(io, room, player);
		});

		sendTurn(io, room);
		sendWait(io, room, room.turn, 60, true);
	});
}

export const startGame = async (io, socket, room) => {
	socket.on('turn-end', (player, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[player.player_id].gameId) return;
		if (room.shop.cards.length > 0 || room.indians.len > 0 || room.duel.interval != null) return;

		if (player.player_id == room.turn && player.player_id == room.wait) changeTurn(io, room);
		if (player.player_id == room.wait) {
			io.to(room.id).emit('set-health', room.players[room.wait].player_id, room.players[room.wait].character.health, --room.players[room.wait].health);
			healthModifiers(io, room);

			sendWait(io, room, room.turn, room.timeout.time, true);
		}
	});

	socket.on('leave', (player, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[player.player_id].gameId) return;
		if (room.shop.cards.length > 0 || room.indians.len > 0 || room.duel.interval != null) return;
		io.to(room.id).emit('choose-player', room.player_choosed = -1);
		kickPlayer(io, room, player);
	});

	socket.on('get-shop-card', (card, sender, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		(function getShopCard (card, sender) {
			if (room.shop.cards.length == 0) return;

			if (sender == room.shop.wait) {
				clearTimeout(room.shop.interval);
	
				room.players[room.shop.wait].cards.push(card);
				io.to(room.players[room.shop.wait].user.id).emit('player', room.players[room.shop.wait]);
				io.to(room.id).emit('accept-card', room.shop.wait, card, room.shop.cards.findIndex(item => item.card_id == card.card_id && item.suit == card.suit && item.rank == card.rank), room.shop.wait, 'shop');
				
				room.shop.cards.splice(room.shop.cards.findIndex(item => item.title == card.title && item.suit == card.suit && item.rank == card.rank), 1);
	
				if (room.shop.cards.length == 0) {
					clearTimeout(room.shop.interval);
					io.to(room.id).emit('shop-end');
					sendWait(io, room, room.wait, 60, true);
					return;
				}

				const count = [];
				room.players.forEach(player => count.push(player.cards.length));
				io.to(room.id).emit('update-cards-count', count);

				if (room.shop.wait < getActivePlayers(room).length - 1) io.to(room.id).emit('shop-card', getActivePlayers(room)[room.shop.wait + 1].player_id, room.shop.cards);
				else io.to(room.id).emit('shop-card', getActivePlayers(room)[0].player_id, room.shop.cards);

				if (room.shop.wait < getActivePlayers(room).length - 1) room.shop.wait = getActivePlayers(room)[room.shop.wait + 1].player_id;
				else room.shop.wait = getActivePlayers(room)[0].player_id;

				room.shop.interval = setTimeout(() => {
					const randomCardIndex = Math.floor(Math.random() * room.shop.cards.length);
					if (room.shop.wait < getActivePlayers(room).length) getShopCard(room.shop.cards[randomCardIndex], getActivePlayers(room)[room.shop.wait].player_id);
					else getShopCard(room.shop.cards[randomCardIndex], getActivePlayers(room)[0].player_id);
				}, 10000);
			}
		})(card, sender);
	});

	socket.on('indians-send', (sender, card, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		(function sendIndians (sender, from_player=true) {
			if (sender == room.indians.wait) {
				clearTimeout(room.indians.interval);

				const card_index = room.players[room.indians.wait].cards.findIndex(item => item.card_id == card.card_id && item.suit == card.suit && item.rank == card.rank)

				if (from_player) {
					io.to(room.id).emit('accept-card', room.indians.wait, card, card_index, room.indians.wait, 'indians');
					room.players[room.indians.wait].cards.splice(card_index, 1)
					io.to(room.players[room.indians.wait].user.id).emit('player', room.players[room.indians.wait]);
				}
	
				if (room.indians.len == 0) {
					clearTimeout(room.indians.interval);
					io.to(room.id).emit('indians-end');
					sendWait(io, room, room.wait, 60, true);
					return;
				}

				const count = [];
				room.players.forEach(player => count.push(player.cards.length));
				io.to(room.id).emit('update-cards-count', count);
				
				if (room.indians.wait < getActivePlayers(room).length - 1) io.to(room.id).emit('indians-release', getActivePlayers(room)[room.indians.wait + 1].player_id);
				else io.to(room.id).emit('indians-release', getActivePlayers(room)[0].player_id);

				if (room.indians.wait < getActivePlayers(room).length - 1) room.indians.wait = getActivePlayers(room)[room.indians.wait + 1].player_id;
				else room.indians.wait = getActivePlayers(room)[0].player_id;

				room.indians.interval = setTimeout(() => {
					io.to(room.id).emit('set-health', room.players[room.indians.wait].player_id, room.players[room.indians.wait].character.health, --room.players[room.indians.wait].health);
					healthModifiers(io, room);
					sendIndians(room.indians.wait, false);
				}, 5000);
				
				room.indians.len--;
			}
		})(sender);
	});

	socket.on('duel-send', (sender, card, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		(function sendDuel () {
			if (sender == room.duel.players[room.duel.wait]) {
				clearTimeout(room.duel.interval);

				const card_index = room.players[room.duel.players[room.duel.wait]].cards.findIndex(item => item.card_id == card.card_id && item.suit == card.suit && item.rank == card.rank)


				io.to(room.id).emit('accept-card', room.duel.players[room.duel.wait].player_id, card, card_index, room.duel.players[room.duel.wait].player_id, 'indians');
				room.players[room.duel.players[room.duel.wait]].cards.splice(card_index, 1)
				io.to(room.players[room.duel.players[room.duel.wait]].user.id).emit('player', room.players[room.duel.players[room.duel.wait]]);


				const count = [];
				room.players.forEach(player => count.push(player.cards.length));
				io.to(room.id).emit('update-cards-count', count);
				
				if (room.duel.wait == 0) io.to(room.id).emit('duel-release', room.duel.players[1]);
				else io.to(room.id).emit('duel-release', room.duel.players[0]);

				if (room.duel.wait == 0) room.duel.wait = 1;
				else room.duel.wait = 0;

				room.duel.interval = setTimeout(() => {
					io.to(room.id).emit('set-health', room.players[room.duel.players[room.duel.wait]].player_id, room.players[room.duel.players[room.duel.wait]].character.health, --room.players[room.duel.players[room.duel.wait]].health);
					healthModifiers(io, room);
					clearTimeout(room.duel.interval);
					room.duel.interval = null;
					sendWait(io, room, room.wait, 60, true);
				}, 5000);
			}
		})();
	});

	socket.on('delete-card', (sender, card, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		if (!card) return;
		const card_index = room.players[sender.player_id].cards.findIndex(item => card.title == item.title && card.modifier == item.modifier && card.suit == item.suit && card.rank == item.rank);
		
		if (~card_index) {
			if (room.players[sender.player_id].dead == false) {
				if (room.turn == room.players[sender.player_id].player_id) {
					if (room.health_cards == 1 && room.players[sender.player_id].health < room.players[sender.player_id].character.health)
						io.to(room.id).emit('set-health', room.players[sender.player_id].player_id, room.players[sender.player_id].character.health, ++room.players[sender.player_id].health);

					room.destroyed.push(room.players[sender.player_id].cards[card_index]);
					room.players[sender.player_id].cards.splice(card_index, 1);
					io.to(room.id).emit('accept-card', sender.player_id, card, card_index, sender.player_id, 'remove');
					io.to(room.players[sender.player_id].user.id).emit('player', room.players[sender.player_id]);

					const count = [];
					room.players.forEach(player => count.push(player.cards.length));
					io.to(room.id).emit('update-cards-count', count);

					room.health_cards++;
					if (room.health_cards == 2) room.health_cards = 0;
				}
			}
		}
	});

	socket.on('change-card', (sender, card, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		const card_index = room.players[sender.player_id].cards.findIndex(item => card.title == item.title && card.modifier == item.modifier && card.suit == item.suit && card.rank == item.rank);
		
		if (~card_index) {
			if (room.players[sender.player_id].dead == false) {
				if (room.turn == room.players[sender.player_id].player_id || room.wait == room.players[sender.player_id].player_id) {
					const card_define = room.players[sender.player_id].cards[card_index];

					if (card_define.card_id == 5) room.players[sender.player_id].cards[card_index] = new MissCard(card_define.suit, card_define.rank);
					else if (card_define.card_id == 6) room.players[sender.player_id].cards[card_index] = new BangCard(card_define.suit, card_define.rank);

					io.to(room.players[sender.player_id].user.id).emit('player', room.players[sender.player_id]);
				}
			}
		}
	});

	socket.on('choose-from-three-send', (sender, card, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		if (sender == room.wait) {
			const card_index = room.choose_cards.findIndex(item => item.card_id == card.card_id && item.suit == card.suit && item.rank == card.rank);
			if (~card_index) {

				if (room.choose_three_cards.length < 2) {
					room.choose_three_cards.push(room.players[sender].cards[card_index]);
					io.to(room.id).emit('accept-card', sender.player_id, card, card_index, sender.player_id, 'choose-three');
					room.players[sender].cards.push(card)	;
					io.to(room.players[sender].user.id).emit('player', room.players[sender]);
				}

				if (room.choose_three_cards.length == 2) {
					room.choose_three_cards = [];
					io.to(room.id).emit('choose-end');
				}

				room.choose_cards.splice(card_index, 1);

				const count = [];
				room.players.forEach(player => count.push(player.cards.length));
				io.to(room.id).emit('update-cards-count', count);
			}
		}
	});

	socket.on('check-card-choose', (sender, card, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		if (sender == room.wait) {
			if (card.card_id == room.check_card.card_id && card.suit == room.check_card.suit && card.rank == room.check_card.rank) {
				const mod_index = room.players[sender].modifiers.findIndex(item => room.check_card.title == item.title && room.check_card.modifier == item.modifier && room.check_card.suit == item.suit && room.check_card.rank == item.rank);
				if (room.check_card.suit == 1) sendWait(io, room, room.turn, 60, true);
				else io.to(room.players[sender].user.id).emit('turn-end');
	
				io.to(room.id).emit('destroy-modifier', room.players[sender].modifiers[mod_index], sender);
				room.players[sender].modifiers.splice(mod_index, 1);

				const modifiers = [];
				room.players.forEach(player => modifiers.push(player.modifiers));
				io.to(room.id).emit('update-modifiers', modifiers);

				io.to(room.id).emit('table', { card_count: room.shuffled.length });
				room.cancel_cards++;

				io.to(room.id).emit('accept-card', sender.player_id, card, 0, sender.player_id, 'choose');
			} else if (card.card_id == room.second_check_card.card_id && card.suit == room.second_check_card.suit && card.rank == room.second_check_card.rank) {
				const mod_index = room.players[sender].modifiers.findIndex(item => room.second_check_card.title == item.title && room.second_check_card.modifier == item.modifier && room.second_check_card.suit == item.suit && room.second_check_card.rank == item.rank);
				if (room.second_check_card.suit == 1) sendWait(io, room, room.turn, 60, true);
				else io.to(room.players[sender].user.id).emit('turn-end');
	
				io.to(room.id).emit('destroy-modifier', room.players[sender].modifiers[mod_index], sender);
				room.players[sender].modifiers.splice(mod_index, 1);

				const modifiers = [];
				room.players.forEach(player => modifiers.push(player.modifiers));
				io.to(room.id).emit('update-modifiers', modifiers);

				io.to(room.id).emit('table', { card_count: room.shuffled.length });
				room.cancel_cards++;

				io.to(room.id).emit('accept-card', sender.player_id, card, 1, sender.player_id, 'choose');
			}
			io.to(room.id).emit('choose-end');
		}
	});


	socket.on('choose-destroyed', (choose, sender, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		if (!room.players[sender].dead) {
			if (room.players[sender].character.id == 6) {
				if (choose == false && room.destroyed.length == 0) return;
				io.to(room.players[sender].user.id).emit('choose-destroyed', choose);
				room.destroyed_choosed = choose;
			}
		}
	});

	socket.on('choose-player', (sender, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;
		if (!room.players[sender].dead) {
			if (room.players[sender].character.id == 12) {
				if (room.player_choosed == -1) io.to(room.players[sender].user.id).emit('choose-player', ++room.player_choosed);
				else {
					if (room.player_choosed < getActivePlayers(room).length - 1) io.to(room.players[sender].user.id).emit('choose-player', ++room.player_choosed);
					else io.to(room.players[sender].user.id).emit('choose-player', room.player_choosed = -1);
				}
			}
		}
	});

	

	socket.on('play-card', (sender, card, player, session) => {
		if (!~room.users.findIndex(item => item.session == session) && room.users.find(item => item.session == session).gameId == room.players[sender.player_id].gameId) return;

		function updateCardsCount (room) {
			const count = [];
			room.players.forEach(player => count.push(player.cards.length));
			io.to(room.id).emit('update-cards-count', count);
		}

		function updateModifiers (room) {
			const modifiers = [];
			room.players.forEach(player => modifiers.push(player.modifiers));
			io.to(room.id).emit('update-modifiers', modifiers);
		}

		function destroyCard (index, check=false) {
			if (check) {
				if (~room.turn_cards.findIndex(item => card.title == item.title)) { io.to(sender.user.id).emit('decline-card', 'Card repeats'); return false; }
				else room.turn_cards.push(card);
			}
			
			room.destroyed.push(room.players[sender.player_id].cards[index]);
			room.players[sender.player_id].cards.splice(index, 1);
			io.to(room.id).emit('accept-card', sender.player_id, card, index, player.player_id, 'destroy');
			return true;
		}
		
		if (room.wait == sender.player_id) {
			const card_index = room.players[sender.player_id].cards.findIndex(item => card.title == item.title && card.modifier == item.modifier && card.suit == item.suit && card.rank == item.rank);
			const mod_index = room.players[sender.player_id].modifiers.findIndex(item => card.title == item.title && card.modifier == item.modifier && card.suit == item.suit && card.rank == item.rank);
			
			if (room.shop.cards.length > 0 || room.indians.len > 0) return;

			if (~card_index || ~mod_index) {
				if (player.dead == false) {
					if (room.wait != room.turn) {
						room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card });
						if (card.card_id == 6) {
							if (room.players[room.turn].character.id == 1) {
								if (room.cancel_cards == 0) {
									sendWait(io, room, room.wait, 30, false);
									destroyCard(card_index);
									room.cancel_cards++;
								} else {
									sendWait(io, room, room.turn, 60, true);
									destroyCard(card_index);
								}
							} else {
								sendWait(io, room, room.turn, 60, true);
								destroyCard(card_index);
							}
						} else if (card.card_id == 9) {
							if (sender.health == 1) {
								sendWait(io, room, room.turn, 60, true);
								io.to(room.id).emit('set-health', room.players[room.wait].player_id, room.players[room.wait].character.health, ++room.players[room.wait].health);

								destroyCard(card_index);
							}
						} else if (card.card_id == 19) {
							if (room.shuffled >= 1) room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
							else {
								checkShuffled(io, room);
								room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
							}
							room.destroyed.push(room.check_card);

							if (room.players[sender.player_id].character.id == 15) {
								if (room.shuffled >= 1) room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
								else {
									checkShuffled(io, room);
									room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
								}
								room.destroyed.push(room.second_check_card);
								io.to(room.id).emit('check-card', sender.player_id, room.check_card, room.second_check_card);
							} else {
								io.to(room.id).emit('check-card', sender.player_id, room.check_card, null);


								if (room.check_card.suit == 1) sendWait(io, room, room.turn, 60, true);
								else io.to(sender.user.id).emit('turn-end');
	
								setTimeout(() => {
									io.to(room.id).emit('destroy-modifier', room.players[sender.player_id].modifiers[mod_index], sender);
									room.players[sender.player_id].modifiers.splice(mod_index, 1);
								
									updateModifiers(room);
								
									io.to(room.id).emit('table', { card_count: room.shuffled.length });
								}, 800);
								room.cancel_cards++;
							}
						}
					} else {
						if (card.modifier && player.player_id == sender.player_id) {
							let dynamite_found = false;
							getActivePlayers(room).forEach(player => player.modifiers.forEach(modifier => { if (modifier.card_id == 18) dynamite_found = true; }));
							if (card.card_id == 18 && dynamite_found) return;

							if (~room.turn_cards.findIndex(item => card.title == item.title)) { io.to(sender.user.id).emit('decline-card', 'Card repeats'); return; }
							else room.turn_cards.push(card);
							if (~room.players[player.player_id].modifiers.findIndex(item => card.title == item.title)) { io.to(sender.user.id).emit('decline-card', 'Card repeats'); return; }

							room.players[sender.player_id].cards.splice(card_index, 1);
							io.to(room.id).emit('accept-card', sender.player_id, card, card_index, player.player_id, 'modifier');

							const modifier_index = room.players[sender.player_id].modifiers.findIndex(item => item.card_id <= 4);
							if (~modifier_index && card.card_id <= 4) {
								io.to(room.id).emit('accept-card', sender.player_id, room.players[sender.player_id].modifiers[modifier_index], modifier_index, player.player_id, 'release');
								room.players[sender.player_id].modifiers.splice(player.modifiers.findIndex(item => item.card_id <= 4), 1);
							}

							if (card.card_id == 0) room.players[sender.player_id].shootDistance = 2;
							else if (card.card_id == 1) {
								if (~room.turn_cards.findIndex(item => item.card_id == 5)) room.turn_cards.splice(room.turn_cards.findIndex(item => item.card_id == 5), 1);
								room.players[sender.player_id].shootDistance = 1;
								if (~room.turn_cards.findIndex(item => item.card_id == 5)) room.turn_cards.splice(room.turn_cards.findIndex(item => item.card_id == 5), 1);
							} else if (card.card_id == 2) room.players[sender.player_id].shootDistance = 3;
							else if (card.card_id == 3) room.players[sender.player_id].shootDistance = 4;
							else if (card.card_id == 4) room.players[sender.player_id].shootDistance = 5;						


							io.to(sender.user.id).emit('update-shoot-distance', room.players[sender.player_id].shootDistance);

							room.players[sender.player_id].addModifier(card);
	
							updateModifiers(room);
							

							if (card.card_id == 18) {
								if (room.shuffled >= 1) room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
								else {
									checkShuffled(io, room);
									room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
								}
								room.destroyed.push(room.check_card);

								io.to(room.id).emit('table', { card_count: room.shuffled.length });
				
								if (room.players[sender.player_id].character.id == 15) {
									if (room.shuffled >= 1) room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
									else {
										checkShuffled(io, room);
										room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
									}
									room.destroyed.push(room.second_check_card);
									io.to(room.id).emit('check-card', sender.player_id, room.check_card, room.second_check_card);
								} else io.to(room.id).emit('check-card', sender.player_id, room.check_card, null);

								const dynamite_index = room.players[player.player_id].modifiers.findIndex(item => item.title == card.title && item.rank == card.rank && item.suit == card.suit);
								setTimeout(() => {
									if (room.check_card.suit == 3 && room.check_card.rank >= 2 && room.check_card.rank <= 9) {
										setTimeout(() => {
											io.to(room.id).emit('destroy-modifier', room.players[player.player_id].modifiers[dynamite_index], player);
											player.modifiers.splice(dynamite_index, 1);
	
											if (room.players[room.wait].health >= 3) {
												io.to(room.id).emit('set-health', room.players[room.wait].player_id, room.players[room.wait].character.health, room.players[room.wait].health -= 3);
												
												(function kickTick () {
													getActivePlayers(room).forEach(player => {
														if (player.health <= 0) {
															kickPlayer(io, room, player);
															kickTick();
															return;
														}
													});
												})();

											} else kickPlayer(io, room, room.players[room.wait]);

											updateModifiers(room);
										}, 500);
									} else {
										try { room.players[getActivePlayers(room)[player.player_id + 1].player_id].addModifier(card); }
										catch (e) { room.players[getActivePlayers(room)[0].player_id].addModifier(card); }
										room.players[player.player_id].modifiers.splice(dynamite_index, 1);
										updateModifiers(room);
									}
								}, 1000);
							}

							if (card.card_id == 20) sendDistances(io, room, sender, distance => distance > 1 ? distance - 1 : distance);
							else if (card.card_id == 21) {
								room.players.forEach(player => {
									if (player.player_id != sender.player_id) sendDistances(io, room, player, (distance, index) => index == sender.player_id ? distance + 1 : distance);
								});
							}

							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
						} else if (card.modifier && player.player_id != sender.player_id) {
							if (card.card_id == 17 && room.players[player.player_id].role != 0) {
								let prison_found = false;
								getActivePlayers(room).forEach(player => player.modifiers.forEach(modifier => { if (modifier.card_id == 17) prison_found = true; }));
								if (prison_found) return;

								if (~room.players[player.player_id].modifiers.findIndex(item => card.title == item.title)) { io.to(sender.user.id).emit('decline-card', 'Card repeats'); return; }
								
								room.players[player.player_id].addModifier(card);
								io.to(room.id).emit('accept-card', sender.player_id, card, card_index, player.player_id, 'prison');
								room.players[sender.player_id].cards.splice(card_index, 1);
								io.to(room.players[sender.player_id].user.id).emit('player', room.players[sender.player_id]);
								updateModifiers(room);
								room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
							}
						} else if (card.card_id == 9) {
							if (sender.health < sender.character.health) {
								io.to(room.id).emit('set-health', room.players[room.wait].player_id, room.players[room.wait].character.health, ++room.players[room.wait].health);
								io.to(room.id).emit('accept-card', sender.player_id, card, card_index, player.player_id, 'destroy');
								destroyCard(card_index);
								room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
							} else io.to(sender.user.id).emit('decline-card', 'Full health');
						} else if (card.card_id == 12) {
							if (room.players[player.player_id].cards.length > 0) {
								destroyCard(card_index);
								const randomCardIndex = Math.floor(Math.random() * room.players[player.player_id].cards.length);
								const randomCard = room.players[player.player_id].cards[randomCardIndex];

								io.to(room.id).emit('accept-card', player.player_id, randomCard, randomCardIndex, player.player_id, 'remove');

								room.players[player.player_id].cards.splice(randomCardIndex, 1);
								io.to(room.players[player.player_id].user.id).emit('player', room.players[player.player_id]);
								room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
							} else io.to(sender.user.id).emit('decline-card', 'Not enough cards');
						} else if (card.card_id == 13) {
							destroyCard(card_index);

							room.players.forEach(player => {
								if (room.players[player.player_id].health < room.players[player.player_id].character.health)
									io.to(room.id).emit('set-health', room.players[player.player_id].player_id, room.players[player.player_id].character.health, ++room.players[player.player_id].health);
							});

							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
						} else if (card.card_id == 14) {
							destroyCard(card_index);
							room.duel.players = [sender.player_id, player.player_id];
							room.duel.wait = 1;

							clearInterval(room.timeout.interval);

							io.to(room.id).emit('duel-release', room.duel.players[room.duel.wait]);

							room.duel.interval = setTimeout(() => {
								io.to(room.id).emit('set-health', room.players[room.duel.players[1]].player_id, room.players[room.duel.players[1]].character.health, --room.players[room.duel.players[1]].health);
								healthModifiers(io, room);
								clearTimeout(room.duel.interval);
								room.duel.interval = null;
								sendWait(io, room, room.wait, 60, true);
							}, 5000);

							updateCardsCount(room);
							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
						} else if (card.card_id == 15) {
							destroyCard(card_index);
							room.shop.wait = sender.player_id;
							room.shop.cards = [];

							clearInterval(room.timeout.interval);

							checkShuffled(io, room);
							for (let i = 0; i < getActivePlayers(room).length; i++) room.shop.cards.push(room.shuffled[room.shuffled.length - i - 1]);
							if (room.shuffled.length >= getActivePlayers(room).length) room.shuffled.splice(room.shuffled.length - getActivePlayers(room).length, getActivePlayers(room).length);
							else {
								checkShuffled(io, room);
								room.shuffled.splice(room.shuffled.length - getActivePlayers(room).length, getActivePlayers(room).length);
							}
							io.to(room.id).emit('table', { card_count: room.shuffled.length });
							io.to(room.id).emit('shop-card', sender.player_id, room.shop.cards);

							room.shop.interval = setTimeout(() => {
								const randomCardIndex = Math.floor(Math.random() * room.shop.cards.length);
								getShopCard(room.shop.cards[randomCardIndex], room.players[room.shop.wait]);
							}, 10000);

							updateCardsCount(room);
							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});

							function getShopCard (card, sender) {
								if (room.shop.cards.length == 0) return;
								clearTimeout(room.shop.interval);
						
								room.players[room.shop.wait].cards.push(card);
								io.to(room.players[room.shop.wait].user.id).emit('player', room.players[room.shop.wait]);
								io.to(room.id).emit('accept-card', room.shop.wait, card, room.shop.cards.findIndex(item => item.card_id == card.card_id && item.suit == card.suit && item.rank == card.rank), room.shop.wait, 'shop');
								room.shop.cards.splice(room.shop.cards.findIndex(item => item.title == card.title && item.suit == card.suit && item.rank == card.rank), 1);
					
								if (room.shop.cards.length == 0) {
									clearTimeout(room.shop.interval);
									io.to(room.id).emit('shop-end');
									sendWait(io, room, room.wait, 60, true);
									return;
								}
								
								if (room.shop.wait < getActivePlayers(room).length - 1) io.to(room.id).emit('shop-card', getActivePlayers(room)[room.shop.wait + 1].player_id, room.shop.cards);
								else io.to(room.id).emit('shop-card', getActivePlayers(room)[0].player_id, room.shop.cards);

								if (room.shop.wait < getActivePlayers(room).length - 1) room.shop.wait = getActivePlayers(room)[room.shop.wait + 1].player_id;
								else room.shop.wait = getActivePlayers(room)[0].player_id;

								room.shop.interval = setTimeout(() => {
									const randomCardIndex = Math.floor(Math.random() * room.shop.cards.length);
									if (room.shop.wait < getActivePlayers(room).length - 1) getShopCard(room.shop.cards[randomCardIndex], getActivePlayers(room)[room.shop.wait + 1].player_id);
									else getShopCard(room.shop.cards[randomCardIndex], getActivePlayers(room)[0].player_id);
								}, 3000);

								updateCardsCount(room);
							}
						} else if (card.card_id == 16) {
							destroyCard(card_index);
							if (sender.player_id < getActivePlayers(room).length - 1) room.indians.wait = getActivePlayers(room)[sender.player_id + 1].player_id;
							else room.indians.wait = getActivePlayers(room)[0].player_id;

							room.indians.len = 4;

							clearInterval(room.timeout.interval);

							io.to(room.id).emit('indians-release', room.indians.wait);

							room.indians.interval = setTimeout(() => {
								sendIndians();
							}, 5000);

							updateCardsCount(room);
							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});

							function sendIndians () {
								clearTimeout(room.indians.interval);

								io.to(room.id).emit('set-health', room.players[room.indians.wait].player_id, room.players[room.indians.wait].character.health, --room.players[room.indians.wait].health);
								healthModifiers(io, room);

								if (room.indians.len == 0) {
									clearTimeout(room.indians.interval);
									sendWait(io, room, room.wait, 60, true);
									return;
								}
								
								if (room.indians.wait < getActivePlayers(room).length - 1) io.to(room.id).emit('indians-release', getActivePlayers(room)[room.indians.wait + 1].player_id);
								else io.to(room.id).emit('indians-release', getActivePlayers(room)[0].player_id);

								if (room.indians.wait < getActivePlayers(room).length - 1) room.indians.wait = getActivePlayers(room)[room.indians.wait + 1].player_id;
								else room.indians.wait = getActivePlayers(room)[0].player_id;

								room.indians.interval = setTimeout(() => {
									sendIndians();
								}, 5000);

								updateCardsCount(room);
								room.indians.len--;
							}
						} else if (card.card_id == 7) {
							destroyCard(card_index);
							sendNewCards(io, room, room.turn, 2);
							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
						} else if (card.card_id == 8) {
							destroyCard(card_index);
							sendNewCards(io, room, room.turn, 3);
							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
						} else if (card.card_id == 11) {
							if (room.players[player.player_id].distances[sender.player_id] <= 1 && room.players[player.player_id].cards.length > 0) {
								destroyCard(card_index);
								const randomCardIndex = Math.floor(Math.random() * room.players[player.player_id].cards.length);
								const randomCard = room.players[player.player_id].cards[randomCardIndex];

								io.to(room.id).emit('accept-card', player.player_id, randomCard, randomCardIndex, sender.player_id, 'transfer');
								io.to(room.id).emit('accept-card', sender.player_id, card, card_index, player.player_id, 'destroy');
								
								room.players[sender.player_id].cards.push(randomCard);
								room.players[player.player_id].cards.splice(randomCardIndex, 1);
								io.to(room.players[sender.player_id].user.id).emit('player', room.players[sender.player_id]);
								io.to(room.players[player.player_id].user.id).emit('player', room.players[player.player_id]);
								room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
							}
						} else if (card.card_id == 10) {
							room.players.forEach(player_iter => {
								if (player_iter.player_id != player.player_id) {
									io.to(room.id).emit('set-health', player_iter.player_id, player_iter.character.health, --player_iter.health);
								}
							});
							room.destroyed.push(room.players[sender.player_id].cards[card_index]);
							room.players[sender.player_id].cards.splice(card_index, 1);
							io.to(room.players[sender.player_id].user.id).emit('player', room.players[sender.player_id]);
							io.to(room.id).emit('accept-card', player.player_id, card, card_index, player.player_id, 'remove');
							room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
						} else if (card.card_id == 5) {
							if (room.players[sender.player_id].distances[player.player_id] <= room.players[sender.player_id].shootDistance) {
								if (~room.players[sender.player_id].modifiers.findIndex(modifier => modifier.card_id == 1) || room.players[sender.player_id].character.id == 14) {
									room.cancel_cards = 0;
									room.destroyed.push(room.players[sender.player_id].cards[card_index]);
									io.to(room.id).emit('accept-card', sender.player_id, card, card_index, player.player_id, 'destroy');
									room.players[sender.player_id].cards.splice(card_index, 1);
									io.to(room.players[sender.player_id].user.id).emit('player', room.players[sender.player_id]);
									room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});
									
									if (player.character.id == 13) {
										if (room.shuffled >= 1) room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
										else {
											checkShuffled(io, room);
											room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
										}
										room.destroyed.push(room.check_card);
						
										if (room.players[sender.player_id].character.id == 15) {
											if (room.shuffled >= 1) room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
											else {
												checkShuffled(io, room);
												room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
											}
											room.destroyed.push(room.second_check_card);
											io.to(room.id).emit('check-card', sender.player_id, room.check_card, room.second_check_card);
										} else io.to(room.id).emit('check-card', sender.player_id, room.check_card, null);
						
										if (room.check_card.suit != 1) { sendWait(io, room, player.player_id, 30, false); room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});}
									} else { sendWait(io, room, player.player_id, 30, false); room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card}); }
								} else if (destroyCard(card_index, true)) {
									if (player.character.id == 13) {
										if (room.shuffled >= 1) room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
										else {
											checkShuffled(io, room);
											room.check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
										}
										room.destroyed.push(room.check_card);
						
										if (room.players[sender.player_id].character.id == 15) {
											if (room.shuffled >= 1) room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
											else {
												checkShuffled(io, room);
												room.second_check_card = room.shuffled.splice(room.shuffled.length - 1, 1)[0];
											}
											room.destroyed.push(room.second_check_card);
											io.to(room.id).emit('check-card', sender.player_id, room.check_card, room.second_check_card);
										} else io.to(room.id).emit('check-card', sender.player_id, room.check_card, null);
										
										if (room.check_card.suit != 1) { sendWait(io, room, player.player_id, 30, false); room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card});}
									} else { sendWait(io, room, player.player_id, 30, false); room.history[room.history.length - 1].push({ sender: sender.player_id, target: player.player_id, card: card}); }
								}
							}
						}
					}
					updateCardsCount(room);
				} else io.to(sender.user.id).emit('decline-card', 'Target is dead');
			} else io.to(sender.user.id).emit('decline-card', 'Invalid card');
		} else io.to(sender.user.id).emit('decline-card', 'Invalid turn');

		room.players.forEach(player => {
			if (player.character.id == 7) {
				if (player.cards.length == 0) sendNewCards(io, room, player.player_id, 1);
			}
		});
	});

	socket.on('history', () => socket.emit('history', room.history));
}