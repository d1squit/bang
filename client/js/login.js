try { socket; } catch (e) { socket = io(); }
let session = getCookie('session');


const setUsername = (session, walletAddress) => {
	document.body.innerHTML += `
	<div class="username-form">
		<h2 class="username-form__title">Рады Вас приветствовать. Вы авторизовались с адреса ${walletAddress}</h2>
		<h2 class="username-form__question">укажите ваш никнейм</h2>
		<h2 class="username-form__error"></h2>
		<input type="edit" class="username-form__input" minlength="3" maxlength="99">
		<div class="username-form__button text-shadow">принять</div>
	</div>`;
	document.querySelector('.username-form__button').addEventListener('click', () => socket.emit('set-username', document.querySelector('.username-form__input').value, session, walletAddress));
}

socket.on('decline-username', reason => {
	if (reason == 0) document.querySelector('.username-form__error').textContent = 'Никнейм должен быть длиной от 3 до 99 символов';
	else if (reason == 1) document.querySelector('.username-form__error').textContent = 'Никнейм уже занят';
	else if (reason == 2) document.querySelector('.username-form__error').textContent = 'Можно использовать только латинский алфавит';
});

socket.on('accept-username', () => window.location.href = './lobby');

jQuery(document).ready($ => {
	$('.login__submit').on('click', async () => {
		const provider = await detectEthereumProvider();
		if (!provider) window.open("https://metamask.io/download/", "_blank");
		provider.enable();

		const web3 = new Web3(provider);
		const walletAddress = await web3.eth.getCoinbase();
		console.log(walletAddress)
		const nonceResponse = await fetch(`/nonce?walletAddress=${walletAddress}`);
		const { nonce } = await nonceResponse.json();

		const signedNonce = await web3.eth.personal.sign(nonce, walletAddress); console.log(signedNonce);

		socket.on('get-username', (localSession) => {
			session = localSession;
			setCookie('session', localSession);
			setUsername(localSession, walletAddress);
		});

		if (session == 'null' || !session) { socket.emit('session', walletAddress); console.log(walletAddress); }
		else {
			const successResponse = await fetch(`/verify?walletAddress=${walletAddress}&signedNonce=${signedNonce}&session=${session}`);
			const { success } = await successResponse.json();
			if (!success) socket.emit('session', walletAddress, 1);
			await checkSession(true);
		}

		socket.on('session', async localSession => {
			console.log(localSession)
			console.log(`/verify?walletAddress=${walletAddress}&signedNonce=${signedNonce}&session=${localSession}`)
			session = localSession; setCookie('session', session);
			const successResponse = await fetch(`/verify?walletAddress=${walletAddress}&signedNonce=${signedNonce}&session=${localSession}`);
			const { success } = await successResponse.json();
			await checkSession(true);
		});
	});

	const checkSession = async (redirect=false) => {
		const response = await fetch("/check");
		const { success, walletAddress } = await response.json();
		if (success) {
			setCookie('session', session);
			if (redirect) window.location.href = './lobby';
			if (document.querySelector('.login__submit')) socket.emit('get-short-profile', session);
		} else socket.emit('session', walletAddress);
	}

	socket.on('short-profile', user => {
		if (document.querySelector('.login__submit')) {
			document.querySelector('.login__submit').parentElement.innerHTML += shortProfile(user);
			document.querySelector('.login__submit').parentElement.removeChild(document.querySelector('.login__submit'));
		}
	});

	checkSession();
});