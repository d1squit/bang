const session = localStorage.getItem('session');
let socket = io.connect('', { query: `session=${session}&extra=start-game` });

let myPlayer = null;
let boardPlayers = [];
let temp_card = null;
let current_wait = null;
let current_turn = null;
let destroyed_choosed = false;
let player_choosed = -1;
let search = false;
let isLearning = false;

const board = document.querySelector('#board');
const info = document.querySelector('#info');
const cards = document.querySelector('.cards-bottom');

socket.on('disconnect', () => location.href = './lobby.html');


const mask = document.querySelector('.mask');

function createLearnElement (element, text, infoMode=false, timeout=500) {
	return new Promise ((resolve, reject) => {
		setTimeout(() => {
			element = eval(element);
			const elementRect = element.getBoundingClientRect();
			const textElement = document.createElement('h4');
			textElement.textContent = text;
			textElement.classList.add('mask-text');
			textElement.style.left = elementRect.x + elementRect.width + 20 + 'px';
			textElement.style.top = elementRect.y + 'px';
			document.body.appendChild(textElement);

			mask.classList.add('activate');
			element.classList.add('learn-selected');

			end = () => {
				document.body.removeChild(textElement);
				document.querySelectorAll('.learn-selected').forEach(item => item.classList.remove('learn-selected'));
				mask.classList.remove('activate');
				mask.removeEventListener('click', end);
				element.removeEventListener('click', end);
				resolve();
			}

			if (infoMode) {
				mask.addEventListener('click', end);
				element.addEventListener('click', end);
			} else element.addEventListener('click', end);
		}, timeout);
	});
}

function learnStep (step=0) {
	mask.style.display = 'block';
	if (learn[step].command && learn[step].text) {
		learn[step].command().then(() => {
			createLearnElement(learn[step].element, learn[step].text, learn[step].info, learn[step].time).then(() => {
				if (step < learn.length - 1) learnStep(++step);
				else mask.style.display = 'none';
			});
		});
	} else if (learn[step].command) {
		learn[step].command().then(() => {
			if (step < learn.length - 1) learnStep(++step);
			else mask.style.display = 'none';
		});
	} else if (learn[step].text) {
		createLearnElement(learn[step].element, learn[step].text, learn[step].info, learn[step].time).then(() => {
			if (step < learn.length - 1) learnStep(++step);
			else mask.style.display = 'none';
		});
	}
}

// -------------------------- HISTORY ------------------------------ //

const historyBlockHtml = `<div class="history-block"><h2 class="history-block-title"></h2></div>`;
const historyMoveHtml = `<h2 class="history-move"></h2>`;

let historyActivate = false;

document.querySelector('.history__button').addEventListener('click', () => socket.emit('history'));


// const cards_ru = ['Скофилд', 'Ярость', 'Ремингтон', 'Карабин', 'Винчестер', 'Бэнг', 'Промах', 'Дилижанс', 'Уэллс-Фарго', 'Пиво', 'Гатлинг',
// 				  'Паника!', 'Плутовка Кэт', 'Салун', 'Дуэль', 'Магазин', 'Индейцы', 'Тюрьма', 'Динамит', 'Бочка', 'Аппалуза', 'Мустанг'];

socket.on('history', history => {
	console.log(history);

	document.querySelector('.history').innerHTML = '';
	
	history.slice().reverse().forEach((block, index) => {
		if (block.length == 0) return;
		document.querySelector('.history').innerHTML += historyBlockHtml;
		const length = document.querySelectorAll('.history-block-title').length;
		document.querySelectorAll('.history-block-title')[length - 1].textContent = 'Ход ' + (history.length - index);

		block.forEach((move, index) => {
			document.querySelector('.history-block:last-child').innerHTML += historyMoveHtml;
			if (move.sender == myPlayer.player_id) {
				document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += `<span>Вы</span>`;

				if (move.card.card_id == 7) document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += ` берете 2 карты из колоды`;
				else if (move.card.card_id == 8) document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += ` берете 3 карты из колоды`;
				else document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += `играете ${move.card.title} (${[1,2,3,4,5,6,7,8,9,10,'J','Q','K','A'][move.card.rank]}${['♦', '♥', '♣', '♠'][move.card.suit]})`;

				if (move.card.card_id == 5 || move.card.card_id == 11 || move.card.card_id == 12 || move.card.card_id == 14 || move.card.card_id == 17)
					document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += `&nbspи выбираете игрока ${boardPlayers[move.target].user.name} в качестве цели`;
			} else {
				document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += `<span>${boardPlayers[move.sender].user.name}</span>`;

				if (move.card.card_id == 7) document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += ` берет 2 карты из колоды`;
				else if (move.card.card_id == 8) document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += ` берет 3 карты из колоды`;
				else document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += `играет ${move.card.title} (${[1,2,3,4,5,6,7,8,9,10,'J','Q','K','A'][move.card.rank]}${['♦', '♥', '♣', '♠'][move.card.suit]})`;

				if (move.card.card_id == 5 || move.card.card_id == 11 || move.card.card_id == 12 || move.card.card_id == 14 || move.card.card_id == 17)
					document.querySelector('.history-block:last-child .history-move:last-child').innerHTML += `&nbspи выбирает игрока <span>${boardPlayers[move.target].user.name}</span> в качестве цели`;
			}
		});
	});

	setTimeout(() => {
		if (historyActivate) document.querySelector('.history').style.bottom = '-100vh';
		else document.querySelector('.history').style.bottom = '11vh';
		historyActivate = !historyActivate;
	}, 100);
});

