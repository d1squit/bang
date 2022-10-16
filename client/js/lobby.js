// ------------------------------------------- CHARACTERS ------------------------------------------- //

const clearOutline = () => document.querySelectorAll('.lobby__match__character__field').forEach(element => element.classList.remove('outlined'));
const setOutline = (element) => element.classList.add('outlined');

document.querySelectorAll('.lobby__match__character__field').forEach((element, index) => {
	element.addEventListener('click', () => {
		if (element.getAttribute('data-character') == 'none') return;
		window.user.navigation.characters.outlined = index + (window.user.navigation.characters.currentPage - 1) * 6;
		window.user.navigation.characters.outlinedPage = window.user.navigation.characters.currentPage;
		clearOutline();
		setOutline(element);
	});
});

const charactersArrowNext = document.querySelector('.lobby__match__character__arrow:first-child');
const charactersArrowPrevious = document.querySelector('.lobby__match__character__arrow:last-child');
const friendsArrowNext = document.querySelector('.lobby__friends__arrow:first-child');
const friendsArrowPrevious = document.querySelector('.lobby__friends__arrow:last-child');

charactersArrowNext.addEventListener('click', () => {
	if (charactersArrowNext.classList.contains('disabled')) return; window.user.navigation.characters.currentPage++;
	document.querySelectorAll('.lobby__match__character__field').forEach(element => element.setAttribute('data-character', 'none'));
	clearOutline(); if (window.user.navigation.characters.outlinedPage == window.user.navigation.characters.currentPage) setOutline(document.querySelectorAll('.lobby__match__character__field')[window.user.navigation.characters.outlined - ((window.user.navigation.characters.outlinedPage - 1) * 6)]);
	window.user.characters.slice(6).forEach((character, index) => document.querySelectorAll('.lobby__match__character__field')[index].setAttribute('data-character', character));
	charactersArrowNext.classList.add('disabled');
	charactersArrowPrevious.classList.remove('disabled');
});

charactersArrowPrevious.addEventListener('click', () => {
	if (charactersArrowPrevious.classList.contains('disabled')) return; window.user.navigation.characters.currentPage--;
	clearOutline(); if (window.user.navigation.characters.outlinedPage == window.user.navigation.characters.currentPage) setOutline(document.querySelectorAll('.lobby__match__character__field')[window.user.navigation.characters.outlined - ((window.user.navigation.characters.outlinedPage - 1) * 6)]);
	window.user.characters.slice(0, 6).forEach((character, index) => document.querySelectorAll('.lobby__match__character__field')[index].setAttribute('data-character', character));
	charactersArrowPrevious.classList.add('disabled');
	charactersArrowNext.classList.remove('disabled');
});

friendsArrowNext.addEventListener('click', () => {
	if (friendsArrowNext.classList.contains('disabled')) return; window.user.navigation.friends.currentPage++;
	displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6, window.searchActive ? window.search : null);
});

friendsArrowPrevious.addEventListener('click', () => {
	if (friendsArrowPrevious.classList.contains('disabled')) return; window.user.navigation.friends.currentPage--;
	displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6, window.searchActive ? window.search : null);
});

// ------------------------------------------- LOBBY ------------------------------------------- //


const session = localStorage.getItem('session');
let socket = io.connect('', { query: `session=${session}` });

document.querySelector('.error').addEventListener('click', () => {
	localStorage.removeItem('session');
	setTimeout(() => location.href = './login.html', 1000);
});

document.querySelector('.header__profile__logout').addEventListener('click', () => logOut(socket));
document.querySelectorAll('.player__kick').forEach((element, index) => element.addEventListener('click', () => socket.emit('kick', window.user.gameId, window.lobby.players[index].gameId, session)));

document.querySelector('.lobby__friends__search__input').addEventListener('input', () => {
	if (document.querySelector('.lobby__friends__search__input').value != '') socket.emit('get-users', document.querySelector('.lobby__friends__search__input').value, session);
	else {
		displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6);
		window.searchActive = false;
	}
});

