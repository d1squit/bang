import express from 'express';
import { Server } from 'socket.io';

import http from 'http';
import path from 'path';

import { startGame, initGame } from './modules/game.js';
import { Lobby } from './modules/lobby.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import crypto from 'crypto';
import fs from 'fs';
import nodemailer from 'nodemailer';




const sendMail = async (mail) => {
	const transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: 'anat.yudin06@gmail.com',
			pass: 'ajranbgtiukrikxs'
		}
	});

	await transporter.sendMail(mail);
}


const __dirname = dirname(fileURLToPath(import.meta.url));
let users = [];
let lobbies = [];


fs.readFile('./users.json', (err, data) => users = JSON.parse(data.toString()));
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

io.on('connection', (socket) => {
	if (socket.handshake.query.session) {
		const userIndex = users.findIndex(item => item.session == socket.handshake.query.session);
		if (~userIndex) users[userIndex].socketId = socket.id;
		fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
	}

	const checkSocket = (user, ip) => {
		if (ip != user.headers['ip']) return 1;
		if (socket.request.headers['sec-ch-ua'] != user.headers['sec-ch-ua']) return 2;
		if (socket.request.headers['user-agent'] != user.headers['user-agent']) return 3;
		if (socket.request.headers['sec-ch-ua-platform'] != user.headers['sec-ch-ua-platform']) return 4;
		return true;
	}

	const decline = (error, userIndex = null) => {
		console.log(error)
		if (!users[userIndex]) socket.emit('decline', error);
		else {
			socket.emit('decline', error, users[userIndex].tempSession = crypto.randomBytes(16).toString("hex"));
			if (~error) sendMail({ from: 'BANG', to: 'anat.yudin06@gmail.com', subject: 'Login attempted from new device', html: `To verify your identity, follow the link: <a href="http://localhost:3000/client/verification.html?code=${users[userIndex].tempCode = crypto.randomBytes(16).toString("hex")}">VERIFICATION</a>` });
		}
	}

	socket.on('disconnect', () => {
		const userIndex = users.findIndex(item => item.socketId == socket.id);
		if (~userIndex) {
			users[userIndex].friends.forEach(friendId => {
				const friendIndex = users.findIndex(item => item.gameId == friendId);
				if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', users[userIndex].gameId, false);
			});

			const lobbyIndex = lobbies.findIndex(item => item.id == users[userIndex].lobbyId);
			if (~lobbyIndex) {
				lobbies[lobbyIndex].players.forEach((player, index) => {
					const playerIndex = users.findIndex(item => item.gameId == player.gameId);
					if (player.gameId == users[userIndex].gameId) lobbies[lobbyIndex].players[index].online = false;
					if (~playerIndex) io.to(users[playerIndex].socketId).emit('lobby-state', users[userIndex].gameId, false);
				});
			}

			users[userIndex].socketId = null;
		}
		fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
		fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
	});

	socket.on('login', (login, password) => {
		const userIndex = users.findIndex(item => item.login == login && item.password == password);
		if (~userIndex) {
			users[userIndex].socketId = socket.id;
			socket.emit('lobby-redirect', users[userIndex].session = crypto.randomBytes(16).toString("hex"));
			fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
		} else decline(userIndex);
	});

	socket.on('logout', (session, ip) => {
		const userIndex = users.findIndex(item => item.session == session && session);
		if (~userIndex) {
			const verification = checkSocket(users[userIndex], ip);
			if (verification !== true) { decline(verification, userIndex); return false; }
			socket.emit('login-redirect', users[userIndex].session = null);
			fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
		} else decline(userIndex);
	});

	socket.on('verification', (session, code, ip) => {
		const userIndex = users.findIndex(item => item.tempSession == session && session);
		if (~userIndex) {
			if (code == users[userIndex].tempCode) {
				users[userIndex].socketId = socket.id;
				users[userIndex].headers['ip'] = ip;
				users[userIndex].headers['sec-ch-ua'] = socket.request.headers['sec-ch-ua'];
				users[userIndex].headers['user-agent'] = socket.request.headers['user-agent'];
				users[userIndex].headers['sec-ch-ua-platform'] = socket.request.headers['sec-ch-ua-platform'];
				socket.emit('login-redirect');
				fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
			}
		} else decline(userIndex);
	});

	socket.on('get-profile', (session, ip) => {
		const userIndex = users.findIndex(item => item.session == session && session);
		if (~userIndex) {
			const verification = checkSocket(users[userIndex], ip);
			if (verification !== true) { decline(verification, userIndex); return false; }
			users[userIndex].socketId = socket.id;

			let friends = [];
			users[userIndex].friends.forEach(friendId => {
				const friendIndex = users.findIndex(item => item.gameId == friendId);
				if (~friendIndex) friends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: Boolean(users[friendIndex].socketId) });
			});

			users[userIndex].friends.forEach(friendId => {
				const friendIndex = users.findIndex(item => item.gameId == friendId);
				if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', users[userIndex].gameId, true);
			});

			socket.emit('profile', { username: users[userIndex].username, photo: users[userIndex].photo, rating: users[userIndex].rating, characters: users[userIndex].characters, friends: friends, gameId: users[userIndex].gameId });
			fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
			
			let lobbyIndex = -1;
			if (users[userIndex].lobbyId) lobbyIndex = lobbies.findIndex(item => item.id == users[userIndex].lobbyId);
			if (~lobbyIndex) {
				io.to(users[userIndex].socketId).emit('lobby', lobbies[lobbyIndex]);
				lobbies[lobbyIndex].players.forEach(player => {
					const playerIndex = users.findIndex(item => item.gameId == player.gameId);
					if (~playerIndex) io.to(users[playerIndex].socketId).emit('lobby-state', users[userIndex].gameId, true);
				});
			} else {
				lobbies.push(new Lobby({ username: users[userIndex].username, photo: users[userIndex].photo, rating: users[userIndex].rating, gameId: users[userIndex].gameId, online: Boolean(users[userIndex].socketId) }, users[userIndex].rating));
				users[userIndex].lobbyId = lobbies[lobbies.length - 1].id;
				socket.emit('lobby', lobbies[lobbies.length - 1]);
			}
			
			
			fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
		} else decline(userIndex);
	});

	socket.on('invite', (sender, target, session) => {
		const senderIndex = users.findIndex(item => item.gameId == sender && item.session == session);
		const targetIndex = users.findIndex(item => item.gameId == target);
		const lobbyIndex = lobbies.findIndex(item => item.id == users[senderIndex].lobbyId);

		if (~senderIndex && ~targetIndex) {
			if (~lobbyIndex && ~lobbies[lobbyIndex].players.findIndex(item => item.gameId == users[targetIndex].gameId)) return;

			const inviteId = crypto.randomBytes(30).toString("hex");
			users[senderIndex].invites.push(inviteId);
			io.to(users[targetIndex].socketId).emit('invite', {	username: users[senderIndex].username, id: users[senderIndex].gameId }, inviteId);
			fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});

			setTimeout(() => {
				const inviteIndex = users[senderIndex].invites.findIndex(item => item == inviteId);
				if (~inviteIndex) {
					users[senderIndex].invites.splice(inviteIndex, 1);
					fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
				}
			}, 30000);
		}
	});

	socket.on('get-users', (key, session) => {
		const userIndex = users.findIndex(item => item.session == session);
		if (~userIndex) socket.emit('users', users.filter(item => item.username.includes(key) && item.gameId != users[userIndex].gameId).map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId) } }));
	});

	socket.on('kick', (sender, target, session) => {
		const senderIndex = users.findIndex(item => item.gameId == sender && item.session == session);
		const targetIndex = users.findIndex(item => item.gameId == target);
		const lobbyIndex = lobbies.findIndex(item => item.id == users[senderIndex].lobbyId);

		if (~senderIndex && ~targetIndex && ~lobbyIndex) {
			if (senderIndex == targetIndex) {
				const inLobbyIndex = lobbies[lobbyIndex].players.findIndex(item => item.gameId == sender);
				if (~inLobbyIndex) {
					lobbies[lobbyIndex].players.splice(inLobbyIndex, 1);
					if (lobbies[lobbyIndex].players.length == 0) lobbies.splice(lobbyIndex, 1);
					else {
						lobbies[lobbyIndex].players.forEach(player => {
							const userIndex = users.findIndex(item => item.gameId == player.gameId);
							if (~userIndex) io.to(users[userIndex].socketId).emit('lobby', lobbies[lobbyIndex]);
						});
					}
					lobbies.push(new Lobby({ username: users[senderIndex].username, photo: users[senderIndex].photo, rating: users[senderIndex].rating, gameId: users[senderIndex].gameId, online: Boolean(users[senderIndex].socketId) }, users[senderIndex].rating));
					users[senderIndex].lobbyId = lobbies[lobbies.length - 1].id;
					io.to(users[senderIndex].socketId).emit('lobby', lobbies[lobbies.length - 1]);
				}
			} else if (lobbies[lobbyIndex].players[0].gameId == sender) {
				const inLobbyIndex = lobbies[lobbyIndex].players.findIndex(item => item.gameId == target);
				if (~inLobbyIndex) {
					lobbies[lobbyIndex].players.splice(inLobbyIndex, 1);
					if (lobbies[lobbyIndex].players.length == 0) lobbies.splice(lobbyIndex, 1);
					else {
						lobbies[lobbyIndex].players.forEach(player => {
							const userIndex = users.findIndex(item => item.gameId == player.gameId);
							if (~userIndex) io.to(users[userIndex].socketId).emit('lobby', lobbies[lobbyIndex]);
						});
					}
					lobbies.push(new Lobby({ username: users[targetIndex].username, photo: users[targetIndex].photo, rating: users[targetIndex].rating, gameId: users[targetIndex].gameId, online: Boolean(users[targetIndex].socketId) }, users[targetIndex].rating));
					users[targetIndex].lobbyId = lobbies[lobbies.length - 1].id;
					io.to(users[targetIndex].socketId).emit('lobby', lobbies[lobbies.length - 1]);
					io.to(users[senderIndex].socketId).emit('lobby', lobbies[lobbyIndex]);
				}
			}
		}
	});

	socket.on('invite-decline', (sender, inviteId) => {
		const senderIndex = users.findIndex(item => item.gameId == sender);
		const targetIndex = users.findIndex(item => item.socketId == socket.id);

		if (~senderIndex && ~targetIndex) {
			const inviteIndex = users[senderIndex].invites.findIndex(item => item == inviteId);
			if (~inviteIndex) {
				io.to(users[targetIndex].socketId).emit('invite-next');
				users[senderIndex].invites.splice(inviteIndex, 1);
				fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
			}
		}
	});

	socket.on('invite-accept', (sender, inviteId) => {
		const senderIndex = users.findIndex(item => item.gameId == sender);
		const targetIndex = users.findIndex(item => item.socketId == socket.id);
		
		if (~senderIndex && ~targetIndex) {
			const inviteIndex = users[senderIndex].invites.findIndex(item => item == inviteId);
			if (~inviteIndex) {
				io.to(users[targetIndex].socketId).emit('invite-next');
				users[senderIndex].invites.splice(inviteIndex, 1);
				fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});

				const oldLobbyIndex = lobbies.findIndex(item => item.id == users[targetIndex].lobbyId);
				if (~oldLobbyIndex) {
					const playerIndex = lobbies[oldLobbyIndex].players.findIndex(item => item.gameId == users[targetIndex].gameId);
					if (~playerIndex) lobbies[oldLobbyIndex].players.splice(playerIndex, 1);
					if (lobbies[oldLobbyIndex].players.length == 0) lobbies.splice(oldLobbyIndex, 1);
					else {
						lobbies[oldLobbyIndex].players.forEach(player => {
							const userIndex = users.findIndex(item => item.gameId == player.gameId);
							if (~userIndex) io.to(users[userIndex].socketId).emit('lobby', lobbies[oldLobbyIndex]);
						});
					}
				}

				const lobbyIndex = lobbies.findIndex(item => item.id == users[senderIndex].lobbyId);
				if (~lobbyIndex) {
					users[targetIndex].lobbyId = lobbies[lobbyIndex].id;
					const target = { username: users[targetIndex].username, photo: users[targetIndex].photo, rating: users[targetIndex].rating, gameId: users[targetIndex].gameId, online: Boolean(users[targetIndex].socketId) };
					lobbies[lobbyIndex].addPlayer(target);
					lobbies[lobbyIndex].players.forEach(player => {
						const userIndex = users.findIndex(item => item.gameId == player.gameId);
						if (~userIndex) io.to(users[userIndex].socketId).emit('lobby', lobbies[lobbyIndex]);
					});
					fs.writeFile('./lobbies.json', JSON.stringify(lobbies, null, '\t'), () => {});
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
	// console.log(userStack.map(item => item.user.name))
	for (let i = 0; i < Lobby.lobbies.length; i++) {
		if (Lobby.lobbies[i].players.length == 6) {
			if (!Lobby.lobbies[i].accept_timeout) {
				Lobby.lobbies[i].players.forEach(player => io.to(player.id).emit('accept-game-send'));
				Lobby.lobbies[i].accept_timeout = setTimeout(() => {
					if (Lobby.lobbies[i].players.length == 0) return;
					clearTimeout(Lobby.lobbies[i].accept_timeout);
					Lobby.lobbies[i].accept_timeout = null;

					for (let j = 0; j < Lobby.lobbies[i].players.length; j++) {
						if (!~Lobby.lobbies[i].accepted.findIndex(item => item == Lobby.lobbies[i].players[j].id)) {
							Lobby.lobbies[i].players.splice(j, 1); j--;
						}
					};
					Lobby.lobbies[i].accepted = [];
				}, 10000);
			}
		}
		else if (Lobby.lobbies[i].players.length == 0) Lobby.lobbies.splice(i, 1);
	}
}, 600);


server.listen(process.env.PORT || port, () => {});