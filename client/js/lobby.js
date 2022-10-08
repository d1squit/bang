// ------------------------------------------- CHARACTERS ------------------------------------------- //

const clearOutline = () => document.querySelectorAll('.lobby__match__character__field').forEach(element => element.classList.remove('outlined'));
const setOutline = (element) => element.classList.add('outlined');

document.querySelectorAll('.lobby__match__character__field').forEach(element => {
	element.addEventListener('click', () => {
		if (element.getAttribute('data-character') == 'none') return;
		clearOutline();
		setOutline(element);
	});
});

// ------------------------------------------- LOBBY ------------------------------------------- //

const user1 = {
	id: 1000000000,
	name: 'Richardson1',
	photo: '',
	rating: 240,
	characters: [0, 1, 2],
	friends: []
};

const createLobby = (user) => {
	window.user = user;
	document.querySelectorAll('.profile__name').forEach(element => element.textContent = user.name);
	document.querySelector('.lobby__profile__rating__number > h2').textContent = user.rating;
	user.characters.forEach((character, index) => document.querySelectorAll('.lobby__match__character__field')[index].setAttribute('data-character', character));
}

createLobby(user1);

// ------------------------------------------- INVITES ------------------------------------------- //

const invites = (function () {
	this.stack = [{name:'1'}, {name:'2'}, {name:'3'}];
	this.timeout = null;

	this.sendInvite = () => {
		document.querySelector('.lobby__invite__name').textContent = this.stack[0].name;
		document.querySelector('.lobby__invite').style.height = '68px';
		document.querySelector('.lobby__invite').style.padding = '17px 20px';
	
		this.timeout = setTimeout(() => {
			document.querySelector('.lobby__invite').style.height = '0px';
			document.querySelector('.lobby__invite').style.padding = '0px 20px';
			this.stack.splice(0, 1);

			if (this.stack.length > 0) {
				setTimeout(() => {
					this.sendInvite();
				}, 800);
			}
		}, 4000);
	}

	this.stopInvite = () => clearTimeout(this.timeout);


	this.addInvite = (user) => {
		if (!~this.stack.findIndex(item => item.id == user.id)) this.stack.push(user);
	}

	this.removeInvite = (user) => {
		const userIndex = this.stack.findIndex(item => item.id == user.id);
		if (!~userIndex) this.stack.splice(userIndex, 1);
	}

	return this;
})();
