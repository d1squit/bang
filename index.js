import express from 'express';
import { Server } from 'socket.io';

import http from 'http';
import path from 'path';

import { startGame, initGame } from './modules/game.js';

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import crypto from 'crypto';


const __dirname = dirname(fileURLToPath(import.meta.url));


// ----------------------------------------------------------------------------------------- //

const port = 3000;

let app = express();
let server = http.createServer(app);
let io = new Server(server);


app.use('/', express.static(__dirname + '/'));
app.use(cors());


app.get('/', (request, response) => {
	// res.send({ response: "Server is up and running." }).status(200);
	response.sendFile(path.join(__dirname, 'client/index.html'));
});

let userStack = [];

const createRoom = async (sockets, botFlag = false) => {
	return new Promise ((resolve, reject) => {
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

class Lobby {
	constructor (players, rating) {
		this.players = players;
		this.average = { min: rating - 50, max: rating + 50 };
		this.id = crypto.randomBytes(16).toString("hex");
		this.accepted = [];
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

	static createLobby = (socket) => {
		const lobby = new Lobby([socket], socket.user.rating);
		const userIndex = userStack.findIndex(player => player.id == socket.id);
		if (~userIndex) {
			clearInterval(userStack[userIndex].interval);
			userStack.splice(userIndex, 1);
			this.#lobbies.push(lobby);
		}
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

	searchLobby = () => {
		for (let index = 0; index < Lobby.#lobbies.length; index++) {
			if (((this.average.min > Lobby.#lobbies[index].average.min && this.average.min < Lobby.#lobbies[index].average.max) ||
				(this.average.max > Lobby.#lobbies[index].average.min && this.average.max < Lobby.#lobbies[index].average.max) ||
				(this.average.min > Lobby.#lobbies[index].average.min && this.average.max < Lobby.#lobbies[index].average.max) ||
				(this.average.min < Lobby.#lobbies[index].average.min && this.average.max > Lobby.#lobbies[index].average.max))
				&& Lobby.#lobbies[index].players.length < 6 && this.players.length < 6) return index;
		}; return false;
	}

	addPlayer = (socket, lobbyUnion=false) => {
		if (this.players.length < 6) {
			this.players.push(socket);

			if (!lobbyUnion) {
				const userIndex = userStack.findIndex(player => player.id == socket.id);
				if (~userIndex) {
					clearInterval(userStack[userIndex].interval);
					userStack.splice(userIndex, 1);
				}
			}
	
			let allAverage = Math.round(this.players.map(item => item.user.rating).reduce((prev, current) => prev + current) / this.players.length);
			this.average = { min: allAverage - 50, max: allAverage + 50 };
		}
	}

	removePlayer = (socket) => this.players.splice(this.players.findIndex(player => player.id == socket.id), 1);
}


io.on('connection', (socket) => {
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