document.addEventListener('scroll', () => { if (historyActivate) { document.querySelector('.history').style.bottom = '-100vh'; historyActivate = !historyActivate; } });


// ----------------------------------------------------------------- //



document.querySelector('.leave-after-result').addEventListener('click', () => {
	document.querySelector('main').style.display = 'none';
	document.querySelector('.game-result').style.display = 'none';
});


document.querySelector('.end-turn').addEventListener('click', () => {
	socket.emit('turn-end', myPlayer, session);
	document.querySelector('#card-chooser').style.display = 'none';
});

const assignObjects = (string, ...objects) => {
	let assigned = string;
	objects.forEach(object => assigned = eval('`' + assigned.replace(/~{/g, '${') + '`'));
	return assigned;
}

const drawCards = (c) => {
	search = false;
	cards.querySelector('.common-ctn').innerHTML = '';

	c.forEach(card => {
		cards.querySelector('.common-ctn').innerHTML += assignObjects(card_html, card);
		// cards.querySelector('.common-ctn').querySelectorAll('.card-change')[cards.querySelector('.common-ctn').querySelectorAll('.card-change').length - 1].style.display = (myPlayer.character.id == 5 && (card.card_id == 5 || card.card_id == 6)) ? 'block' : 'none';
	});

	for (let index = 0; index < 10 - c.length; index++) {
		cards.querySelector('.common-ctn').innerHTML += '<div class="card empty" data-card="-1"></div>';
	}

	if (boardPlayers.length == 6) {
		document.querySelectorAll('.card-delete').forEach((card_delete, index) => {
			card_delete.addEventListener('click', () => {
				socket.emit('delete-card', myPlayer, myPlayer.cards[index], session);
				document.querySelectorAll('.common-ctn .card:not(.role)')[index].classList.remove('selected');
			});
		});
	}
	
	document.querySelectorAll('.card-change').forEach((card_delete, index) => {
		card_delete.addEventListener('click', () => {
			socket.emit('change-card', myPlayer, myPlayer.cards[index], session);
			document.querySelectorAll('.common-ctn .card:not(.role)')[index].classList.remove('selected');
		});
	});

	if (document.querySelector(`.player.my-player .card[data-card='19']`)) {
		document.querySelector(`.player.my-player .card[data-card='19']`).addEventListener('click', () => {
			temp_card = myPlayer.modifiers.find(item => item.card_id == 19);
			untouchAll();
			if (current_wait == myPlayer.player_id && current_wait != current_turn) {
				if (current_wait == myPlayer.player_id) socket.emit('play-card', myPlayer, temp_card, myPlayer, session);
				return;
			}
		});
	}

	document.querySelectorAll('#cards .card:not(.role)').forEach((card, index) => {
		card.addEventListener('click', () => {
			temp_card = myPlayer.cards[index];
			untouchAll();

			if (card.getAttribute('data-card') == 6 || card.getAttribute('data-card') == 19 || card.getAttribute('data-card') == 7 ||
				card.getAttribute('data-card') == 8 || card.getAttribute('data-card') == 10 || card.getAttribute('data-card') == 15 || card.getAttribute('data-card') == 16) {
				if (current_wait == myPlayer.player_id) socket.emit('play-card', myPlayer, temp_card, myPlayer, session);
			} else if (card.getAttribute('data-card') == 17 || card.getAttribute('data-card') == 12 || card.getAttribute('data-card') == 14) {
				document.querySelectorAll('.card:not(.role)').forEach(c => c.classList.remove('selected'));
				card.classList.add('selected');
				document.querySelectorAll('.player').forEach(player => {
					if (player.getAttribute('player-id') != myPlayer.player_id) touchPlayer(player.getAttribute('player-id'));
				});
			} else if (card.classList.contains('player-modifier')) {
				if (current_wait == myPlayer.player_id) socket.emit('play-card', myPlayer, temp_card, myPlayer, session);
			} else if (card.getAttribute('data-card') == 9) {
				if (current_wait == myPlayer.player_id || current_turn == myPlayer.player_id) socket.emit('play-card', myPlayer, temp_card, myPlayer);
			} else if (card.getAttribute('data-card') == 13) {
				if (current_turn == myPlayer.player_id) socket.emit('play-card', myPlayer, temp_card, myPlayer, session);
			} else if (card.getAttribute('data-card') == 5) {
				document.querySelectorAll('.card:not(.role)').forEach(c => c.classList.remove('selected'));
				card.classList.add('selected');
				document.querySelectorAll('.player').forEach(player => {
					if (player.getAttribute('player-id') != myPlayer.player_id && myPlayer.distances[+player.getAttribute('player-id')] <= myPlayer.shootDistance) {
						touchPlayer(player.getAttribute('player-id'));
					}
				});
			} else if (card.getAttribute('data-card') == 11) {
				document.querySelectorAll('.card:not(.role)').forEach(c => c.classList.remove('selected'));
				card.classList.add('selected');
				document.querySelectorAll('.player').forEach(player => {
					if (player.getAttribute('player-id') != myPlayer.player_id && myPlayer.distances[+player.getAttribute('player-id')] <= 1)
						touchPlayer(player.getAttribute('player-id'));
				});
			} else if (card.getAttribute('data-card') != -1) {
				document.querySelectorAll('.card:not(.role)').forEach(c => c.classList.remove('selected'));
				card.classList.add('selected');
				document.querySelectorAll('.player').forEach(player => {
					if (player.getAttribute('player-id') != myPlayer.player_id) touchPlayer(player.getAttribute('player-id'));
				});
			}
		});
	});
}

const untouchAll = () => {
	document.querySelectorAll('.player').forEach(player => {
		player.querySelector('.player-character').onclick = null;
		player.classList.remove('touch')
	});
}

const touchPlayer = player_id => {
	const player = document.querySelector(`.player[player-id='${player_id}']`);
	player.classList.add('touch');
	player.querySelector('.player-character').onclick = () => {
		if (temp_card && current_wait == myPlayer.player_id) {
			socket.emit('play-card', myPlayer, temp_card, boardPlayers[player_id], session);
			untouchAll();
		}
	};
}

socket.on('clear-destroyed', () => {
	document.querySelector('.table__card-last').innerHTML = '';
});

socket.on('splice-destroyed', player => {
	let { absolute_card, card_rect } = createAbsoluteElement(document.querySelector(`.table__card-last .card:last-child`));
	const table_card_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();

	setTimeout(() => {
		absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
		setTimeout(() => {
			document.body.removeChild(absolute_card);
		}, 600);
	}, 100);

	document.body.appendChild(absolute_card);
});


socket.on('choose-destroyed', choose => {
	const arrow = document.querySelector('.table__arrow');
	if (!destroyed_choosed) arrow.classList.remove('checked');
	else arrow.classList.add('checked');
	destroyed_choosed = choose;
});

socket.on('choose-player', choose => {
	const arrow_players = document.querySelector('.table__arrow__players');
	arrow_players.setAttribute('data-turn', choose);
	player_choosed = choose;
});


socket.on('indians-release', sender => {
	document.querySelectorAll(`.player.wait`).forEach(player => player.classList.remove('wait'));
	document.querySelector(`.player[player-id='${sender}']`).classList.add('wait');

	if (sender == myPlayer.player_id) { 
		setTimeout(() => {
			document.querySelectorAll('#cards .card:not(.role)').forEach((card, index) => {
				if (card.getAttribute('data-card') == 5) {
					card.addEventListener('click', () => {
						socket.emit('indians-send', sender, myPlayer.cards[index], session);
					});
				}
			});
		}, 100);
	}
});

socket.on('duel-release', sender => {
	document.querySelectorAll(`.player.wait`).forEach(player => player.classList.remove('wait'));
	document.querySelector(`.player[player-id='${sender}']`).classList.add('wait');

	if (sender == myPlayer.player_id) {
		setTimeout(() => {
			console.log(document.querySelectorAll('#cards .card:not(.role)'))
			document.querySelectorAll('#cards .card:not(.role)').forEach((card, index) => {
				if (card.getAttribute('data-card') == 5) {
					card.addEventListener('click', () => {
						socket.emit('duel-send', sender, myPlayer.cards[index], session);
					});
				}
			});
		}, 100);
	}
});


socket.on('shop-end', () => document.querySelector('#shop').style.display = 'none');

socket.on('shop-card', (sender, shop_cards) => {
	document.querySelector('.shop-user span').innerHTML = `${boardPlayers[sender].user.name}`;
	document.querySelector('#shop').style.display = 'flex';
	document.querySelector('.shop-cards').innerHTML = '';

	shop_cards.forEach(card => {
		document.querySelector('.shop-cards').innerHTML += assignObjects(card_html, card);
	});

	if (sender == myPlayer.player_id) {
		document.querySelectorAll('.shop-cards .card').forEach((card, index) => {
			card.addEventListener('click', () => {
				socket.emit('get-shop-card', shop_cards[index], sender, session);
			});
		});
	}
});

socket.on('choose-end', () => document.querySelector('#card-chooser').style.display = 'none');

socket.on('choose-from-three', (sender, cards) => {
	document.querySelector('.card-chooser-title').innerHTML = `Выбор карты для набора (${boardPlayers[sender].user.name})`;
	document.querySelector('#card-chooser').style.display = 'flex';
	document.querySelector('.card-chooser-cards').innerHTML = '';

	document.querySelector('.card-chooser-cards').innerHTML += assignObjects(card_html, cards[0]);
	document.querySelector('.card-chooser-cards').innerHTML += assignObjects(card_html, cards[1]);
	document.querySelector('.card-chooser-cards').innerHTML += assignObjects(card_html, cards[2]);

	if (sender == myPlayer.player_id) {
		document.querySelectorAll('.card-chooser-cards .card').forEach((c, index) => {
			c.addEventListener('click', () => {
				socket.emit('choose-from-three-send', sender, cards[index], session);
			});
		});
	}
});

socket.on('check-card', (sender, card, second_card) => {
	if (second_card) {
		document.querySelector('.card-chooser-title').innerHTML = `Выбор карты для проверки (${boardPlayers[sender].user.name})`;
		document.querySelector('#card-chooser').style.display = 'flex';
		document.querySelector('.card-chooser-cards').innerHTML = '';

		document.querySelector('.card-chooser-cards').innerHTML += assignObjects(card_html, card);
		document.querySelector('.card-chooser-cards').innerHTML += assignObjects(card_html, second_card);

		if (sender == myPlayer.player_id) {
			document.querySelectorAll('.card-chooser-cards .card').forEach((c, index) => {
				c.addEventListener('click', () => {
					socket.emit('check-card-choose', sender, index == 0 ? card : second_card, session);
				});
			});
		}
	} else {
		const placeholder = document.createElement("div");
		placeholder.innerHTML = assignObjects(card_html, card);
		let absolute_card = placeholder.firstElementChild;
	
		const card_rect = document.querySelector(`.table__card-count`).getBoundingClientRect();
		const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();
		absolute_card.style.position = 'absolute';
		absolute_card.style.left = card_rect.x - 5 + 'px';
		absolute_card.style.top = card_rect.y + 9 + 'px';
	
		setTimeout(() => {
			absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
			setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
			}, 600);
		}, 100);
	
		document.body.appendChild(absolute_card);
	}
});

