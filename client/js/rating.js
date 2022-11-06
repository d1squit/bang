let socket = io.connect('', { query: `extra=get-rating` });

socket.on('rating', response => { users = response; drawPage(users); });

const leftTable = document.querySelector('.left-bracket');
const rightTable = document.querySelector('.right-bracket');

let users = [];
let page = 0;
let count = 10;
let tournament = true;

const drawPage = (users) => {
	if (!users) return;

	if (tournament) {
		document.querySelector('.header__select__common').style.opacity = '0.7';
		document.querySelector('.header__select__tournament').style.opacity = '1';
	} else {
		document.querySelector('.header__select__common').style.opacity = '1';
		document.querySelector('.header__select__tournament').style.opacity = '0.7';
	}

	users.slice(page * count, page * count + count).forEach((user, index) => {
		leftTable.querySelectorAll('.number')[index].textContent = `#${page * count + index + 1}.`;
		leftTable.querySelectorAll('.photo')[index].innerHTML = `<img src="${user.photo}">`;
		leftTable.querySelectorAll('.username')[index].textContent = user.username;
		leftTable.querySelectorAll('.rating')[index].innerHTML = `<img src="./assets/img/rating/trophy-icon.svg" alt="" class="trophy">${tournament ? user.tournament : user.rating}`;
		leftTable.querySelectorAll('.prize')[index].innerHTML = `<div class="price">${300}</div><div class="symbol">$</div></div>`;
	});

	if (users.slice(page * count + count, page * count + 2 * count).length == 0) rightTable.style.display = 'none';
	else rightTable.style.display = 'block';

	users.slice(page * count + count, page * count + 2 * count).forEach((user, index) => {
		rightTable.querySelectorAll('.number')[index].textContent = `#${page * count + index + 1 + count}.`;
		rightTable.querySelectorAll('.photo')[index].innerHTML = `<img src="${user.photo}">`;
		rightTable.querySelectorAll('.username')[index].textContent = user.username;
		rightTable.querySelectorAll('.rating')[index].innerHTML = `<img src="./assets/img/rating/trophy-icon.svg" alt="" class="trophy">${tournament ? user.tournament : user.rating}`;
		rightTable.querySelectorAll('.prize')[index].innerHTML = `<div class="price">${300}</div><div class="symbol">$</div></div>`;
	});
}

document.querySelector('.bracket__arrow_left').addEventListener('click', () => { if (page > 0) { page -= 2; drawPage(users); } });
document.querySelector('.bracket__arrow_right').addEventListener('click', () => { if (page < 10) { page += 2; drawPage(users); } });

document.querySelector('.header__select__common').addEventListener('click', () => { tournament = false; drawPage (users); });
document.querySelector('.header__select__tournament').addEventListener('click', () => { tournament = true; drawPage (users); });
