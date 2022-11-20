const logOut = async (socket) => {
	setCookie('session', 'null');
	await fetch('../logout');
	window.location.href = '../home';
};

document.querySelectorAll('.logo, .header__logo').forEach(element => {
	element.style.pointerEvents = 'all';
	element.style.cursor = 'pointer';
	element.addEventListener('click', () => window.location.href = '../home');
});


// cookie functions

const getCookie = (name) => {
	let matches = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([\.$?*|{}\(\)\[\]\\\/\+^])/g, '\\$1') + "=([^;]*)"));
	return matches ? decodeURIComponent(matches[1]) : undefined;
}

const setCookie = (name, value, options = {}) => {
	document.cookie = `${name}=${value}`;
}

const deleteAllCookies = () => {
	var cookies = document.cookie.split(";");

	for (var i = 0; i < cookies.length; i++) {
		var cookie = cookies[i];
		var eqPos = cookie.indexOf("=");
		var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
		document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
	}
}


const shortProfile = (user) => {
	return `<div class="short-profile">
				<img src="./assets/photos/${user.photo}.png" class="short-profile__photo">
				<div class="short-profile__right">
					<h2 class="short-profile__username">${user.username}</h2>
					<h2 class="short-profile__rating"><img src="./assets/img/rating/trophy-icon.svg" class="short-profile__trophy">${user.rating}</h2>
				</div>
			</div>`;
}

const langSwitch = document.querySelector('.header__social.lang');

if (langSwitch) {
	langSwitch.addEventListener('click', () => {
		if (localStorage.getItem('lang') == 'en') { localStorage.setItem('lang', 'ru'); langSwitch.textContent = 'ru'; translate('ru'); }
		else if (localStorage.getItem('lang') == 'ru') { localStorage.setItem('lang', 'en'); langSwitch.textContent = 'en'; translate('en'); }
	});
}