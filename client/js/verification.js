let socket = io();

const query = window.location.search;
const urlParams = new URLSearchParams(query);

$.getJSON("https://api.ipify.org?format=json", (data) => {
	socket.emit('verification', localStorage.getItem('tempSession'), urlParams.get('code'), data.ip);
});

socket.on('login-redirect', () => {
	localStorage.removeItem('code');
	// location.href = './login.html';
	window.close();
});