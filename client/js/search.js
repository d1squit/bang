const session = localStorage.getItem('session');
let socket = io.connect('', { query: `session=${session}&extra=ready` });
let id = null

if (localStorage.getItem('search')) {
	socket.on('game-id', gameId => { id = gameId; socket.emit('ready', gameId, session); });

	let time = 0;
	
	setInterval(() => {
		const minutes = Math.floor(time / 60) >= 10 ? Math.floor(time / 60).toString() : '0' + Math.floor(time / 60).toString();
		const seconds = time % 60 >= 10 ? (time % 60).toString() : '0' + (time % 60).toString();
		document.querySelector('.time').textContent = minutes + ':' + seconds; time++;
	}, 1000);
} else window.location.href = './lobby.html';

document.querySelector('.decline').addEventListener('click', () => {
	if (!id) return;
	localStorage.setItem('search', false);
	socket.emit('not-ready', id, session);
	window.location.href = './lobby.html';
});

socket.on('accept-game', lobby => {
	document.querySelectorAll('body *:not(.accept-game *)').forEach(element => element.style.display = 'none');
	document.querySelector('.accept-game').style.display = 'flex';
	document.querySelector('.accept-game__players').innerHTML = '';

	lobby.players.forEach((player, index) => {
		document.querySelector('.accept-game__players').innerHTML += `<div class="accept-game__player${ player.accepted ? ' accepted' : '' }"></div>`;
		document.querySelectorAll('.accept-game__player')[index].style.backgroundImage = `url('./assets/img/lobby/accepted.svg'), url('./assets/photos/${player.photo}.png')`;
	});

	document.querySelectorAll('.accept-game__button').forEach(element => element.addEventListener('click', () => {
		socket.emit('accept-game', id, session);
	}));
});

socket.on('ban-start', () => {
	localStorage.setItem('search', false);
	window.location.href = './lobby.html';
});

socket.on('ready-decline', () => {
	localStorage.setItem('search', false);
	window.location.href = './lobby.html';
});

socket.on('start-game', () => {
	localStorage.setItem('search', false);
	location.href = './index.html';
});

socket.on('search-refresh', () => window.location.reload());