socket.on('destroy-modifier', (card, sender) => {
	const placeholder = document.createElement("div");
	placeholder.innerHTML = assignObjects(card_html, card);
	let absolute_card = placeholder.firstElementChild;

	const card_rect = document.querySelector(`.player[player-id='${sender.player_id}'] .modifier[data-card='${card.card_id}']`).getBoundingClientRect();
	const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();
	absolute_card.style.position = 'absolute';
	absolute_card.style.left = card_rect.x - 5 + 'px';
	absolute_card.style.top = card_rect.y + 9 + 'px';

	setTimeout(() => {
		absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
		setTimeout(() => {
				let destroyCard = absolute_card.cloneNode(true);
				destroyCard.style.transform = '';
				destroyCard.style.left = 'auto';
				destroyCard.style.top = 'auto';
				document.querySelector('.table__card-last').appendChild(destroyCard);
				document.body.removeChild(absolute_card);
		}, 600);
	}, 100);

	document.body.appendChild(absolute_card);
});


function createElementFromHTML (html, card, sender, target) {
	try {
		const placeholder = document.createElement("div");
		placeholder.innerHTML = assignObjects(html, card);
		let absolute_card = placeholder.firstElementChild;
	
		const sender_rect = sender.getBoundingClientRect();
		const target_rect = target.getBoundingClientRect();
	
		absolute_card.style.position = 'absolute';
		absolute_card.style.left = sender_rect.x - 5 + 'px';
		absolute_card.style.top = sender_rect.y + 9 + 'px';
		return { absolute_card: absolute_card, sender_rect: sender_rect, target_rect: target_rect};
	} catch (e) {};
}

