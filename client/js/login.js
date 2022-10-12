let socket = io();

if (localStorage.getItem('session')) window.location.href = './lobby.html';



document.querySelector('.login__submit').addEventListener('click', () => {
	$.getJSON("https://api.ipify.org?format=json", (data) => {
		socket.emit('login', document.querySelector('.login__input').value, document.querySelector('.password__input').value, data.ip);
    })
});

socket.on('decline', (error, tempSession) => {
	console.log(error)
	localStorage.setItem('code', tempSession);
});


socket.on('lobby-redirect', session => {
	localStorage.setItem('session', session);
	window.location.href = './lobby.html';
});