import express from 'express';
import { Server } from 'socket.io';

import http from 'http';
import path from 'path';

import { bans } from './modules/utils.js';

import { startGame, initGame } from './modules/game.js';
import { Lobby, initializeLobby } from './modules/lobby.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import crypto from 'crypto';
import fs from 'fs';
import process from 'node:process';


import sql from 'sqlite3'
const sqlite3 = sql.verbose();
let db = new sqlite3.Database('./bang.db', sqlite3.OPEN_READWRITE, (err) => { if (err) console.error(err.message) });



const __dirname = dirname(fileURLToPath(import.meta.url));
let users = [];
let lobbies = [];
let searchLobbies = [];


db.all(`SELECT * FROM users WHERE username='bot3'`, [], (err, rows) => {
	console.log(rows)
});


// fs.readFile('./users.json', (err, data) => users = JSON.parse(data.toString()));
// fs.readFile('./lobbies.json', (err, data) => lobbies = JSON.parse(data.toString()));


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

let rooms = [];

const createRoom = async (players, botFlag = false) => {
	return new Promise((resolve, reject) => {
		const room = {};

		room.id = crypto.randomBytes(8).toString("hex");
		room.sockets = [];
		room.users = [];

		room.botFlag = botFlag;

		players.forEach(player => {
			const userIndex = users.findIndex(item => item.gameId == player.gameId);
			if (!~userIndex) return;

			let socket = Array.from(io.sockets.sockets).find(item => item[0] == users[userIndex].socketId);
			if (socket) socket = socket[1]; else return;

			if (player.socketId != 'bot') socket.join(room.id);
			room.sockets.push(socket);
			room.users.push({ username: player.username, photo: player.photo, rating: player.rating, gameId: player.gameId, socketId: socket.id, session: users[userIndex].session });
		});

		room.players = [];
		room.history = [[]];
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

users.forEach(user => {
	if (user.ban <= Date.now()) user.ban = null;
	else {
		setTimeout(() => {
			io.to(user.socketId).emit('ban-end');
			user.ban = null;
			fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
		}, user.ban - Date.now());
	}
});


process.on("SIGINT", () => {
	users.forEach(user => {
		user.socketId = null;
		user.tempSession = null;
		user.tempCode = null;
		user.ban = null;
	});
	fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
	setTimeout(() => process.exit(0), 100);
});

io.on('connection', (socket) => {
	initializeLobby(io, socket, users, lobbies);

	if (socket.handshake.query.session) {
		const userIndex = users.findIndex(item => item.session == socket.handshake.query.session);
		if (~userIndex) {
			if (socket.handshake.query.extra == 'ready') socket.emit('game-id', users[userIndex].gameId);
			
			const roomIndex = rooms.findIndex(item => ~item.players.findIndex(player => player.user.gameId == users[userIndex].gameId));
			if (~roomIndex) {
				rooms[roomIndex].players[rooms[roomIndex].players.findIndex(player => player.user.gameId == users[userIndex].gameId)].user.id = socket.id;

				const promises = [];
				rooms[roomIndex].players.forEach(player => promises.push(player.createMessage()));

				Promise.all(promises).then(players => {
					rooms[roomIndex].users.find(user => user.gameId == users[userIndex].gameId).session = socket.handshake.query.session;
					socket.join(rooms[roomIndex].id)
					socket.emit('room-id', rooms[roomIndex].id);
					socket.emit('board', players);
					socket.emit('table', { card_count: rooms[roomIndex].shuffled.length, last_card: null });
					socket.emit('player', rooms[roomIndex].players[players.findIndex(player => player.user.gameId == users[userIndex].gameId)]);
					startGame(io, socket, rooms[roomIndex]);
					return;
				});
			}


			const lobbyIndex = searchLobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == users[userIndex].gameId));
			if (~lobbyIndex) {
				const playerIndex = searchLobbies[lobbyIndex].players.findIndex(item => item.gameId == users[userIndex].gameId);
				if (~playerIndex && searchLobbies[lobbyIndex].players[playerIndex].inGame && socket.handshake.query.extra == 'start-game') {
					searchLobbies[lobbyIndex].players[userIndex].loaded = true;
				}
			}
		}
		fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
	}

	socket.on('ready', (id, session) => {
		const userIndex = users.findIndex(item => item.gameId == id && item.session == session && item.ban === null);
		if (~userIndex) {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].ready = true;
				socket.emit('ready');

				if (lobbies[lobbyIndex].players.every(item => item.ready)) {
					searchLobbies.push(Object.assign({}, lobbies[lobbyIndex]));
				}

				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			} else socket.emit('ready-decline');
		} else socket.emit('ready-decline');
	});

	socket.on('not-ready', (id, session) => {
		const userIndex = users.findIndex(item => item.gameId == id && item.session == session && item.ban === null);
		if (~userIndex) {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].ready = false;

				const searchLobbyIndex = searchLobbies.findIndex(item => item.id == lobbies[lobbyIndex].id);
				if (~searchLobbyIndex) searchLobbies.splice(searchLobbyIndex, 1);

				socket.emit('not-ready');
				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			}
		}
	});

	socket.on('accept-game', (id, session) => {
		const userIndex = users.findIndex(item => item.gameId == id && item.session == session && item.ban === null);
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
		fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
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
	for (let lobbyIndex = 0; lobbyIndex < searchLobbies.length; lobbyIndex++) {
		if (searchLobbies[lobbyIndex].players.length == 0) { searchLobbies.splice(lobbyIndex, 1); lobbyIndex--; }
		else if (searchLobbies[lobbyIndex].players.length == 2) {
			if (searchLobbies[lobbyIndex].state != 'accept') {
				searchLobbies[lobbyIndex].state = 'accept';
				searchLobbies[lobbyIndex].players.forEach(player => {
					const userIndex = users.findIndex(item => item.gameId == player.gameId);
					if (~userIndex) io.to(users[userIndex].socketId).emit('accept-game', searchLobbies[lobbyIndex]);
				});

				setTimeout(() => {
					const indices = (function getAllIndices (arr, cb) {
						let indices = [], i = -1;
						while (~arr.slice(i + 1).findIndex(cb)) { i += arr.slice(i + 1).findIndex(cb) + 1; indices.push(i); }
						return indices;
					})(searchLobbies[lobbyIndex].players, item => !item.accepted);

					for (let i = 0; i < indices.length; i++) {
						const userIndex = users.findIndex(item => item.gameId == searchLobbies[lobbyIndex].players[indices[i] - i].gameId);
						if (~userIndex) {
							searchLobbies[lobbyIndex].players.splice(indices[i] - i, 1);

							const banTime = bans[users[userIndex].banLevel <= 10 ? users[userIndex].banLevel : 10] * 60000
							users[userIndex].ban = Date.now() + banTime;
							users[userIndex].banLevel++;
							io.to(users[userIndex].socketId).emit('ban-start', users[userIndex].ban);
							setTimeout(() => {
								io.to(users[userIndex].socketId).emit('ban-end');
								users[userIndex].ban = null;
								fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
							}, banTime);
						}
					};

					searchLobbies[lobbyIndex].players.forEach(player => {
						const userIndex = users.findIndex(item => item.gameId == player.gameId);
						if (~userIndex) io.to(users[userIndex].socketId).emit('search-refresh');
					});
					fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
				}, 5000);

				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			} else {
				if (searchLobbies[lobbyIndex].players.every(player => player.accepted) && !searchLobbies[lobbyIndex].players.every(player => player.loaded)) {
					searchLobbies[lobbyIndex].players.forEach((player, index) => {
						const userIndex = users.findIndex(item => item.gameId == player.gameId);
						if (~userIndex) {
							searchLobbies[lobbyIndex].players[index].inGame = true;
							io.to(users[userIndex].socketId).emit('start-game');
							fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
						}
					});
				} else if (searchLobbies[lobbyIndex].players.every(player => player.loaded)) {
					const userIndex = users.findIndex(item => item.gameId == searchLobbies[lobbyIndex].players[0].gameId);
					if (~userIndex) {
						createRoom(searchLobbies[lobbyIndex].players).then(room => {
							initGame(io, room.sockets[0], room);
							room.sockets.forEach(socket => startGame(io, socket, room));
							rooms.push(room);
							searchLobbies.splice(searchLobbies.findIndex(item => item.id == searchLobbies[lobbyIndex].id), 1);
						});
					}
				}
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