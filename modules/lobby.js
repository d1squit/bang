import crypto from 'crypto';

export class Lobby {
	constructor (players, rating) {
		this.players = players;
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