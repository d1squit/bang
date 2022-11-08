const translate = (language) => {
	document.querySelectorAll('[lang]').forEach(element => {
		if (element == document.querySelector('html')) return;
		const path = element.getAttribute('lang').split('.');
		element.textContent = lang[language][path[0]][path[1]];
	});

	document.querySelectorAll('[class-lang]').forEach(element => {
		if (element == document.querySelector('html')) return;
		const className = element.getAttribute('class-lang').split(':')[0];
		const path = element.getAttribute('class-lang').split(':')[1].split('.');
		if (element.classList.contains(className)) element.textContent = lang[language][path[0]][path[1]];
	});
}

if (!localStorage.getItem('lang')) { localStorage.setItem('lang', 'en'); langSwitch.textContent = 'en' }
else langSwitch.textContent = localStorage.getItem('lang');

translate(localStorage.getItem('lang'));