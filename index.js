import express from 'express';
import { Server } from 'socket.io';

import http from 'http';
import path from 'path';

import { bans } from './modules/utils.js';

import { startGame, initGame } from './modules/game.js';
import { Lobby, initializeLobby } from './modules/lobby.js';
import { selectUserInTable, writeUserInTable } from './modules/database.js';

import { recoverPersonalSignature } from "eth-sig-util";
import { bufferToHex } from "ethereumjs-util";
import cookieParser from "cookie-parser";

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import ethereumAddress from 'ethereum-address';

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


// ----------------------------------------------------------------------------------------- //

const port = 3000;

let app = express();
let server = http.createServer(app);
let io = new Server(server);


app.get('/', (request, response) => {
	response.sendFile('./index.html', { root: __dirname });
});

app.get('/favicon.ico', (request, response) => {
	response.status(404).send({});
});

app.use(express.static(__dirname + '/client'));
app.use(cookieParser());

const nonceList = {};

app.get("/nonce", (request, response) => {
	console.log(nonceList)
	const { walletAddress } = request.query;
	const nonce = String(Math.floor(Math.random() * 10000));
	nonceList[walletAddress] = nonce;
	response.send({ nonce });
});

app.get("/verify", (request, response) => {
	const { walletAddress, signedNonce, session } = request.query;
	const nonce = nonceList[walletAddress];
	try {
		const hexNonce = bufferToHex(Buffer.from(nonce, "utf8"));
		const retrievedAddress = recoverPersonalSignature({
			data: hexNonce,
			sig: signedNonce,
		});

		db.all(`SELECT * FROM users WHERE wallet = '${walletAddress}' AND username<>''`, [], (error, rows) => {
			if (error) console.log(error);

			const rowIndex = rows.findIndex(item => item.wallet == retrievedAddress);
			if (~rowIndex && rows[rowIndex].session == session) { response.cookie("walletAddress", walletAddress).send({ success: true }); return; }
			else return response.send({ success: false });
		});
	} catch (err) {
		console.log(err);
		return response.send({ success: false });
	}
});

app.get("/check", (request, response) => {
	const { walletAddress } = request.cookies;
	if (walletAddress) {
		return response.send({ success: true, walletAddress });
	}
	return response.send({ success: false });
});

app.get("/logout", (request, response) => {
	response.clearCookie("walletAddress");
	response.send({ success: true });
});

app.get('/lobby', (request, response) => {
	response.sendFile('./client/lobby.html', { root: __dirname });
});

app.get('/rating', (request, response) => {
	response.sendFile('./client/rating.html', { root: __dirname });
});

app.get('/game', (request, response) => {
	response.sendFile('./client/index.html', { root: __dirname });
});

app.get('/search', (request, response) => {
	response.sendFile('./client/search.html', { root: __dirname });
});

app.get('/home', (request, response) => {
	response.sendFile('./client/home.html', { root: __dirname });
});

// app.get('*', (request, response) => {
// 	response.status(404).send(`<script>window.location.href = './lobby.html';</script>`);
// });



let rooms = [];

