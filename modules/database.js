export const writeUserInTable = (db, mark, ...users) => {
	// console.log('write', mark, users);
	users.slice().forEach(user => {
		user.characters = JSON.stringify(user.characters);
		user.friends = JSON.stringify(user.friends);
		user.invites = JSON.stringify(user.invites);
		user.requests = JSON.stringify(user.requests);
		user.headers = JSON.stringify(user.headers);

		db.run(`UPDATE users SET wallet = '${user.wallet}', username = '${user.username}', photo = '${user.photo}', rating = ${user.rating}, tournament = ${user.tournament}, socketId = '${user.socketId}', session = '${user.session}', gameId = '${user.gameId}', lobbyId = '${user.lobbyId}', characters = '${user.characters}', friends = '${user.friends}', invites = '${user.invites}', requests = '${user.requests}', inviteId = '${user.inviteId}', banlevel = ${user.banLevel}, ban = ${user.ban} WHERE wallet = '${user.wallet}'`);
	});
}

export const selectUserInTable = (db, query, first = true, onfalse = () => {}) => {
	return new Promise((resolve, reject) => {
		db.serialize(() => {
			db.all(query, (error, rows) => {
				if (error) console.log('error', error);
				if (rows.length > 0) {
					let result = [];

					rows.forEach(user => {
						result.push(user);
						result[result.length - 1].characters = JSON.parse(user.characters);
						result[result.length - 1].friends = JSON.parse(user.friends);
						result[result.length - 1].invites = JSON.parse(user.invites);
						result[result.length - 1].requests = JSON.parse(user.requests);
					});
					
					resolve(first ? result[0] : result);
				} else if (onfalse) onfalse();
				else console.log(query)
			});
		});
	});
}