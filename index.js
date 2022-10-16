import express from 'express';
import { Server } from 'socket.io';

import http from 'http';
import path from 'path';

import { startGame, initGame } from './modules/game.js';
import { Lobby, initializeLobby } from './modules/lobby.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import crypto from 'crypto';
import fs from 'fs';
import process from 'node:process';





const __dirname = dirname(fileURLToPath(import.meta.url));
let users = [];
let lobbies = [];
let searchLobbies = [];


fs.readFile('./users.json', (err, data) => users = JSON.parse(data.toString()));


// ----------------------------------------------------------------------------------------- //

const port = 3000;

let app = express();
let server = http.createServer(app);
let io = new Server(server);


app.use('/', express.static(__dirname + '/'));
app.use(cors());


app.get('/', (request, response) => {
	response.sendFile(path.join(__dirname, '/index.html'));
});

let userStack = [];

const createRoom = async (sockets, botFlag = false) => {
	return new Promise((resolve, reject) => {
		const room = {};

		room.id = crypto.randomBytes(16).toString("hex");
		room.sockets = [];
		room.users = [];

		room.botFlag = botFlag;

		sockets.forEach(socket => {
			if (socket.id != 'bot') socket.join(room.id);
			room.sockets.push(socket.id);
			room.users.push(socket.user);
		});

		room.players = [];
		room.turn = 0;
		room.wait = 0;

		room.cancel_cards = 0;
		room.health_cards = 0;
		room.turn_cards = [];

		room.timeout = { interval: null, time: 10 };
		room.shop = { cards: [], wait: 0, interval: null };
		room.indians = { len: 0, wait: 0, interval: null };
		room.duel = { players: [], wait: 0, interval: null };
		room.choose_three_cards = [];

		room.destroyed_choosed = false;
		room.player_choosed = -1;
		room.destroyed = [];

		resolve(room);
	});
}

process.on('beforeExit', () => {
	users.forEach(user => {
		user.socketId = null;
		user.tempSession = null;
		user.tempCode = null;
	});
	fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
});

io.on('connection', (socket) => {
	initializeLobby(io, socket, users, lobbies);

	socket.on('ready', (id, session) => {
		const userIndex = users.findIndex(item => item.gameId == id && item.session == session);
		if (~userIndex) {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].ready = true;
				socket.emit('ready');

				if (lobbies[lobbyIndex].players.every(item => item.ready)) {
					searchLobbies.push(Object.assign({}, lobbies[lobbyIndex]));
					// searchLobbies.push(lobbies[lobbyIndex]);
				}

				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
			}
		}
	});

	socket.on('not-ready', (id, session) => {
		const userIndex = users.findIndex(item => item.gameId == id && item.session == session);
		if (~userIndex) {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].ready = false;

				const searchLobbyIndex = searchLobbies.findIndex(item => item.id == lobbies[lobbyIndex].id);
				if (~searchLobbyIndex) searchLobbies.splice(searchLobbyIndex, 1);

				socket.emit('not-ready');
				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
			}
		}
	});

	socket.on('accept-game', (id, session) => {
		const userIndex = users.findIndex(item => item.gameId == id && item.session == session);
		if (~userIndex) {
			const lobbyIndex = searchLobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = searchLobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex && !searchLobbies[lobbyIndex].players[playerIndex].accepted) {
					searchLobbies[lobbyIndex].players[playerIndex].accepted = true;
					searchLobbies[lobbyIndex].players.forEach(player => {
						const index = users.findIndex(item => item.gameId == player.gameId);
						if (~index) io.to(users[index].socketId).emit('accept-game', searchLobbies[lobbyIndex]);
					});
				}
			}
		}
	});

	socket.on('start-game', (name, rating) => {
		userStack.push(socket);
		const lastUser = userStack[userStack.length - 1];

		lastUser.user = { name: name, rating: rating };

		lastUser.wait = 0;
		lastUser.average = { min: lastUser.user.rating - 50, max: lastUser.user.rating + 50 };
		lastUser.interval = setInterval(() => {
			const lobby = Lobby.searchLobby(lastUser);

			if (lobby !== false) Lobby.lobbies[lobby].addPlayer(lastUser);
			else Lobby.createLobby(lastUser);

			lastUser.wait++;
			lastUser.average.min -= 5;
			lastUser.average.max += 5;
			socket.emit('search-time', lastUser.wait);
		}, 1000);

		socket.emit('search-start');
	});

	socket.on('accept-game-receive', () => {
		const currentLobby = Lobby.lobbies[Lobby.lobbies.findIndex(lobby => ~lobby.players.findIndex(player => player.id == socket.id))];
		if (currentLobby) {
			if (!~currentLobby.accepted.findIndex(item => item == socket.id)) currentLobby.accepted.push(socket.id);

			if (currentLobby.accepted.length == 6 && currentLobby.accepted.every(item => ~currentLobby.accepted.findIndex(id => id == socket.id))) {
				createRoom(currentLobby.players).then(room => {
					initGame(io, currentLobby.players[0], room);
					currentLobby.players.forEach(player => startGame(io, player, room));
					Lobby.lobbies.splice(Lobby.lobbies.findIndex(item => item.id == currentLobby.id), 1);
					clearTimeout(currentLobby.accept_timeout);
				});
			}
		}
	});

	socket.on('search-end', () => {
		const currentLobby = Lobby.lobbies[Lobby.lobbies.findIndex(lobby => ~lobby.players.findIndex(player => player.id == socket.id))];
		if (currentLobby) {
			socket.emit('search-end');
			currentLobby.removePlayer(socket);
			userStack.splice(userStack.findIndex(player => player.id == socket.id), 1);
		}
	});

	socket.on('learn-game', (user) => {
		socket.user = user;
		createRoom([socket, { id: 'bot', user: { name: 'bot1', rating: 100 } }, { id: 'bot', user: { name: 'bot2', rating: 100 } }], true).then(room => {
			initGame(io, socket, room);
			startGame(io, socket, room);
		});
	});
});

