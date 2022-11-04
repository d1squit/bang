import sql from 'sqlite3'
const sqlite3 = sql.verbose();

import crypto from 'crypto';

let db = new sqlite3.Database('./bang.db', sqlite3.OPEN_READWRITE, (err) => {
	if (err) console.error(err.message);
});

db.serialize(() => {
	db.run('DROP TABLE users');

	db.run(`CREATE TABLE \`users\` (
		\`wallet\` TEXT(42) NOT NULL DEFAULT '',
		\`username\` TEXT(99) NOT NULL DEFAULT '',
		\`photo\` TEXT(48) NOT NULL DEFAULT 'b0f50496833d799ea7b4a0397943ae18fb398275c283d652',
		\`rating\` INT NOT NULL DEFAULT 500,
		\`tournament\` INT NOT NULL DEFAULT 500,
		\`socketId\` TEXT(20) NOT NULL DEFAULT '',
		\`session\` TEXT(32) NOT NULL DEFAULT '',
		\`gameId\` TEXT(32) NOT NULL DEFAULT '',
		\`lobbyId\` TEXT(32) NOT NULL DEFAULT '',
		\`characters\` TEXT NOT NULL DEFAULT '[]',
		\`friends\` TEXT NOT NULL DEFAULT '[]',
		\`invites\` TEXT NOT NULL DEFAULT '[]',
		\`requests\` TEXT NOT NULL DEFAULT '[]',
		\`inviteId\` TEXT(60) NOT NULL DEFAULT '',
		\`banLevel\` INT NOT NULL DEFAULT 0,
		\`ban\` INT NOT NULL DEFAULT 0
	);`);

	// for (let i = 0; i < 300; i++) {
	// 	db.run(`INSERT INTO users (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097ba6', 'bot${i}', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', ${i * 5 + 100}, ${i * 5 + 50}, '${crypto.randomBytes(16).toString("hex")}', '[]', 0)`);
	// }
	
	db.run("INSERT INTO `users` (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097baa', 'bot1', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', 1000, 1000, '28333140afc5381857313666a0e70cf2', '[0,1,2]', 0)");
	db.run("INSERT INTO `users` (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097bab', 'bot2', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', 1000, 1000, '35c268d320309cd9845f76183da3ff01', '[0,1,2]', 0)");
	db.run("INSERT INTO `users` (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097bac', 'bot3', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', 1000, 1000, '28333140afc5381857313446a0e70cf2', '[0,1,2]', 0)");
	db.run("INSERT INTO `users` (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097bad', 'bot4', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', 1000, 1000, '2b4b5ecf4e7b43333c5d7cc4791ac390', '[0,1,2]', 0)");
	db.run("INSERT INTO `users` (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097bae', 'bot5', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', 1000, 1000, '2b4b5ecf4e7b43373c5d7cc4791ac390', '[0,1,2]', 0)");
	db.run("INSERT INTO `users` (wallet, username, photo, rating, tournament, gameId, characters, ban) VALUES ('0xa12750a9f5260504e9bc21bdafa7c56d75097baf', 'bot6', 'b0f50496833d799ea7b4a0397943ae18fb398275c283d651', 1000, 1000, '2b4b5ecf4e7b43335c5d7cc4791ac390', '[0,1,2]', 0)");
	
	db.run("UPDATE users SET wallet='0x3ccf74dc8304149cc3141f3521c013ab0bf7e91a' WHERE username='bot2'");
	db.close()
});