document.querySelectorAll('.lobby__match__start__mode__tip')[1].addEventListener('click', () => document.querySelector('.lobby__match__start__mode__text').style.display = 'block');
document.querySelectorAll('*:not(.lobby__match__start__mode__tip)').forEach(element => element.addEventListener('click', () => document.querySelector('.lobby__match__start__mode__text').style.display = 'none'));


$.getJSON("https://api.ipify.org?format=json", (data) => {
	if (session) socket.emit('get-profile', session, data.ip);
	else window.location.href = './login.html';
});

socket.on('users', users => {
	window.search = users;
	window.searchActive = true;
	displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6, users, true);
});

socket.on('requests', requests => {
	window.user.requests = requests;
	document.querySelector('.lobby__friends__invites').textContent = 'Friend requests ' + (window.user.requests.length < 99 ? window.user.requests.length : '99+');
});

document.querySelector('.lobby__friends__invites').addEventListener('click', () => {
	if (document.querySelector('.lobby__friends__invites').textContent.includes('request')) {
		displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6, window.user.requests, false, true);
		document.querySelector('.lobby__friends__invites').textContent = 'Close';
	} else {
		displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6);
		document.querySelector('.lobby__friends__invites').textContent = 'Friend requests ' + (window.user.requests.length < 99 ? window.user.requests.length : '99+');
	}
});

document.querySelector('.lobby__search__button').addEventListener('click', () => {
	if (document.querySelector('.lobby__search__button').textContent == 'Start Search') socket.emit('ready', window.user.gameId, session);
	else socket.emit('not-ready', window.user.gameId, session);
});

socket.on('ready', () => {
	document.querySelector('.lobby__search__button').textContent = 'Waiting...';
});

socket.on('not-ready', () => {
	document.querySelector('.lobby__search__button').textContent = 'Start Search';
});

socket.on('decline', (error, tempSession) => {
	document.querySelector('.error').style.width = '300px';
	if (error == -1) document.querySelector('.error').textContent = 'Неверные данные для входа';
	else {
		document.querySelector('.error').textContent = 'Выполнен вход с другого устройства. Перейдите по ссылке в письме';
		if (tempSession) localStorage.setItem('tempSession', tempSession);
	}
});

const displayFriends = (start, end, friends=null, mode=false, decline=false) => {
	if (!friends) friends = window.user.friends;

	document.querySelector('.lobby__friends__list').innerHTML = '';
	friends.slice(start, end).forEach((friend, index) => {
		if (decline) document.querySelector('.lobby__friends__list').innerHTML += `<div class="lobby__friend player"><img src="" alt="" class="player__photo"><div class="player__state"><div></div></div><div class="player__info"><h2 class="player__name"></h2><div class="player__rating"><img src="./assets/img/trophy-icon.svg" alt=""><h2></h2></div></div><div class="player__controls"><div class="player__invite"></div><div class="player__decline"></div></div></div>`;
		else document.querySelector('.lobby__friends__list').innerHTML += `<div class="lobby__friend player"><img src="" alt="" class="player__photo"><div class="player__state"><div></div></div><div class="player__info"><h2 class="player__name"></h2><div class="player__rating"><img src="./assets/img/trophy-icon.svg" alt=""><h2></h2></div></div><div class="player__invite"></div></div>`;
		document.querySelectorAll('.player__invite')[index].style.display = 'block';
		document.querySelectorAll('.lobby__friend .player__name')[index].textContent = friend.name;
		document.querySelectorAll('.lobby__friend .player__rating > h2')[index].textContent = friend.rating;
		document.querySelectorAll('.lobby__friend .player__photo')[index].src = `./assets/photos/${friend.photo}.png`;
		if (window.lobby && ~window.lobby.players.findIndex(item => item.gameId == friend.gameId) && document.querySelectorAll('.player__invite').length > 0) document.querySelectorAll('.player__invite')[index].style.display = 'none';
		if (!friend.online) {
			document.querySelectorAll('.lobby__friend')[index].classList.add('disabled');
			if (!mode) document.querySelector(`.lobby__friend:nth-child(${index + 1}) .player__invite`).style.display = 'none';
		}
	});

	document.querySelectorAll('.player__decline').forEach((element, index) => element.addEventListener('click', () => socket.emit('request-decline', window.user.requests[index].inviteId, window.user.requests[index].gameId, session)));

	if (window.user.navigation.friends.currentPage * 6 > friends.length) friendsArrowNext.classList.add('disabled');
	else friendsArrowNext.classList.remove('disabled');

	if ((window.user.navigation.friends.currentPage - 1) * 6 == 0) friendsArrowPrevious.classList.add('disabled');
	else friendsArrowPrevious.classList.remove('disabled');

	document.querySelectorAll('.player__invite').forEach((element, index) => {
		element.addEventListener('click', () => {
			if (mode) socket.emit('add-friend', window.user.gameId, window.search[index].gameId, session);
			else if (decline) socket.emit('request-accept', window.user.requests[index].inviteId, window.user.requests[index].gameId, session);
			else socket.emit('invite', window.user.gameId, friends[index].gameId, session);
		});
	});
}