function createAbsoluteElement (element) {
	let absolute_card = element.cloneNode(true);
	const card_rect = element.getBoundingClientRect();
	absolute_card.style.position = 'absolute';
	absolute_card.style.left = card_rect.x - 5 + 'px';
	absolute_card.style.top = card_rect.y + 9 + 'px';
	return { absolute_card: absolute_card, card_rect: card_rect };
}

socket.on('show-card', card => {
	let { absolute_card, sender_rect, target_rect } = createElementFromHTML(card_html, card, document.querySelector(`.player[player-id='${current_turn}'] .player-character`), document.querySelector('.table__card-last'));
	absolute_card.style.left = sender_rect.x + 'px';
	absolute_card.style.top = sender_rect.y + 'px';
	
	setTimeout(() => document.body.removeChild(absolute_card), 1500);
	document.body.appendChild(absolute_card);
});


socket.on('accept-card', (sender, card, card_id, player, behaviour) => {
	let text = '';

	if (card.card_id == 5) {
		console.log(player, sender)
		if (player == myPlayer.player_id) text = `Игрок ${boardPlayers[sender].user.name} использовал 'Бэнг' на Вас`;
		else text = `Игрок ${boardPlayers[sender].user.name} использовал 'Бэнг' на ${boardPlayers[player].user.name}`;
	} else text = 'Вы можете сыграть карту';

	document.querySelector('.cards-top').textContent = text;

	if (behaviour == 'transfer-modifier') {
		let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`.player[player-id='${sender}'] .modifier`)[card_id]);
		const character_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();

		setTimeout(() => {
			absolute_card.style.transform = `translate(${character_rect.x - card_rect.x + 5}px, ${character_rect.y - card_rect.y - 8}px)`;
			absolute_card.classList.remove('selected');
			drawCards(myPlayer.cards);
			setTimeout(() => document.body.removeChild(absolute_card), 800);
		}, 100);
		document.body.appendChild(absolute_card);
	}

	if (behaviour == 'shop') {
		let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`#shop .card`)[card_id]);
		const character_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();
		document.body.appendChild(absolute_card);

		setTimeout(() => {
			absolute_card.style.transform = `translate(${character_rect.x - card_rect.x + 5}px, ${character_rect.y - card_rect.y - 8}px)`;
			absolute_card.classList.remove('selected');
			setTimeout(() => document.body.removeChild(absolute_card), 800);
		}, 100);

		return;
	}

	if (behaviour == 'choose-three') {
		let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`#card-chooser .card`)[card_id]);
		const character_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();
		document.body.appendChild(absolute_card);

		document.querySelector('.card-chooser-cards').removeChild(document.querySelectorAll('#card-chooser .card')[card_id]);
		setTimeout(() => {
			absolute_card.style.transform = `translate(${character_rect.x - card_rect.x + 5}px, ${character_rect.y - card_rect.y - 8}px)`;
			absolute_card.classList.remove('selected');
			setTimeout(() => document.body.removeChild(absolute_card), 800);
		}, 100);

		return;
	}

	if (behaviour == 'choose') {
		let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`#card-chooser .card`)[card_id]);
		const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();
		document.body.appendChild(absolute_card);

		setTimeout(() => {
			absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
			absolute_card.classList.remove('selected');
			setTimeout(() => document.body.removeChild(absolute_card), 800);
		}, 100);

		return;
	}

	if (sender == myPlayer) {
		let release = false;
		if (behaviour == 'release') {
			let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`.player[player-id='${myPlayer.player_id}'] .modifier`)[card_id]);

			const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();

			setTimeout(() => {
				absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
				}, 600);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}

		if (behaviour == 'remove') {
			let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`.card:not(.role)`)[card_id]);
			const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();

			setTimeout(() => {
				absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
				}, 600);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}

		if (behaviour == 'indians') {
			let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll(`.card:not(.role)`)[card_id]);
			const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();

			setTimeout(() => {
				absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
				}, 600);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}

		if (behaviour == 'transfer') {
			let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll('.common-ctn .card:not(.role)')[card_id]);
			const character_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();

			setTimeout(() => {
				absolute_card.style.transform = `translate(${character_rect.x - card_rect.x + 5}px, ${character_rect.y - card_rect.y - 8}px)`;
				absolute_card.classList.remove('selected');
				drawCards(myPlayer.cards);
				setTimeout(() => document.body.removeChild(absolute_card), 800);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}

		if (behaviour == 'prison') {
			let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll('.common-ctn .card:not(.role)')[card_id]);
			const character_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();

			setTimeout(() => {
				absolute_card.style.transform = `translate(${character_rect.x - card_rect.x + 5}px, ${character_rect.y - card_rect.y - 8}px)`;
				absolute_card.classList.remove('selected');
				drawCards(myPlayer.cards);
				setTimeout(() => document.body.removeChild(absolute_card), 800);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}

		if (release) return;

		let { absolute_card, card_rect } = createAbsoluteElement(document.querySelectorAll('.common-ctn .card:not(.role)')[card_id]);
		const character_rect = document.querySelector(`.player[player-id='${player}'] .player-character`).getBoundingClientRect();

		myPlayer.cards.splice(card_id, 1);
		setTimeout(() => {
			absolute_card.style.transform = `translate(${character_rect.x - card_rect.x + 5}px, ${character_rect.y - card_rect.y - 8}px)`;
			absolute_card.classList.remove('selected');
			drawCards(myPlayer.cards);
			if (behaviour == 'modifier') setTimeout(() => document.body.removeChild(absolute_card), 400);
			else if (behaviour == 'destroy') setTimeout(() => {
				const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();
				absolute_card.style.transform = `translate(${table_card_rect.x - card_rect.x + 5}px, ${table_card_rect.y - card_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
				}, 600);
			}, 600);
		}, 100);

		document.body.appendChild(absolute_card);
	} else {
		let release = false;

		if (behaviour == 'remove') {
			let { absolute_card, sender_rect, target_rect } = createElementFromHTML(card_html, card, document.querySelector(`.player[player-id='${sender}'] .player-character`), document.querySelector('.table__card-last'));

			setTimeout(() => {
				absolute_card.style.transform = `translate(${target_rect.x - sender_rect.x + 5}px, ${target_rect.y - sender_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
				}, 600);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}

		if (behaviour == 'indians') {
			let { absolute_card, sender_rect, target_rect } = createElementFromHTML(card_html, card, document.querySelector(`.player[player-id='${sender}'] .player-character`), document.querySelector('.table__card-last'));

			setTimeout(() => {
				absolute_card.style.transform = `translate(${target_rect.x - sender_rect.x + 5}px, ${target_rect.y - sender_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(absolute_card);
				}, 600);
			}, 100);
			release = true;
			document.body.appendChild(absolute_card);
		}
		
		if (behaviour == 'transfer') {
			let animation = createElementFromHTML(card_html, card, document.querySelector(`.player[player-id='${sender}'] .player-character`), document.querySelector(`.player[player-id='${player}'] .player-character`));

			setTimeout(() => {
				animation.absolute_card.style.transform = `translate(${animation.target_rect.x - animation.sender_rect.x + 5}px, ${animation.target_rect.y - animation.sender_rect.y - 8}px)`;
				animation.absolute_card.classList.remove('selected');
				drawCards(myPlayer.cards);
				setTimeout(() => document.body.removeChild(animation.absolute_card), 600);
			}, 100);
			release = true;
			document.body.appendChild(animation.absolute_card);
		}

		if (behaviour == 'prison') {
			let animation = createElementFromHTML(card_html, card, document.querySelector(`.player[player-id='${sender}'] .player-character`), document.querySelector(`.player[player-id='${player}'] .player-character`));

			setTimeout(() => {
				animation.absolute_card.style.transform = `translate(${animation.target_rect.x - animation.sender_rect.x + 5}px, ${animation.target_rect.y - animation.sender_rect.y - 8}px)`;
				animation.absolute_card.classList.remove('selected');
				drawCards(myPlayer.cards);
				setTimeout(() => document.body.removeChild(animation.absolute_card), 600);
			}, 100);
			release = true;
			document.body.appendChild(animation.absolute_card);
		}

		if (release) return;
		if (behaviour == 'modifier' || behaviour == 'release') return;

		let animation = createElementFromHTML(card_html, card, document.querySelector(`.player[player-id='${sender}'] .player-character`), document.querySelector(`.player[player-id='${player}'] .player-character`));

		setTimeout(() => {
			animation.absolute_card.style.transform = `translate(${animation.target_rect.x - animation.sender_rect.x + 5}px, ${animation.target_rect.y - animation.sender_rect.y - 8}px)`;
			animation.absolute_card.classList.remove('selected');
			drawCards(myPlayer.cards);
			if (behaviour == 'modifier') setTimeout(() => document.body.removeChild(animation.absolute_card), 400);
			if (behaviour == 'destroy') setTimeout(() => {
				const table_card_rect = document.querySelector('.table__card-last').getBoundingClientRect();
				animation.absolute_card.style.transform = `translate(${table_card_rect.x - animation.sender_rect.x + 5}px, ${table_card_rect.y - animation.sender_rect.y - 8}px)`;
				setTimeout(() => {
					let destroyCard = animation.absolute_card.cloneNode(true);
					destroyCard.style.transform = '';
					destroyCard.style.left = 'auto';
					destroyCard.style.top = 'auto';
					document.querySelector('.table__card-last').appendChild(destroyCard);
					document.body.removeChild(animation.absolute_card);
				}, 600);
			}, 600);
		}, 100);

		document.body.appendChild(animation.absolute_card);
	}
});
socket.on('decline-card', error => {
	console.log(error);
	document.querySelectorAll('.card:not(.role)').forEach(c => c.classList.remove('selected'));
});






socket.on('turn', turn => {
	document.querySelector('.wait-header').innerHTML = '';
	document.querySelector('.wait-seconds').innerHTML = '';

	document.querySelectorAll('.player').forEach(player => {
		if (player.classList.contains('turn')) player.classList.remove('turn');
	});

	current_turn = turn;

	document.querySelector(`.player[player-id='${turn}']`).classList.add('turn');
});

socket.on('kick', player => {
	if (player.player_id == myPlayer.player_id) {
		cards.innerHTML = '';
		document.querySelector('.game-result h1').textContent = 'Вы проиграли!';
		document.querySelector('.game-result').style.display = 'flex';
	}
	boardPlayers[player.player_id].dead = true;
	info.querySelector(`.player-info:nth-child(${player.player_id + 1}) .player-info-role`).setAttribute('data-role', player.role.toString());
	info.querySelector(`.player-info:nth-child(${player.player_id + 1})`).classList.add('dead');
	try { board.removeChild(document.querySelector(`.player[player-id='${player.player_id}']`)); } catch (e) {};
	board.setAttribute('player-count', board.getAttribute('player-count') - 1);
});

socket.on('wait', (player_id, time, new_turn) => {
	if (new_turn) {
		document.querySelector('.time-header').innerHTML = 'Ход ' + boardPlayers[player_id].user.name + ': ';
		document.querySelector('.time-seconds').innerHTML = time;
	} else {
		if (player_id == myPlayer.player_id) {
			if (!~myPlayer.cards.findIndex(item => item.card_id == 6 || (item.card_id == 9 && myPlayer.health == 1) || (item.card_id == 5 && myPlayer.character.id == 5)) &&
				!~myPlayer.modifiers.findIndex(item => item.card_id == 19)) socket.emit('turn-end', myPlayer, session);
		}

		document.querySelector('.wait-header').innerHTML = 'Ответ ' + boardPlayers[player_id].user.name + ': ';
		document.querySelector('.wait-seconds').innerHTML = time;
	}

	current_wait = player_id;

	if (document.querySelector('.end-turn')) {
		if (player_id == myPlayer.player_id) document.querySelector('.end-turn').classList.remove('inactive');
		else document.querySelector('.end-turn').classList.add('inactive');
	}

	document.querySelectorAll('.player').forEach(player => {
		if (player.classList.contains('wait')) player.classList.remove('wait');
	});

	document.querySelector(`.player[player-id='${player_id}']`).classList.add('wait');
});


socket.on('turn-end', () => {
	socket.emit('turn-end', myPlayer, session);
	document.querySelector('#card-chooser').style.display = 'none';
});

// ----------------------------------------------------- Set initial values ---------------------------------------------------- //

socket.on('board', players => {
	document.querySelector('main').style.display = 'flex';

	board.innerHTML = '';
	info.innerHTML = '';

	boardPlayers = players;
	document.querySelector('#board').setAttribute('player-count', boardPlayers.length);

	players.forEach(player => {
		board.innerHTML += assignObjects(player_html, player);
		info.innerHTML += assignObjects(info_html, player);

		player.modifiers.forEach((modifier, index) => {
			document.querySelector('.player:last-child .player-modifiers').innerHTML += assignObjects(card_html, player.modifiers[index]);
		});

		for (let index = 0; index < 6 - player.modifiers.length; index++) {
			document.querySelector(`.player[player-id='${player.player_id}'] .player-modifiers`).innerHTML += '<div class="player-modifier card empty"></div>';
		};
	});

	setTimeout(() => {
		const disableScroll = element => element.onscroll = () => element.scrollTo(0, 0);
		const enableScroll = element => element.onscroll = () => {};

		document.querySelectorAll('.player-modifiers').forEach(element => {
			if (element.querySelectorAll('*').length <= 3) {
				element.querySelector('*:last-child').style.marginRight = '1px';
				disableScroll(element);
			} else {
				element.querySelector('*:last-child').style.marginRight = '0px';
				enableScroll(element);
			}
		});
	}, 500);
});

socket.on('room-id', roomId => document.querySelector('.header__id').textContent = `ID ${roomId}`.toUpperCase());

socket.on('table', (table, gameId) => {
	let last_card = null;
	if (document.querySelector('.table__card-last')) {
		last_card = document.querySelector('.table__card-last').innerHTML;
		document.querySelector('.board-wrapper').removeChild(document.querySelector('.table'));
	}
	document.querySelector('.board-wrapper').innerHTML += assignObjects(table_html, table);
	if (last_card) last_card = document.querySelector('.table__card-last').innerHTML = last_card;

	const arrow = document.querySelector('.table__arrow');
	const arrow_players = document.querySelector('.table__arrow__players');

	if (myPlayer) {
		arrow.style.display = myPlayer.character.id == 6 ? 'block' : 'none';
		arrow_players.style.display = myPlayer.character.id == 12 ? 'block' : 'none';
	}

	if (destroyed_choosed) arrow.classList.add('checked');
	else arrow.classList.remove('checked');

	arrow_players.setAttribute('data-turn', player_choosed);

	arrow.addEventListener('click', () => {
		socket.emit('choose-destroyed', !destroyed_choosed, myPlayer.player_id, session);
	});

	arrow_players.addEventListener('click', () => {
		socket.emit('choose-player', myPlayer.player_id, session);
	});
});

socket.on('player', player => {
	myPlayer = player;

	const arrow = document.querySelector('.table__arrow');
	arrow.style.display = myPlayer.character.id == 6 ? 'block' : 'none';

	const arrow_players = document.querySelector('.table__arrow__players');
	arrow_players.style.display = myPlayer.character.id == 12 ? 'block' : 'none';

	document.querySelector(`.player[player-id='${player.player_id}']`).classList.add('my-player');
	if (document.querySelector('.role.card')) cards.removeChild(document.querySelector('.role.card'));
	if (!isLearning && boardPlayers[0].bot_cards) { learnStep(); isLearning = true; }
	document.querySelector('.common').insertAdjacentHTML('beforebegin', assignObjects(role_html, player));

	document.title = player.user.name;
	drawCards(player.cards);
});


// ------------------------------------------------------- Update values ------------------------------------------------------- //

socket.on('distances', distances => {
	myPlayer.distances = distances;
	document.querySelectorAll('.player-character__distance').forEach((distance, index) => {
		if (distance != document.querySelector('.player.my-player .player-character__distance'))
			distance.innerHTML = assignObjects(distance_html, distances[index]);
		else document.querySelector('.player.my-player .player-character__distance').style.display = 'none';
	});
});

socket.on('update-shoot-distance', shootDistance => {
	myPlayer.shootDistance = shootDistance;
});

socket.on('set-health', (player_id, maxHealth, health) => {
	try {
		myPlayer.health = health;

		document.querySelector(`.player[player-id='${player_id}'] .player-character__health`).innerHTML = assignObjects(`
		~{'<li class="player-character__health-point player-health-point"><img src="./assets/img/game/bullet.svg" alt=""></li>'.repeat(object.health)}
		~{'<li class="player-character__health-point player-health-point"><img src="./assets/img/game/bullet-shot.svg" alt=""></li>'.repeat(object.maxHealth - object.health)}`,
		{maxHealth: maxHealth, health: health});
	
		document.querySelector(`.player-info:nth-child(${player_id + 1}) .player-info-health`).innerHTML = assignObjects(`
		~{'<li class="player-info-health-point player-health-point"><img src="./assets/img/game/bullet.svg" alt=""></li>'.repeat(object.health)}
		~{'<li class="player-info-health-point player-health-point"><img src="./assets/img/game/bullet-shot.svg" alt=""></li>'.repeat(object.maxHealth - object.health)}`,
		{maxHealth: maxHealth, health: health});
	} catch (e) {}
});

socket.on('update-cards-count', count => {
	document.querySelectorAll('.player-character__cards-count').forEach((count_element, index) => count_element.innerHTML = ' x ' + count[index]);
	document.querySelectorAll('.player-info-cards-count').forEach((count_element, index) => count_element.innerHTML = ' x ' + count[index]);
});

socket.on('update-cards', cards => drawCards(cards));

socket.on('update-modifiers', modifiers => {
	document.querySelectorAll('.player-modifiers').forEach(element => element.style.visibility = 'hidden');

	myPlayer.modifiers = [];
	boardPlayers.forEach((player, index) => {
		if (!player.dead) {
			document.querySelector(`.player[player-id='${player.player_id}'] .player-modifiers`).innerHTML = '';
			modifiers[index].forEach(modifier => {
				if (player.player_id == myPlayer.player_id) myPlayer.modifiers.push(modifier);
				document.querySelector(`.player[player-id='${player.player_id}'] .player-modifiers`).innerHTML += assignObjects(card_html, modifier);
			});

			for (let i = 0; i < 6 - modifiers[index].length; i++) {
				document.querySelector(`.player[player-id='${player.player_id}'] .player-modifiers`).innerHTML += '<div class="player-modifier card empty"></div>';
			};
		}
	});

	const disableScroll = element => element.onscroll = () => element.scrollTo(0, 0);
	const enableScroll = element => element.onscroll = () => {};

	document.querySelectorAll('.player-modifiers').forEach(element => {
		if (element.querySelectorAll('*').length <= 3) {
			element.querySelector('*:last-child').style.marginRight = '1px';
			disableScroll(element);
		} else {
			element.querySelector('*:last-child').style.marginRight = '0px';
			enableScroll(element);
		}
	});

	document.querySelectorAll('.player-modifiers').forEach(element => element.style.visibility = 'visible');
});