setInterval(() => {
	// console.log('+-----------------------------------------------------------------------------+');
	// console.log(searchLobbies);
	// console.log('+-----------------------------------------------------------------------------+');
	for (let lobbyIndex = 0; lobbyIndex < searchLobbies.length; lobbyIndex++) {
		if (searchLobbies[lobbyIndex].players.length == 0) { searchLobbies.splice(lobbyIndex, 1); lobbyIndex--; }
		else if (searchLobbies[lobbyIndex].players.length == 3) {
			if (searchLobbies[lobbyIndex].state != 'accept') {
				searchLobbies[lobbyIndex].state = 'accept';
				searchLobbies[lobbyIndex].players.forEach(player => {
					const userIndex = users.findIndex(item => item.gameId == player.gameId);
					io.to(users[userIndex].socketId).emit('accept-game', searchLobbies[lobbyIndex]);
				});
			}
		} else if (0 < searchLobbies[lobbyIndex].players.length < 6) {
			searchLobbies[lobbyIndex].average = { min: searchLobbies[lobbyIndex].average.min - 10, max: searchLobbies[lobbyIndex].average.max + 10 };
			for (let index = 0; index < searchLobbies.length; index++) {
				if (searchLobbies[lobbyIndex].id == searchLobbies[index].id) continue;
				if (((searchLobbies[lobbyIndex].average.min >= searchLobbies[index].average.min && searchLobbies[lobbyIndex].average.min <= searchLobbies[index].average.max) ||
					 (searchLobbies[lobbyIndex].average.max >= searchLobbies[index].average.min && searchLobbies[lobbyIndex].average.max <= searchLobbies[index].average.max) ||
					 (searchLobbies[lobbyIndex].average.min >= searchLobbies[index].average.min && searchLobbies[lobbyIndex].average.max <= searchLobbies[index].average.max) ||
					 (searchLobbies[lobbyIndex].average.min <= searchLobbies[index].average.min && searchLobbies[lobbyIndex].average.max >= searchLobbies[index].average.max)) && 0 < searchLobbies[index].players.length < 6) {
					for (let playerIndex = 0; playerIndex < searchLobbies[index].players.length; playerIndex++) {
						searchLobbies[lobbyIndex].addPlayer(searchLobbies[index].players[playerIndex], false);
						searchLobbies[index].players.splice(playerIndex, 1); playerIndex--;
					};
					searchLobbies[lobbyIndex].average = { min: Math.round((searchLobbies[lobbyIndex].average.min + searchLobbies[index].average.min) / 2), max: Math.round((searchLobbies[lobbyIndex].average.max + searchLobbies[index].average.max) / 2) };
				}
			};
		}
	}
}, 1000);


server.listen(process.env.PORT || port, () => {});