socket.on('profile', user => {
	const createLobby = (user) => {
		window.user = user;
		window.user.navigation = { characters: { outlined: 0, outlinedPage: 1, currentPage: 1 }, friends: { currentPage: 1 } };

		document.querySelectorAll('.profile__name').forEach(element => element.textContent = user.username);
		document.querySelector('.lobby__profile__rating__number > h2').textContent = user.rating;

		document.querySelectorAll('.profile__image').forEach(element => element.style.backgroundImage = `url('./assets/photos/${user.photo}.png')`);
		document.querySelectorAll('.profile__image').forEach(element => element.style.backgroundImage = `url('./assets/photos/${user.photo}.png')`);
		document.querySelector('.lobby__friends__invites').textContent = 'Friend requests ' + (user.requests.length < 99 ? user.requests.length : '99+');

		if (user.characters.length <= 6) {
			document.querySelector('.lobby__match__character__arrow:first-child').classList.add('disabled');
			user.characters.forEach((character, index) => document.querySelectorAll('.lobby__match__character__field')[index].setAttribute('data-character', character));
		} else user.characters.slice(0, 6).forEach((character, index) => document.querySelectorAll('.lobby__match__character__field')[index].setAttribute('data-character', character));
		

		user.friends.sort((a, b) => {
			let keyA = new Date(a.online), keyB = new Date(b.online);
			if (keyA > keyB) return -1;
			if (keyA < keyB) return 1;
			return 0;
		});

		document.querySelector('.lobby__friends__count__online').textContent = user.friends.filter(item => item.online).length;
		document.querySelector('.lobby__friends__count span').textContent = '/ ' + user.friends.length;

		displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6);
	}

	createLobby(user);
	document.querySelector('.wrapper').style.visibility = 'visible';
	setTimeout(() => document.querySelector('.wrapper').style.opacity = '1', 200);
});

socket.on('friend-state', (friendId, state) => {
	if (!window.user) return;
	const friendIndex = window.user.friends.findIndex(item => item.gameId == friendId);
	if (~friendIndex) {
		window.user.friends[friendIndex].online = state;
		user.friends.sort((a, b) => {
			let keyA = new Date(a.online), keyB = new Date(b.online);
			if (keyA > keyB) return -1;
			if (keyA < keyB) return 1;
			return 0;
		});
		document.querySelector('.lobby__friends__count__online').textContent = user.friends.filter(item => item.online).length;
		document.querySelector('.lobby__friends__count span').textContent = '/ ' + user.friends.length;
		displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6);
	}
});

socket.on('lobby-state', (playerId, state) => {
	if (!window.user) return;
	const playerIndex = window.lobby.players.findIndex(item => item.gameId == playerId);
	if (~playerIndex) {
		window.lobby.players[playerIndex].online = state;
		if (state) document.querySelectorAll('.lobby__match .lobby__player')[playerIndex].classList.remove('disabled');
		else document.querySelectorAll('.lobby__match .lobby__player')[playerIndex].classList.add('disabled');
	}
});

