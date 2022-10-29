const learn = [
	{
		text: `Твоя роль - 'Преступник'`,
		element: `document.querySelector('.role')`,
		info: true,
		time: 0
	},
	{
		text: `Твоя цель - убить шерифа (он обозначен такой меткой)`,
		element: `document.querySelector('.player-character__sheriff.player-sheriff.sheriff')`,
		info: true,
		time: 0,
	},
	{
		text: `Здесь видна вся информация об игроке: его персонаж, его здоровье (патроны), дистанция до него, его имя и количество карт в руке`,
		element: `document.querySelectorAll('.player-character')[2]`,
		info: true,
		time: 0,
	},
	{
		text: `Карта 'Бах' позволяет атаковать другого игрока на допустимой дистанции (без доп. оружия - 1). Нажми на карту, а затем на игрока, которого хочешь атаковать'`,
		element: `document.querySelector('.common-ctn .card')`,
		info: false,
		time: 0,
	},
	{
		text: `Нажми на свою цель - шерифа`,
		element: `document.querySelectorAll('.player-character')[2]`,
		info: false,
		time: 0,
	},
	{
		text: `Теперь заверши ход, чтобы получить новые карты в следующем`,
		element: `document.querySelector('.end-turn')`,
		info: false,
		time: 0,
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('turn-end', boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		text: `Теперь ходит второй преступник`,
		element: `document.querySelectorAll('.player')[1]`,
		info: true,
		time: 0
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('play-card', boardPlayers[1], boardPlayers[1].bot_cards[0], boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('turn-end', boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('turn-end', boardPlayers[1]); resolve(); }, 1000));
		}
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('play-card', boardPlayers[2], boardPlayers[2].bot_cards[0], boardPlayers[0]); resolve(); }, 2000));
		}
	},
	{
		text: `Тебя атаковали! Увернись от удара с помощью карты 'Промах'`,
		element: `document.querySelectorAll('.common-ctn .card')[1]`,
		info: false,
		time: 2000
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('turn-end', boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		text: `Карт 'Промах' больше нет, но можно увернуться от выстрела другим способом. Используй карту-модификатор 'Бочка' (она даст шанс промаха)`,
		element: `document.querySelectorAll('.common-ctn .card')[1]`,
		info: false,
		time: 2000
	},
	{
		text: `Атакуй шерифа еще раз (карта 'Бах' может быть использована только один раз за ход)`,
		element: `document.querySelectorAll('.common-ctn .card')[2]`,
		info: false,
		time: 500
	},
	{
		text: ` `,
		element: `document.querySelectorAll('.player-character')[2]`,
		info: false,
		time: 0
	},
	{
		text: `Возможности атаковать больше нет, поэтому дай возможность добить шерифа второму преступнику`,
		element: `document.querySelector('.end-turn')`,
		info: false,
		time: 0,
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('turn-end', boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('play-card', boardPlayers[1], boardPlayers[1].bot_cards[0], boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => { socket.emit('turn-end', boardPlayers[2]); resolve(); }, 1000));
		}
	},
	{
		command: () => {
			return new Promise((resolve) => setTimeout(() => {
				document.querySelector('.game-result h1').textContent = 'Вы выиграли!';
				document.querySelector('.game-result').style.display = 'flex';
				resolve();
			}, 1000));
		}
	}
];
