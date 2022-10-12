const logOut = (socket) => {
	$.getJSON("https://api.ipify.org?format=json", (data) => {
		socket.emit('logout', session, data.ip);
	});

	socket.on('login-redirect', () => {
		localStorage.removeItem('session');
		location.href = './login.html';
	});
};