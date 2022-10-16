import crypto from 'crypto';
import fs from 'fs';
import nodemailer from 'nodemailer';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import sqlite from 'sqlite3';
const sqlite3 = sqlite.verbose();

let db = new sqlite3.Database(path.join(__dirname, '/../bang.db'), sqlite3.OPEN_READWRITE, (err) => {
	if (err) console.error(err.message);

	db.run('CREATE TABLE users');
});

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



export class Lobby {
	constructor (players, rating) {
		this.players = [players];
		this.average = { min: rating - 50, max: rating + 50 };
		this.id = crypto.randomBytes(16).toString("hex");
		this.accepted = [];
		this.interval = null;
	}

	static searchLobby = (socket) => {
		for (let index = 0; index < this.#lobbies.length; index++) {
			if (((socket.average.min > this.#lobbies[index].average.min && socket.average.min < this.#lobbies[index].average.max) ||
				(socket.average.max > this.#lobbies[index].average.min && socket.average.max < this.#lobbies[index].average.max) ||
				(socket.average.min > this.#lobbies[index].average.min && socket.average.max < this.#lobbies[index].average.max) ||
				(socket.average.min < this.#lobbies[index].average.min && socket.average.max > this.#lobbies[index].average.max))
				&& this.#lobbies[index].players.length < 6) return index;
		}; return false;
	}

	static get lobbies () { return this.#lobbies }
	static #lobbies = [];

	startSearch = () => {
		this.interval = setInterval(() => {
			const lobby = this.searchLobby();

			if (lobby !== false) {
				let unionBreak = false;
				
				for (let i = 0; i < this.players.length; i++) {
					if (Lobby.lobbies[lobby].players.length < 6) {
						Lobby.lobbies[lobby].addPlayer(this.players[i], true);
						this.players.splice(i, 1); i--;
					} else { unionBreak = true; break; }
				}
				
				if (!unionBreak) {
					Lobby.#lobbies.splice(Lobby.#lobbies.findIndex(item => item.id === this.id), 1);
					clearInterval(this.interval);
				}
			}

			this.players.forEach(player => {
				player.wait++;
				io.to(player.id).emit('search-time', player.wait);
			});
			this.average.min -= 5;
			this.average.max += 5;
		}, 1000);
	}

	searchLobby = () => {
		for (let index = 0; index < Lobby.#lobbies.length; index++) {
			if (((this.average.min > Lobby.#lobbies[index].average.min && this.average.min < Lobby.#lobbies[index].average.max) ||
				(this.average.max > Lobby.#lobbies[index].average.min && this.average.max < Lobby.#lobbies[index].average.max) ||
				(this.average.min > Lobby.#lobbies[index].average.min && this.average.max < Lobby.#lobbies[index].average.max) ||
				(this.average.min < Lobby.#lobbies[index].average.min && this.average.max > Lobby.#lobbies[index].average.max))
				&& Lobby.#lobbies[index].players.length < 6 && this.players.length < 6) return index;
		}; return false;
	}

	addPlayer = (socket, setAverage=true) => {
		if (this.players.length < 6) {
			this.players.push(socket);
			if (setAverage) {
				const average =  Math.round(this.players.map(player => player.rating).reduce((sum, a) => sum + a, 0) / this.players.length);
				this.average = { min: average - 50, max: average + 50 };
			}
		}
	}

	removePlayer = (socket) => this.players.splice(this.players.findIndex(player => player.gameId == socket.gameId), 1);
}

export const initializeLobby = (io, socket, users, lobbies) => {
	if (socket.handshake.query.session) {
		const userIndex = users.findIndex(item => item.session == socket.handshake.query.session);
		if (~userIndex) users[userIndex].socketId = socket.id;
		fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
	}

	const checkSocket = (user, ip) => {
		// if (ip != user.headers['ip']) return 1;
		// if (socket.request.headers['sec-ch-ua'] != user.headers['sec-ch-ua']) return 2;
		// if (socket.request.headers['user-agent'] != user.headers['user-agent']) return 3;
		// if (socket.request.headers['sec-ch-ua-platform'] != user.headers['sec-ch-ua-platform']) return 4;
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

			socket.emit('profile', { username: users[userIndex].username, photo: users[userIndex].photo, rating: users[userIndex].rating, characters: users[userIndex].characters, friends: friends, requests: users[userIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId), inviteId: item.inviteId } }), gameId: users[userIndex].gameId });
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

	socket.on('add-friend', (sender, target, session) => {
		const senderIndex = users.findIndex(item => item.gameId == sender && item.session == session);
		const targetIndex = users.findIndex(item => item.gameId == target);

		if (~senderIndex && ~targetIndex) {
			if (~users[senderIndex].friends.findIndex(item => item.gameId == target) || ~users[targetIndex].requests.findIndex(item => item.gameId == sender)) return;
			users[targetIndex].requests.push(users[senderIndex]);
			users[targetIndex].requests[users[targetIndex].requests.length - 1].inviteId = crypto.randomBytes(30).toString("hex");
			io.to(users[targetIndex].socketId).emit('requests', users[targetIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId), inviteId: item.inviteId } }));
			fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
		}
	});

	socket.on('request-decline', (requestId, gameId, session) => {
		const targetIndex = users.findIndex(item => item.session == session);
		const senderIndex = users.findIndex(item => item.gameId == gameId);

		if (~targetIndex && ~senderIndex) {
			const requestIndex = users[targetIndex].requests.findIndex(item => item.inviteId == requestId);
			if (~requestIndex) {
				users[targetIndex].requests.splice(requestIndex, 1);

				let senderFriends = [];
				users[senderIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) senderFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: Boolean(users[friendIndex].socketId) });
				});
				users[senderIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', users[senderIndex].gameId, true);
				});

				let targetFriends = [];
				users[targetIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) targetFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: Boolean(users[friendIndex].socketId) });
				});
				users[targetIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', users[targetIndex].gameId, true);
				});

				io.to(users[senderIndex].socketId).emit('profile', {
					username: users[senderIndex].username,
					photo: users[senderIndex].photo,
					rating: users[senderIndex].rating,
					characters: users[senderIndex].characters,
					friends: senderFriends,
					requests: users[senderIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId) } }),
					gameId: users[senderIndex].gameId
				});
				io.to(users[targetIndex].socketId).emit('profile', {
					username: users[targetIndex].username,
					photo: users[targetIndex].photo,
					rating: users[targetIndex].rating,
					characters: users[targetIndex].characters,
					friends: targetFriends,
					requests: users[targetIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId) } }),
					gameId: users[targetIndex].gameId
				});
				io.to(users[targetIndex].socketId).emit('requests', users[targetIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId), inviteId: item.inviteId } }));
				fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
			}
		}
	});

	socket.on('request-accept', (requestId, gameId, session) => {
		const targetIndex = users.findIndex(item => item.session == session);
		const senderIndex = users.findIndex(item => item.gameId == gameId);

		if (~targetIndex && ~senderIndex && !~users[targetIndex].friends.findIndex(item => item.gameId == gameId)) {
			const requestIndex = users[targetIndex].requests.findIndex(item => item.inviteId == requestId);
			if (~requestIndex) {
				users[targetIndex].friends.push(users[senderIndex].gameId);
				users[senderIndex].friends.push(users[targetIndex].gameId);
				users[targetIndex].requests.splice(requestIndex, 1);

				let senderFriends = [];
				users[senderIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) senderFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: Boolean(users[friendIndex].socketId) });
				});
				users[senderIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', users[senderIndex].gameId, true);
				});

				let targetFriends = [];
				users[targetIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) targetFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: Boolean(users[friendIndex].socketId) });
				});
				users[targetIndex].friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', users[targetIndex].gameId, true);
				});

				io.to(users[senderIndex].socketId).emit('profile', {
					username: users[senderIndex].username,
					photo: users[senderIndex].photo,
					rating: users[senderIndex].rating,
					characters: users[senderIndex].characters,
					friends: senderFriends,
					requests: users[senderIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId) } }),
					gameId: users[senderIndex].gameId
				});
				io.to(users[targetIndex].socketId).emit('profile', {
					username: users[targetIndex].username,
					photo: users[targetIndex].photo,
					rating: users[targetIndex].rating,
					characters: users[targetIndex].characters,
					friends: targetFriends,
					requests: users[targetIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId) } }),
					gameId: users[targetIndex].gameId
				});
				io.to(users[targetIndex].socketId).emit('requests', users[targetIndex].requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: Boolean(item.socketId), inviteId: item.inviteId } }));
				fs.writeFile('./users.json', JSON.stringify(users, null, '\t'), () => {});
			}
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
					io.to(users[targetIndex].socketId).emit('not-ready');
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
}