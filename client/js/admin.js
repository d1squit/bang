let socket = io();
let admin = {};

document.querySelector('.login').addEventListener('click', () => {
	socket.emit('admin-login', document.querySelector('.password').value);
});

socket.on('admin-login-accept', a => {
	admin = a;
	document.querySelector('.panel').style.display = 'block';
	document.querySelector('.login-panel').style.display = 'none';
	document.querySelector('.switch-tournament').textContent = admin.tournament ? 'Stop tournament' : 'Start tournament';
});

//XjerkXnopQceTT

document.querySelector('.switch-tournament').addEventListener('click', () => {
	if (admin.tournament) socket.emit('start-tournament', admin.password);
	else socket.emit('stop-tournament', admin.password);
});