const createRoom = (players, botFlag = false) => {
	return new Promise((resolve, reject) => {
		const room = {};

		room.id = crypto.randomBytes(8).toString("hex");
		room.sockets = [];
		room.users = [];

		room.botFlag = botFlag;

		let promises = [];

		players.forEach(player => {
			promises.push(selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`));
		});

		Promise.all(promises).then(users => {
			users.forEach(user => {
				let socket = Array.from(io.sockets.sockets).find(item => item[0] == user.socketId);
				console.log(1, socket)
				if (socket) socket = socket[1]; else return;
				
				if (user.socketId != 'bot') socket.join(room.id);
				room.sockets.push(socket);
				room.users.push({ username: user.username, photo: user.photo, rating: user.rating, gameId: user.gameId, socketId: socket.id, session: user.session });
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
	});
}

selectUserInTable(db, 'SELECT * FROM users', false).then(users => {
	users.forEach(user => {
		if (user.ban <= Date.now()) user.ban = 0;
		else {
			setTimeout(() => {
				io.to(user.socketId).emit('ban-end');
				user.ban = 0;
				writeUserInTable(db, 0, user);
			}, user.ban - Date.now());
		}
	});
});


process.on("SIGINT", () => {
	db.run(`DELETE FROM users WHERE username=''`);
	fs.writeFile('./search.json', JSON.stringify([], null, '\t'), () => {});
	selectUserInTable(db, `SELECT * FROM users`, false).then(users => {
		users.forEach(user => {
			user.socketId = null;
			user.ban = 0;
			writeUserInTable(db, 0, user);
		});
	});
	setTimeout(() => process.exit(0), 100);
});

io.on('connection', (socket) => {
	initializeLobby(io, socket, users, lobbies);

	if (socket.handshake.query.session) {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${socket.handshake.query.session}'`).then(user => {
			user.socketId = socket.id;
			
			if (socket.handshake.query.extra == 'ready') socket.emit('game-id', user.gameId);
			
			const roomIndex = rooms.findIndex(item => ~item.players.findIndex(player => player.user.gameId == user.gameId));
			if (~roomIndex) {
				rooms[roomIndex].players[rooms[roomIndex].players.findIndex(player => player.user.gameId == user.gameId)].user.id = socket.id;

				const promises = [];
				rooms[roomIndex].players.forEach(player => promises.push(player.createMessage()));

				Promise.all(promises).then(players => {
					rooms[roomIndex].users.find(user => user.gameId == user.gameId).session = socket.handshake.query.session;
					socket.join(rooms[roomIndex].id)
					socket.emit('room-id', rooms[roomIndex].id);
					socket.emit('board', players);
					socket.emit('table', { card_count: rooms[roomIndex].shuffled.length, last_card: null });
					socket.emit('player', rooms[roomIndex].players[players.findIndex(player => player.user.gameId == user.gameId)]);
					startGame(io, socket, rooms[roomIndex]);
					return;
				});
			}


			const lobbyIndex = searchLobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == user.gameId));
			if (~lobbyIndex) {
				const playerIndex = searchLobbies[lobbyIndex].players.findIndex(item => item.gameId == user.gameId);
				if (~playerIndex && searchLobbies[lobbyIndex].players[playerIndex].inGame && socket.handshake.query.extra == 'start-game') {
					searchLobbies[lobbyIndex].players[playerIndex].loaded = true;
				}
			}

			writeUserInTable(db, 2, user);
		});
		fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
	}
	
	if (socket.handshake.query.extra == 'get-rating') {
		selectUserInTable(db, `SELECT * FROM users`, false).then(users => {
			socket.emit(socket.emit('rating', users.sort((a, b) => b.tournament - a.tournament).map(user => { return { username: user.username, photo: user.photo, rating: user.rating, tournament: user.tournament } }).slice(0, 100)));
		});
	}

	socket.on('session', (wallet, flag) => {
		console.log(wallet)
		selectUserInTable(db, `SELECT * FROM users WHERE wallet='${wallet}'`, true, () => {
			if (ethereumAddress.isAddress(wallet)) {
				const session = crypto.randomBytes(16).toString("hex");
				db.run(`INSERT INTO users (wallet, session, gameId) VALUES ('${wallet}', '${session}', '${crypto.randomBytes(16).toString("hex")}')`);
				socket.emit('get-username', session);
			}
		}).then(user => {		
			if (user.username == '') socket.emit('get-username', user.session);
			else {
				user.session = crypto.randomBytes(16).toString("hex");
				user.socketId = socket.id;
				socket.emit('session', user.session);
				writeUserInTable(db, 3, user);
			}
		});
	});

	socket.on('set-username', (username, session, wallet) => {
		selectUserInTable(db, `SELECT * FROM users WHERE wallet='${wallet}' AND session='${session}' AND username=''`).then(user => {
			if (username.length >= 3 && username.length <= 99) {
				const english = /^[A-Za-z0-9]*$/;
				if (english.test(username)) {
					selectUserInTable(db, `SELECT * FROM users WHERE username='${username}'`, true, () => {
						user.username = username;
						writeUserInTable(db, 0, user);
						socket.emit('accept-username');
					}).then(() => socket.emit('decline-username', 1));
				} else socket.emit('decline-username', 2);
			} else socket.emit('decline-username', 0);
		});
	});

	socket.on('get-short-profile', session => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}'`).then(user => {
			socket.emit('short-profile', { photo: user.photo, username: user.username, rating: user.rating });
		});
	});

	socket.on('search-start', (id, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}' AND gameId='${id}' AND ban=0`, true, () => socket.emit('ready-decline')).then(user => {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].search = true;

				if (lobbies[lobbyIndex].players.every(item => item.search)) {
					lobbies[lobbyIndex].players.forEach(player => {
						selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(player => {
							io.to(player.socketId).emit('ready');
						});
					});
				}

				socket.emit('search-start');
				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			} else socket.emit('ready-decline');
		});
	});

	socket.on('search-end', (id, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}' AND gameId='${id}' AND ban=0`).then(user => {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].search = false;

				socket.emit('search-end');
				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			}
		});
	});

	socket.on('ready', (id, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}' AND gameId='${id}' AND ban=0`, true, () => socket.emit('ready-decline')).then(user => {
			const lobbyIndex = lobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex) lobbies[lobbyIndex].players[playerIndex].ready = true;

				if (lobbies[lobbyIndex].players.every(item => item.search)) {
					searchLobbies.push(Object.assign({}, lobbies[lobbyIndex]));
				}

				fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			} else socket.emit('ready-decline');
		});
	});

	socket.on('not-ready', (id, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}' AND gameId='${id}' AND ban=0`).then(user => {
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
		});
	});

	socket.on('accept-game', (id, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}' AND gameId='${id}' AND ban=0`).then(user => {
			const lobbyIndex = searchLobbies.findIndex(item => ~item.players.findIndex(player => player.gameId == id));
			if (~lobbyIndex) {
				const playerIndex = searchLobbies[lobbyIndex].players.findIndex(player => player.gameId == id);
				if (~playerIndex && !searchLobbies[lobbyIndex].players[playerIndex].accepted) {
					searchLobbies[lobbyIndex].players[playerIndex].accepted = true;
					searchLobbies[lobbyIndex].players.forEach(player => {
						selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
							io.to(user.socketId).emit('accept-game', searchLobbies[lobbyIndex]);
						});
					});
				}
			}
		});
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
		try {
		if (searchLobbies[lobbyIndex].players.length == 0) { searchLobbies.splice(lobbyIndex, 1); lobbyIndex--; }
		else if (searchLobbies[lobbyIndex].players.length == 3) {
			if (searchLobbies[lobbyIndex].state != 'accept') {
				searchLobbies[lobbyIndex].state = 'accept';

				searchLobbies[lobbyIndex].players.forEach(player => {
					selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
						console.log(user.socketId)
						io.to(user.socketId).emit('accept-game', searchLobbies[lobbyIndex]);
					});
				});

				setTimeout(() => {
					try {
					const indices = (function getAllIndices (arr, cb) {
						let indices = [], i = -1;
						while (~arr.slice(i + 1).findIndex(cb)) { i += arr.slice(i + 1).findIndex(cb) + 1; indices.push(i); }
						return indices;
					})(searchLobbies[lobbyIndex].players, item => !item.accepted);

					console.log(indices)

					for (let i = 0; i < indices.length; i++) {
						selectUserInTable(db, `SELECT * FROM users WHERE gameId='${searchLobbies[lobbyIndex].players[indices[i] - i].gameId}'`).then(user => {
							searchLobbies[lobbyIndex].players.splice(indices[i] - i, 1);

							const banTime = bans[user.banLevel <= 10 ? user.banLevel : 10] * 60000
							user.ban = Date.now() + banTime;
							user.banLevel++;
							io.to(user.socketId).emit('ban-start', user.ban);

							setTimeout(() => {
								io.to(user.socketId).emit('ban-end');
								user.ban = 0;
								writeUserInTable(db, 4, user);
							}, banTime);

							writeUserInTable(db, 5, user);
						});
					};
					

					searchLobbies[lobbyIndex].players.forEach(player => {
						selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
							io.to(user.socketId).emit('search-refresh');
						});
					});
					} catch (e) {console.log(searchLobbies, e)}
				}, 10000);

				fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
			} else {
				if (searchLobbies[lobbyIndex].players.every(player => player.accepted) && !searchLobbies[lobbyIndex].players.every(player => player.loaded)) {
					searchLobbies[lobbyIndex].players.forEach((player, index) => {
						selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
							searchLobbies[lobbyIndex].players[index].inGame = true;
							io.to(user.socketId).emit('start-game');
							fs.writeFile('./search.json', JSON.stringify(searchLobbies, null, '\t'), () => {});
						});
					});
				} else if (searchLobbies[lobbyIndex].players.every(player => player.loaded)) {
					selectUserInTable(db, `SELECT * FROM users WHERE gameId='${searchLobbies[lobbyIndex].players[0].gameId}'`).then(user => {
						createRoom(searchLobbies[lobbyIndex].players).then(room => {
							console.log(room)
							initGame(io, room.sockets[0], room);
							room.sockets.forEach(socket => startGame(io, socket, room));
							rooms.push(room);
							searchLobbies.splice(searchLobbies.findIndex(item => item.id == searchLobbies[lobbyIndex].id), 1);
						});
					});
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
	} catch (e) {console.log(lobbyIndex, e)}
	}
}, 1000);


// setInterval(() => {
// 	db.serialize(() => {
// 		db.all('SELECT * FROM users', (err, rows) => {
// 			console.log(rows)
// 		});
// 	});
// }, 3000);


server.listen(process.env.PORT || port, () => {
	console.log('Stating server on port ' + process.env.PORT || port);
});