socket.on('accept-game', lobby => {
	document.querySelector('.accept-game').style.display = 'flex';
	document.querySelector('.accept-game__players').innerHTML = '';
	lobby.players.forEach((player, index) => {
		document.querySelector('.accept-game__players').innerHTML += `<div class="accept-game__player${ player.accepted ? ' accepted' : '' }"></div>`;
		document.querySelectorAll('.accept-game__player')[index].style.backgroundImage = `url('./assets/img/lobby/accepted.svg'), url('./assets/photos/${player.photo}.png')`;
	});

	document.querySelectorAll('.accept-game__button').forEach(element => element.addEventListener('click', () => {
		socket.emit('accept-game', window.user.gameId, session);
	}));
});

socket.on('lobby', lobby => {
	window.lobby = lobby;
	displayFriends((window.user.navigation.friends.currentPage - 1) * 6, window.user.navigation.friends.currentPage * 6);

	document.querySelectorAll('.lobby__match .player').forEach(element => element.classList.add('inactive'));
	lobby.players.forEach((player, index) => {
		document.querySelector('.lobby__match .player.inactive').classList.remove('inactive');
		document.querySelectorAll('.lobby__player .player__photo')[index].src = `./assets/photos/${player.photo}.png`;
		document.querySelectorAll('.lobby__player .player__name')[index].textContent = player.username;
		document.querySelectorAll('.lobby__player .player__rating h2')[index].textContent = player.rating;
		if (player.online) document.querySelectorAll('.lobby__match .lobby__player')[index].classList.remove('disabled');
		else document.querySelectorAll('.lobby__match .lobby__player')[index].classList.add('disabled');
	});

	document.querySelectorAll('.lobby__player .player__kick').forEach(element => element.style.display = 'none');

	if (window.user.gameId != window.lobby.players[0].gameId) {
		lobby.players.forEach((player, index) => {
			if (player.gameId == window.user.gameId) document.querySelectorAll('.lobby__player .player__kick')[index].style.display = 'block';
		});
	} else {
		lobby.players.forEach((player, index) => {
			document.querySelectorAll('.lobby__player .player__kick')[index].style.display = 'block';
		});
	}
});

// ------------------------------------------- INVITES ------------------------------------------- //

class Invites {
	constructor () {
		this.stack = [];
		this.timeout = null;
	}

	nextInvite = () => {
		document.querySelector('.lobby__invite').style.height = '0px';
		document.querySelector('.lobby__invite').style.padding = '0px 20px';
		clearTimeout(this.timeout);
		this.stack.splice(0, 1);
		this.sendInvite();
	}

	sendInvite = () => {
		if (this.stack.length == 0) return;

		document.querySelector('.lobby__invite__name').textContent = this.stack[0].username;
		document.querySelector('.lobby__invite').style.height = '68px';
		document.querySelector('.lobby__invite').style.padding = '17px 20px';

		document.querySelector('.lobby__invite__accept').addEventListener('click', () => socket.emit('invite-accept', this.stack[0].id, this.stack[0].invite));
		document.querySelector('.lobby__invite__decline').addEventListener('click', () => socket.emit('invite-decline', this.stack[0].id, this.stack[0].invite));

		this.timeout = setTimeout(() => {
			document.querySelector('.lobby__invite').style.height = '0px';
			document.querySelector('.lobby__invite').style.padding = '0px 20px';
			this.stack.splice(0, 1);

			if (this.stack.length > 0) {
				setTimeout(() => {
					this.sendInvite();
				}, 800);
			}
		}, 30000);
	};

	stopInvite = () => {
		clearTimeout(this.timeout);
		document.querySelector('.lobby__invite').style.height = '0px';
		document.querySelector('.lobby__invite').style.padding = '0px 20px';
	}


	addInvite = (user, inviteId) => {
		if (!~this.stack.findIndex(item => item.id == user.id))
			this.stack.push({ username: user.username, id: user.id, invite: inviteId });
	};

	removeInvite = (user) => {
		const userIndex = this.stack.findIndex(item => item.id == user.id);
		if (!~userIndex)
			this.stack.splice(userIndex, 1);
	};
}

const invites = new Invites();

socket.on('invite', (sender, inviteId) => {
	invites.addInvite(sender, inviteId);
	invites.sendInvite();
});

socket.on('invite-next', invites.nextInvite);