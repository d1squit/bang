let history = 1;

document.querySelector('.history__button__next').addEventListener('click', () => {
	if (history < 4) history++;
	document.querySelectorAll('.history__text > *').forEach(element => element.style.display = 'none');
	document.querySelector('.history__text_' + history).style.display = 'block';

	if (history > 1) document.querySelector('.history__button__back').style.display = 'flex';
	else document.querySelector('.history__button__back').style.display = 'none';

	if (history < 4) document.querySelector('.history__button__next').style.display = 'flex';
	else document.querySelector('.history__button__next').style.display = 'none';
});

document.querySelector('.history__button__back').addEventListener('click', () => {
	if (history > 0) history--;
	document.querySelectorAll('.history__text > *').forEach(element => element.style.display = 'none');
	document.querySelector('.history__text_' + history).style.display = 'block';

	if (history > 1) document.querySelector('.history__button__back').style.display = 'flex';
	else document.querySelector('.history__button__back').style.display = 'none';

	if (history < 4) document.querySelector('.history__button__next').style.display = 'flex';
	else document.querySelector('.history__button__next').style.display = 'none';
});