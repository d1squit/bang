import crypto from 'crypto';
import fs from 'fs';
import { selectUserInTable, writeUserInTable } from './database.js';

import sql from 'sqlite3'
const sqlite3 = sql.verbose();
let db = new sqlite3.Database('./bang.db', sqlite3.OPEN_READWRITE, (err) => { if (err) console.error(err.message) });



export class Lobby {
	constructor (players, rating) {
		this.players = players ? [players] : [];
		this.average = { min: rating - 50, max: rating + 50 };
		this.id = crypto.randomBytes(16).toString("hex");
		this.accepted = [];
		this.interval = null;
		this.parties = 1;
		this.competitive = false;
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
						Lobby.lobbies[lobby].addPlayer(this.players[i], Lobby.lobbies[lobby].parties, true);
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

	addPlayer = (socket, party, setAverage=true, byInvite=false) => {
		if (byInvite && this.competitive && this.players.length > 1) return;
		if (this.players.length < 6) {
			this.players.push(socket);
			this.players[this.players.length - 1].party = party;
			if (setAverage) {
				const average =  Math.round(this.players.map(player => player.rating).reduce((sum, a) => sum + a, 0) / this.players.length);
				this.average = { min: average - 50, max: average + 50 };
			}
		}
	}

	removePlayer = (socket) => this.players.splice(this.players.findIndex(player => player.gameId == socket.gameId), 1);

	changeMode = (mode) => {
		if (mode) {
			if (this.players.length <= 2) this.competitive = mode;
			else return false;
		} else this.competitive = mode;
		return true;
	}
}


export const initializeLobby = (io, socket, users, lobbies, searchLobbies) => {
	if (socket.handshake.query.session) {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${socket.handshake.query.session}'`).then(user => {
			user.socketId = socket.id;
			writeUserInTable(db, 11, user);
		});
	}

	socket.on('disconnect', () => {
		selectUserInTable(db, `SELECT * FROM users WHERE socketId='${socket.id}'`).then(user => {
			user.friends.forEach(friendId => {
				const friendIndex = users.findIndex(item => item.gameId == friendId);
				if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', user.gameId, false);
			});

			const lobbyIndex = lobbies.findIndex(item => item.id == user.lobbyId);
			if (~lobbyIndex) {
				lobbies[lobbyIndex].players.forEach((player, index) => {
					const playerIndex = users.findIndex(item => item.gameId == player.gameId);
					if (player.gameId == user.gameId) lobbies[lobbyIndex].players[index].online = false;
					if (~playerIndex) io.to(users[playerIndex].socketId).emit('lobby-state', user.gameId, false);
				});
			}

			user.socketId = null;
			writeUserInTable(db, 12, user);
		});
	});

	socket.on('change-mode', (session, mode) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}'`).then(user => {
			const lobbyIndex = lobbies.findIndex(item => item.id == user.lobbyId);
			if (~lobbyIndex) {
				if (lobbies[lobbyIndex].changeMode(mode)) socket.emit('change-mode-success', mode);
				else socket.emit('change-mode-decline', mode);
				socket.emit('lobby', lobbies[lobbyIndex]);
			}
		});
	});

	socket.on('get-profile', (session, ip) => {
		if (!session) return;
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}'`).then(user => {
			selectUserInTable(db, `SELECT * FROM users`, false).then(users => {
				user.socketId = socket.id;

				let friends = [];
				user.friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) friends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: users[friendIndex].socketId != 'null' });
				});

				user.friends.forEach(friendId => {
					const friendIndex = users.findIndex(item => item.gameId == friendId);
					if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', user.gameId, true);
				});

				if (user.ban > 0) socket.emit('ban-start', user.ban);
				socket.emit('profile', { username: user.username, photo: user.photo, rating: user.rating, characters: user.characters, friends: friends, requests: user.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null', inviteId: item.inviteId } }), gameId: user.gameId });

				let lobbyIndex = -1;
				if (user.lobbyId) lobbyIndex = lobbies.findIndex(item => item.id == user.lobbyId) == -1 ? searchLobbies.findIndex(item => item.id == user.lobbyId) : lobbies.findIndex(item => item.id == user.lobbyId);
				if (~lobbyIndex) {
					io.to(user.socketId).emit('lobby', lobbies[lobbyIndex]);
					lobbies[lobbyIndex].players.forEach(player => {
						const playerIndex = users.findIndex(item => item.gameId == player.gameId);
						if (~playerIndex) io.to(users[playerIndex].socketId).emit('lobby-state', user.gameId, true);
					});
				} else {
					lobbies.push(new Lobby({ username: user.username, photo: user.photo, rating: user.rating, gameId: user.gameId, online: user.socketId != 'null', party: 0, ban: user.ban != 0 }, user.rating));
					user.lobbyId = lobbies[lobbies.length - 1].id;
					socket.emit('lobby', lobbies[lobbies.length - 1]);
				}

				writeUserInTable(db, 14, user);
			});
		});
	});

	socket.on('invite', (senderId, targetId, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE gameId='${senderId}' AND session='${session}' AND ban=0`).then(sender => {
			selectUserInTable(db, `SELECT * FROM users WHERE gameId='${targetId}' AND ban=0`).then(target => {
				const lobbyIndex = lobbies.findIndex(item => item.id == sender.lobbyId);

				if (~lobbyIndex && ~lobbies[lobbyIndex].players.findIndex(item => item.gameId == target.gameId)) return;
				
				const inviteId = crypto.randomBytes(30).toString("hex");
				sender.invites.push(inviteId);
				io.to(target.socketId).emit('invite', {	username: sender.username, id: sender.gameId }, inviteId);
				writeUserInTable(db, 15, sender, target);
				
				setTimeout(() => {
					selectUserInTable(db, `SELECT * FROM users WHERE gameId='${senderId}' AND session='${session}' AND ban=0`).then(sender => {
						const inviteIndex = sender.invites.findIndex(item => item == inviteId);
						if (~inviteIndex) {
							sender.invites.splice(inviteIndex, 1);
							writeUserInTable(db, 16, sender);
						}
					});
				}, 30000);
			});
		});
	});

	socket.on('add-friend', (senderId, targetId, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE gameId='${senderId}' AND session='${session}'`).then(sender => {
			selectUserInTable(db, `SELECT * FROM users WHERE gameId='${targetId}'`).then(target => {
				if (~sender.friends.findIndex(item => item == targetId) || ~target.friends.findIndex(item => item == senderId)) return;
				target.requests.push(sender);
				target.requests[target.requests.length - 1].inviteId = crypto.randomBytes(30).toString("hex");
				io.to(target.socketId).emit('requests', target.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null', inviteId: item.inviteId } }));
				writeUserInTable(db, 17, sender, target);
			});
		});
	});

	socket.on('request-decline', (requestId, gameId, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}'`).then(target => {
			selectUserInTable(db, `SELECT * FROM users WHERE gameId='${gameId}'`).then(sender => {
				selectUserInTable(db, `SELECT * FROM users`, false).then(users => {
				const requestIndex = target.requests.findIndex(item => item.inviteId == requestId);
				if (~requestIndex) {
					target.requests.splice(requestIndex, 1);

					let senderFriends = [];
					sender.friends.forEach(friendId => {
						const friendIndex = users.findIndex(item => item.gameId == friendId);
						if (~friendIndex) senderFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: users[friendIndex].socketId != 'null' });
					});
					sender.friends.forEach(friendId => {
						const friendIndex = users.findIndex(item => item.gameId == friendId);
						if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', sender.gameId, true);
					});

					let targetFriends = [];
					target.friends.forEach(friendId => {
						const friendIndex = users.findIndex(item => item.gameId == friendId);
						if (~friendIndex) targetFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: users[friendIndex].socketId != 'null' });
					});
					target.friends.forEach(friendId => {
						const friendIndex = users.findIndex(item => item.gameId == friendId);
						if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', target.gameId, true);
					});

					io.to(sender.socketId).emit('profile', {
						username: sender.username,
						photo: sender.photo,
						rating: sender.rating,
						characters: sender.characters,
						friends: senderFriends,
						requests: sender.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null' } }),
						gameId: sender.gameId
					});
					io.to(target.socketId).emit('profile', {
						username: target.username,
						photo: target.photo,
						rating: target.rating,
						characters: target.characters,
						friends: targetFriends,
						requests: target.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null' } }),
						gameId: target.gameId
					});
					io.to(target.socketId).emit('requests', target.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null', inviteId: item.inviteId } }));
					writeUserInTable(db, 18, sender, target);
				}
				});
			});
		});
	});

	socket.on('request-accept', (requestId, gameId, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}'`).then(target => {
			selectUserInTable(db, `SELECT * FROM users WHERE gameId='${gameId}'`).then(sender => {
				selectUserInTable(db, `SELECT * FROM users`, false).then(users => {
				if (!~target.friends.findIndex(item => item == gameId)) {
					const requestIndex = target.requests.findIndex(item => item.inviteId == requestId);
					if (~requestIndex) {
						target.friends.push(sender.gameId);
						sender.friends.push(target.gameId);
						target.requests.splice(requestIndex, 1);
					
						let senderFriends = [];
						sender.friends.forEach(friendId => {
							const friendIndex = users.findIndex(item => item.gameId == friendId);
							if (~friendIndex) senderFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: users[friendIndex].socketId != 'null' });
						});
						sender.friends.forEach(friendId => {
							const friendIndex = users.findIndex(item => item.gameId == friendId);
							if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', sender.gameId, true);
						});
					
						let targetFriends = [];
						target.friends.forEach(friendId => {
							const friendIndex = users.findIndex(item => item.gameId == friendId);
							if (~friendIndex) targetFriends.push({ gameId: friendId, name: users[friendIndex].username, photo: users[friendIndex].photo, rating: users[friendIndex].rating, online: users[friendIndex].socketId != 'null' });
						});
						target.friends.forEach(friendId => {
							const friendIndex = users.findIndex(item => item.gameId == friendId);
							if (~friendIndex) io.to(users[friendIndex].socketId).emit('friend-state', target.gameId, true);
						});

						io.to(sender.socketId).emit('profile', {
							username: sender.username,
							photo: sender.photo,
							rating: sender.rating,
							characters: sender.characters,
							friends: senderFriends,
							requests: sender.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null' } }),
							gameId: sender.gameId
						});
						io.to(target.socketId).emit('profile', {
							username: target.username,
							photo: target.photo,
							rating: target.rating,
							characters: target.characters,
							friends: targetFriends,
							requests: target.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null' } }),
							gameId: target.gameId
						});
						io.to(target.socketId).emit('requests', target.requests.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null', inviteId: item.inviteId } }));
						writeUserInTable(db, 19, sender, target);
					}
				}
				});
			});
		});
	});

	socket.on('get-users', (key, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE session='${session}'`).then(user => {
			selectUserInTable(db, `SELECT * FROM users WHERE username LIKE '${key}%' AND gameId<>'${user.gameId}'`, false).then(users => {
				socket.emit('users', users.map(item => { return { name: item.username, photo: item.photo, rating: item.rating, gameId: item.gameId, online: item.socketId != 'null' } }));
			});
		});
	});

	socket.on('kick', (senderId, targetId, session) => {
		selectUserInTable(db, `SELECT * FROM users WHERE gameId='${senderId}' AND session='${session}'`).then(sender => {
			selectUserInTable(db, `SELECT * FROM users WHERE gameId='${targetId}'`).then(target => {
				const lobbyIndex = lobbies.findIndex(item => item.id == sender.lobbyId);

				if (~lobbyIndex) {
					if (sender.gameId == target.gameId) {
						const inLobbyIndex = lobbies[lobbyIndex].players.findIndex(item => item.gameId == senderId);
						if (~inLobbyIndex) {
							lobbies[lobbyIndex].players.splice(inLobbyIndex, 1);
							if (lobbies[lobbyIndex].players.length == 0) lobbies.splice(lobbyIndex, 1);
							else {
								lobbies[lobbyIndex].players.forEach(player => {
									selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
										io.to(user.socketId).emit('lobby', lobbies[lobbyIndex]);
									});
								});
							}
							lobbies.push(new Lobby({ username: sender.username, photo: sender.photo, rating: sender.rating, gameId: sender.gameId, online: sender.socketId != 'null', party: 0, ban: sender.ban != 0 }, sender.rating));
							sender.lobbyId = lobbies[lobbies.length - 1].id;
							io.to(sender.socketId).emit('lobby', lobbies[lobbies.length - 1]);
						}
					} else if (lobbies[lobbyIndex].players[0].gameId == senderId) {
						const inLobbyIndex = lobbies[lobbyIndex].players.findIndex(item => item.gameId == targetId);
						if (~inLobbyIndex) {
							lobbies[lobbyIndex].players.splice(inLobbyIndex, 1);
							if (lobbies[lobbyIndex].players.length == 0) lobbies.splice(lobbyIndex, 1);
							else {
								lobbies[lobbyIndex].players.forEach(player => {
									selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
										io.to(user.socketId).emit('lobby', lobbies[lobbyIndex]);
									});
								});
							}
							lobbies.push(new Lobby({ username: target.username, photo: target.photo, rating: target.rating, gameId: target.gameId, online: target.socketId != 'null', party: 0, ban: target.ban != 0 }, target.rating));
							target.lobbyId = lobbies[lobbies.length - 1].id;
							io.to(target.socketId).emit('lobby', lobbies[lobbies.length - 1]);
							io.to(sender.socketId).emit('lobby', lobbies[lobbyIndex]);
						}
					}
				}
			});
		});
	});

	socket.on('invite-decline', (senderId, inviteId) => {
		selectUserInTable(db, `SELECT * FROM users WHERE gameId='${senderId}' AND session='${session}' AND ban=0`).then(sender => {
			selectUserInTable(db, `SELECT * FROM users WHERE socketId='${socket.id}' AND ban=0`).then(target => {
				const inviteIndex = sender.invites.findIndex(item => item == inviteId);
				if (~inviteIndex) {
					io.to(target.socketId).emit('invite-next');
					sender.invites.splice(inviteIndex, 1);
					writeUserInTable(db, 20, sender, target);
				}
			});
		});
	});

	socket.on('invite-accept', (senderId, inviteId) => {
		selectUserInTable(db, `SELECT * FROM users WHERE gameId='${senderId}' AND ban=0`).then(sender => {
			selectUserInTable(db, `SELECT * FROM users WHERE socketId='${socket.id}' AND ban=0`).then(target => {
				const inviteIndex = sender.invites.findIndex(item => item == inviteId);
				if (~inviteIndex) {
					let lobbyIndex = lobbies.findIndex(item => item.id == sender.lobbyId);
					if (~lobbyIndex && ~lobbies[lobbyIndex].players.findIndex(item => item.gameId == target.gameId)) return;


					io.to(target.socketId).emit('invite-next');
					sender.invites.splice(inviteIndex, 1);
				
					const oldLobbyIndex = lobbies.findIndex(item => item.id == target.lobbyId);
					if (~oldLobbyIndex) {
						const playerIndex = lobbies[oldLobbyIndex].players.findIndex(item => item.gameId == target.gameId);
						if (~playerIndex) lobbies[oldLobbyIndex].players.splice(playerIndex, 1);
						if (lobbies[oldLobbyIndex].players.length == 0) lobbies.splice(oldLobbyIndex, 1);
						else {
							lobbies[oldLobbyIndex].players.forEach(player => {
								selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
									io.to(user.socketId).emit('lobby', lobbies[oldLobbyIndex]);
								});
							});
						}
					}
				
					lobbyIndex = lobbies.findIndex(item => item.id == sender.lobbyId);
					if (~lobbyIndex) {
						target.lobbyId = lobbies[lobbyIndex].id;
						const targetObject = { username: target.username, photo: target.photo, rating: target.rating, gameId: target.gameId, online: target.socketId != 'null', ban: target.ban != 0 };
						io.to(targetObject.socketId).emit('not-ready');

						const senderIndex = lobbies[lobbyIndex].players.findIndex(player => player.gameId == senderId);
						if (~senderIndex) lobbies[lobbyIndex].addPlayer(targetObject, lobbies[lobbyIndex].players[senderIndex].party, true, true);

						sender.lobbyId = lobbies[lobbyIndex].id;

						lobbies[lobbyIndex].players.forEach(player => {
							selectUserInTable(db, `SELECT * FROM users WHERE gameId='${player.gameId}'`).then(user => {
								io.to(user.socketId).emit('lobby', lobbies[lobbyIndex]);
							});
						});
					}
				}
				writeUserInTable(db, 21, sender, target);
			});
		});
	});
}